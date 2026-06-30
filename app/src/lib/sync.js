import { supabase } from './supabase';
import { ensureKey } from './encKey';
import { IMAGE_BUCKET, IMAGE_REF_SCHEME } from './uploadImage';
import {
  encryptText, decryptText,
  encryptTags, decryptTags,
  encryptJson, decryptJson,
  isEncrypted,
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

  // Detect rows still stored as plaintext (written before encryption shipped).
  // The one-time migration only needs to re-upload when these actually exist —
  // otherwise it would pointlessly rewrite every row (bumping updated_at) on
  // each new device/browser. Public pages are plaintext on purpose; skip them.
  const plain = v => v && !isEncrypted(v);
  const needsEncryptionMigration =
    (nbsRes.data || []).some(nb => plain(nb.name)) ||
    (pgsRes.data || []).some(p => !p.is_public && (
      plain(p.title) || plain(p.body) || (p.tags || []).some(plain)
    )) ||
    (tsRes.data || []).some(t => plain(t.title) ||
      (Array.isArray(t.subtasks) ? t.subtasks.length > 0 : plain(t.subtasks))) ||
    (msRes.data || []).some(m => plain(m.title) || plain(m.notes));

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
    // A public page whose stored content is still ciphertext serves unreadable
    // blobs to anonymous visitors (pages shared before sharing rewrote content
    // in-place). Flag it for repair below. Encrypted tags are expected when
    // "hide tags" is on.
    needsPublicRewrite: !!p.is_public && (
      isEncrypted(p.title) || isEncrypted(p.body) ||
      (!p.public_hide_tags && (p.tags || []).some(isEncrypted))
    ),
  })));

  // Self-heal stale shared pages: rewrite their content plaintext so the public
  // link works. Fire-and-forget — hydration shouldn't block on it.
  const stale = pageRows.filter(p => p.needsPublicRewrite);
  if (stale.length) {
    Promise.all(stale.map(p => writePageContent(p.id, p, true, p.publicHideTags)))
      .catch(e => console.warn('[NoteMD] Could not repair shared page content', e));
  }

  const pagesByNb = new Map();
  pageRows.forEach(p => {
    const { notebookId, needsPublicRewrite: _stripped, ...page } = p;
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
    skipDates: Array.isArray(m.skip_dates) ? m.skip_dates : [],
    endDate: m.end_date || null,
  })));

  const meetingsByDate = {};
  meetingRows.forEach(m => {
    const { day, ...meeting } = m;
    (meetingsByDate[day] || (meetingsByDate[day] = [])).push(meeting);
  });

  return { notebooks, tasksByDate, meetingsByDate, needsEncryptionMigration };
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
      // Tags stay encrypted when "hide tags" is on, so anonymous readers can't
      // see them even if the RPC returns the column (getPublicPage filters
      // ciphertext); the owner still reads them via the normal decrypt path.
      const plain = !!p.isPublic;
      rows.push((async () => ({
        id: p.id,
        user_id: userId,
        notebook_id: nb.id,
        title: plain ? (p.title || '') : await encryptText(key, p.title || ''),
        body: plain ? (p.body || '') : await encryptText(key, p.body || ''),
        tags: await encryptTags(key, p.tags, plain && !p.publicHideTags),
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
        skip_dates: m.skipDates || [],
        end_date: m.endDate || null,
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
  // Task titles are encrypted in the tasks table; leaving the copy here in
  // plaintext would leak them anyway. Nothing reads this column back today
  // (fetchPomoSessions selects only task_id/duration_mins), and decryptText
  // handles both forms if it ever does.
  const key = await ensureKey();
  const { error } = await supabase.from('pomo_sessions').insert({
    user_id: userId,
    task_id: taskId || null,
    task_title: taskTitle ? await encryptText(key, taskTitle) : null,
    duration_mins: durationMins,
    session_type: 'work',
  });
  if (error) throw error;
}

// ---------- Public sharing ----------

// Rewrite a page's stored content so it matches its visibility: plaintext while
// public (anonymous visitors have no key), ciphertext otherwise. Called directly
// when sharing is toggled — waiting for the debounced sync left a window where
// the public link served `v1:...` blobs (and could serve them forever if the tab
// closed before the save fired).
async function writePageContent(pageId, page, plain, hideTags) {
  const key = await ensureKey();
  const row = {
    title: plain ? (page.title || '') : await encryptText(key, page.title || ''),
    body: plain ? (page.body || '') : await encryptText(key, page.body || ''),
    tags: await encryptTags(key, page.tags, plain && !hideTags),
  };
  const { error } = await supabase.from('pages').update(row).eq('id', pageId);
  if (error) throw error;
}

// Toggle a page's public visibility. When sharing, returns the share token
// (minted server-side and stable across re-shares); when unsharing, returns null.
// `page` is the current plaintext page state ({ title, body, tags }) so the
// stored content can be rewritten in the same call.
// opts: { expiresAt: ISO string | null, hideTags: boolean }
export async function setPagePublic(pageId, isPublic, page, opts = {}) {
  const { data, error } = await supabase.rpc('set_page_public', {
    p_page_id: pageId,
    p_public: isPublic,
    p_expires_at: isPublic ? (opts.expiresAt || null) : null,
    p_hide_tags: !!opts.hideTags,
  });
  if (error) throw error;
  await writePageContent(pageId, page, isPublic, !!opts.hideTags);
  return data; // token string or null
}

// Fetch a publicly-shared page by its token. Works for anonymous visitors.
// Returns null when the token is unknown or the page is no longer public.
//
// Anonymous visitors have no key, so any `v1:` ciphertext that reaches us is
// unreadable and must never be rendered as-is. Notebook names are *always*
// stored encrypted (flattenNotebooks has no public exception), and a page
// shared before the content rewrite existed may still hold encrypted fields.
export async function getPublicPage(token) {
  const { data, error } = await supabase.rpc('get_public_page', { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const scrub = v => (isEncrypted(v) ? '' : (v || ''));
  return {
    title: scrub(row.title),
    body: scrub(row.body),
    tags: (Array.isArray(row.tags) ? row.tags : []).filter(t => !isEncrypted(t)),
    updated: row.updated_at ? new Date(row.updated_at).getTime() : null,
    notebookName: scrub(row.notebook_name),
    notebookColor: row.notebook_color || null,
  };
}

// Collect the storage paths of every `img:<path>` reference across all page
// bodies in a notebooks tree. Used to find images no longer referenced anywhere.
const IMG_REF_RE = new RegExp(`!\\[[^\\]]*\\]\\(${IMAGE_REF_SCHEME}([^)\\s]+)\\)`, 'g');
function collectImagePaths(notebooks) {
  const paths = new Set();
  for (const nb of notebooks || []) {
    for (const p of nb.pages || []) {
      const body = p.body || '';
      let m;
      IMG_REF_RE.lastIndex = 0;
      while ((m = IMG_REF_RE.exec(body))) paths.add(m[1].split('#')[0]); // drop size fragment
    }
  }
  return paths;
}

// Delete bucket files for images that were referenced before but no longer
// appear in any page (image removed from a note, or its page/notebook deleted).
// Best-effort: a storage failure here must never break the data sync, so the
// caller swallows errors. Only `img:`-scheme refs are managed; legacy full-URL
// images are left untouched since their paths aren't reliably recoverable.
async function cleanupOrphanedImages(prev, next) {
  const prevPaths = collectImagePaths(prev.notebooks);
  if (prevPaths.size === 0) return;
  const nextPaths = collectImagePaths(next.notebooks);
  const orphaned = [...prevPaths].filter((p) => !nextPaths.has(p));
  if (orphaned.length === 0) return;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(orphaned);
  if (error) throw error;
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

  // Best-effort: reclaim bucket storage for images removed from notes. Runs
  // after the data sync succeeds so a storage hiccup can't lose note content.
  try {
    await cleanupOrphanedImages(prev, next);
  } catch (err) {
    console.warn('[NoteMD] Image cleanup failed (non-fatal):', err);
  }
}
