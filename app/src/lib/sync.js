import { supabase } from './supabase';
import { ensureKey } from './encKey';
import {
  encryptText, decryptText,
  encryptTags, decryptTags,
  encryptJson, decryptJson,
} from './crypto';

// ---------- Hydrate: server rows -> client state shape ----------

export async function fetchAllData() {
  const key = await ensureKey();

  const [nbsRes, pgsRes, tsRes, msRes] = await Promise.all([
    supabase.from('notebooks').select('*').order('position', { ascending: true }),
    supabase.from('pages').select('*').order('position', { ascending: true }),
    supabase.from('tasks').select('*').order('position', { ascending: true }),
    supabase.from('meetings').select('*'),
  ]);

  const err = nbsRes.error || pgsRes.error || tsRes.error || msRes.error;
  if (err) throw err;

  // Decrypt content fields on the way in. decryptText/Tags/Json pass plaintext
  // through untouched, so pre-encryption rows and public (plaintext) pages just
  // work without any per-row flag. Decrypt into ordered arrays first (Promise.all
  // preserves input order), then group — grouping inside the async map could
  // scramble position order.
  const pageRows = await Promise.all((pgsRes.data || []).map(async p => ({
    notebookId: p.notebook_id,
    id: p.id,
    title: await decryptText(key, p.title || ''),
    body: await decryptText(key, p.body || ''),
    tags: await decryptTags(key, p.tags),
    created: new Date(p.created_at).getTime(),
    updated: new Date(p.updated_at).getTime(),
    // Sharing state — read-only here; toggled via setPagePublic. Public pages
    // are stored plaintext (see flattenPages) so get_public_page can serve them.
    isPublic: !!p.is_public,
    publicToken: p.public_token || null,
    publicExpiresAt: p.public_expires_at || null,
    publicHideTags: !!p.public_hide_tags,
  })));

  const pagesByNb = new Map();
  pageRows.forEach(p => {
    const { notebookId, ...page } = p;
    const list = pagesByNb.get(notebookId) || [];
    list.push(page);
    pagesByNb.set(notebookId, list);
  });

  const notebooks = await Promise.all((nbsRes.data || []).map(async nb => ({
    id: nb.id,
    name: await decryptText(key, nb.name),
    color: nb.color,
    paper: nb.paper,
    pages: pagesByNb.get(nb.id) || [],
  })));

  const taskRows = await Promise.all((tsRes.data || []).map(async t => ({
    day: t.day,
    id: t.id,
    title: await decryptText(key, t.title || ''),
    done: !!t.done,
    priority: t.priority,
    subtasks: await decryptJson(key, t.subtasks),
    linkedPageId: t.linked_page_id || null,
    created: new Date(t.created_at).getTime(),
  })));

  const tasksByDate = {};
  taskRows.forEach(t => {
    const { day, ...task } = t;
    (tasksByDate[day] || (tasksByDate[day] = [])).push(task);
  });

  const meetingRows = await Promise.all((msRes.data || []).map(async m => ({
    day: m.day,
    id: m.id,
    title: await decryptText(key, m.title || ''),
    time: m.time || '',
    duration: String(m.duration ?? 30),
    repeat: m.repeat,
    notes: await decryptText(key, m.notes || ''),
    linkedPageId: m.linked_page_id || null,
  })));

  const meetingsByDate = {};
  meetingRows.forEach(m => {
    const { day, ...meeting } = m;
    (meetingsByDate[day] || (meetingsByDate[day] = [])).push(meeting);
  });

  return { notebooks, tasksByDate, meetingsByDate };
}

// ---------- Flatten client state -> rows ----------

async function flattenNotebooks(key, notebooks, userId) {
  return Promise.all(notebooks.map(async (nb, i) => ({
    id: nb.id,
    user_id: userId,
    name: await encryptText(key, nb.name),
    color: nb.color,
    paper: nb.paper,
    position: i,
  })));
}

async function flattenPages(key, notebooks, userId) {
  const rows = [];
  notebooks.forEach(nb => {
    (nb.pages || []).forEach((p, i) => {
      // Public pages are stored plaintext so get_public_page can serve them to
      // anonymous visitors. Toggling sharing changes p.isPublic, which re-flows
      // through here on the next push and rewrites the content accordingly.
      const plain = !!p.isPublic;
      rows.push((async () => ({
        id: p.id,
        user_id: userId,
        notebook_id: nb.id,
        title: plain ? (p.title || '') : await encryptText(key, p.title || ''),
        body: plain ? (p.body || '') : await encryptText(key, p.body || ''),
        tags: await encryptTags(key, p.tags, plain),
        position: i,
      }))());
    });
  });
  return Promise.all(rows);
}

async function flattenTasks(key, tasksByDate, userId) {
  const rows = [];
  Object.entries(tasksByDate).forEach(([day, list]) => {
    list.forEach((t, i) => {
      rows.push((async () => ({
        id: t.id,
        user_id: userId,
        day,
        title: await encryptText(key, t.title || ''),
        done: !!t.done,
        priority: t.priority || 'none',
        position: i,
        subtasks: await encryptJson(key, t.subtasks),
        linked_page_id: t.linkedPageId || null,
      }))());
    });
  });
  return Promise.all(rows);
}

async function flattenMeetings(key, meetingsByDate, userId) {
  const rows = [];
  Object.entries(meetingsByDate).forEach(([day, list]) => {
    list.forEach(m => {
      rows.push((async () => ({
        id: m.id,
        user_id: userId,
        day,
        title: await encryptText(key, m.title || ''),
        time: m.time || null,
        duration: parseInt(m.duration, 10) || 30,
        repeat: m.repeat || 'none',
        notes: await encryptText(key, m.notes || ''),
        linked_page_id: m.linkedPageId || null,
      }))());
    });
  });
  return Promise.all(rows);
}

// ---------- Diff & push ----------

function shallowEq(a, b) {
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    const av = a[k], bv = b[k];
    if (av === bv) continue;
    if (typeof av === 'object' && av !== null && typeof bv === 'object' && bv !== null) {
      if (JSON.stringify(av) !== JSON.stringify(bv)) return false;
    } else {
      return false;
    }
  }
  return true;
}

function diff(prevRows, nextRows) {
  const prevMap = new Map(prevRows.map(r => [r.id, r]));
  const nextMap = new Map(nextRows.map(r => [r.id, r]));
  const upsert = [];
  const remove = [];
  for (const [id, next] of nextMap) {
    const prev = prevMap.get(id);
    if (!prev || !shallowEq(prev, next)) upsert.push(next);
  }
  for (const [id] of prevMap) {
    if (!nextMap.has(id)) remove.push(id);
  }
  return { upsert, remove };
}

async function pushTable(table, { upsert, remove }) {
  if (upsert.length) {
    const { error } = await supabase.from(table).upsert(upsert);
    if (error) throw error;
  }
  if (remove.length) {
    const { error } = await supabase.from(table).delete().in('id', remove);
    if (error) throw error;
  }
}

export async function fetchPomoSessions() {
  const { data, error } = await supabase
    .from('pomo_sessions')
    .select('task_id, duration_mins')
    .eq('session_type', 'work');
  if (error) throw error;
  const stats = { total: 0, mins: 0, byTask: {} };
  for (const row of data || []) {
    stats.total += 1;
    stats.mins += row.duration_mins;
    if (row.task_id) {
      const t = stats.byTask[row.task_id] || { sessions: 0, mins: 0 };
      t.sessions += 1;
      t.mins += row.duration_mins;
      stats.byTask[row.task_id] = t;
    }
  }
  return stats;
}

export async function insertPomoSession(userId, taskId, taskTitle, durationMins = 25) {
  const { error } = await supabase.from('pomo_sessions').insert({
    user_id: userId,
    task_id: taskId || null,
    task_title: taskTitle || null,
    duration_mins: durationMins,
    session_type: 'work',
  });
  if (error) throw error;
}

// ---------- Public sharing ----------

// Toggle a page's public visibility. When sharing, returns the share token
// (minted server-side and stable across re-shares); when unsharing, returns null.
// opts: { expiresAt: ISO string | null, hideTags: boolean }
export async function setPagePublic(pageId, isPublic, opts = {}) {
  const { data, error } = await supabase.rpc('set_page_public', {
    p_page_id: pageId,
    p_public: isPublic,
    p_expires_at: isPublic ? (opts.expiresAt || null) : null,
    p_hide_tags: !!opts.hideTags,
  });
  if (error) throw error;
  return data; // token string or null
}

// Fetch a publicly-shared page by its token. Works for anonymous visitors.
// Returns null when the token is unknown or the page is no longer public.
export async function getPublicPage(token) {
  const { data, error } = await supabase.rpc('get_public_page', { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    title: row.title || '',
    body: row.body || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    updated: row.updated_at ? new Date(row.updated_at).getTime() : null,
    notebookName: row.notebook_name || '',
    notebookColor: row.notebook_color || null,
  };
}

export async function pushChanges(userId, prev, next) {
  const key = await ensureKey();
  const [prevNbs, nextNbs, prevPgs, nextPgs, prevTs, nextTs, prevMs, nextMs] =
    await Promise.all([
      flattenNotebooks(key, prev.notebooks, userId),
      flattenNotebooks(key, next.notebooks, userId),
      flattenPages(key, prev.notebooks, userId),
      flattenPages(key, next.notebooks, userId),
      flattenTasks(key, prev.tasksByDate, userId),
      flattenTasks(key, next.tasksByDate, userId),
      flattenMeetings(key, prev.meetingsByDate, userId),
      flattenMeetings(key, next.meetingsByDate, userId),
    ]);

  const nbsDiff = diff(prevNbs, nextNbs);
  const pgsDiff = diff(prevPgs, nextPgs);
  const tsDiff  = diff(prevTs,  nextTs);
  const msDiff  = diff(prevMs,  nextMs);

  // Order: upsert parents before children; delete children before parents.
  // Pages depend on notebooks, so: upsert notebooks, then pages; delete pages, then notebooks.
  // (FK cascade would handle page deletion when a notebook goes, but we delete pages explicitly for moved pages.)
  await pushTable('notebooks', { upsert: nbsDiff.upsert, remove: [] });
  await pushTable('pages',     pgsDiff);
  await pushTable('notebooks', { upsert: [], remove: nbsDiff.remove });
  await pushTable('tasks',     tsDiff);
  await pushTable('meetings',  msDiff);
}
