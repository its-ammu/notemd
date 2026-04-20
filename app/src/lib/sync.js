import { supabase } from './supabase';

// ---------- Hydrate: server rows -> client state shape ----------

export async function fetchAllData() {
  const [nbsRes, pgsRes, tsRes, msRes] = await Promise.all([
    supabase.from('notebooks').select('*').order('position', { ascending: true }),
    supabase.from('pages').select('*').order('position', { ascending: true }),
    supabase.from('tasks').select('*').order('position', { ascending: true }),
    supabase.from('meetings').select('*'),
  ]);

  const err = nbsRes.error || pgsRes.error || tsRes.error || msRes.error;
  if (err) throw err;

  const pagesByNb = new Map();
  (pgsRes.data || []).forEach(p => {
    const list = pagesByNb.get(p.notebook_id) || [];
    list.push({
      id: p.id,
      title: p.title || '',
      body: p.body || '',
      tags: Array.isArray(p.tags) ? p.tags : [],
      created: new Date(p.created_at).getTime(),
      updated: new Date(p.updated_at).getTime(),
    });
    pagesByNb.set(p.notebook_id, list);
  });

  const notebooks = (nbsRes.data || []).map(nb => ({
    id: nb.id,
    name: nb.name,
    color: nb.color,
    paper: nb.paper,
    pages: pagesByNb.get(nb.id) || [],
  }));

  const tasksByDate = {};
  (tsRes.data || []).forEach(t => {
    const list = tasksByDate[t.day] || (tasksByDate[t.day] = []);
    list.push({
      id: t.id,
      title: t.title || '',
      done: !!t.done,
      priority: t.priority,
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
      linkedPageId: t.linked_page_id || null,
      created: new Date(t.created_at).getTime(),
    });
  });

  const meetingsByDate = {};
  (msRes.data || []).forEach(m => {
    const list = meetingsByDate[m.day] || (meetingsByDate[m.day] = []);
    list.push({
      id: m.id,
      title: m.title || '',
      time: m.time || '',
      duration: String(m.duration ?? 30),
      repeat: m.repeat,
      notes: m.notes || '',
      linkedPageId: m.linked_page_id || null,
    });
  });

  return { notebooks, tasksByDate, meetingsByDate };
}

// ---------- Flatten client state -> rows ----------

function flattenNotebooks(notebooks, userId) {
  return notebooks.map((nb, i) => ({
    id: nb.id,
    user_id: userId,
    name: nb.name,
    color: nb.color,
    paper: nb.paper,
    position: i,
  }));
}

function flattenPages(notebooks, userId) {
  const rows = [];
  notebooks.forEach(nb => {
    (nb.pages || []).forEach((p, i) => {
      rows.push({
        id: p.id,
        user_id: userId,
        notebook_id: nb.id,
        title: p.title || '',
        body: p.body || '',
        tags: Array.isArray(p.tags) ? p.tags : [],
        position: i,
      });
    });
  });
  return rows;
}

function flattenTasks(tasksByDate, userId) {
  const rows = [];
  Object.entries(tasksByDate).forEach(([day, list]) => {
    list.forEach((t, i) => {
      rows.push({
        id: t.id,
        user_id: userId,
        day,
        title: t.title || '',
        done: !!t.done,
        priority: t.priority || 'none',
        position: i,
        subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
        linked_page_id: t.linkedPageId || null,
      });
    });
  });
  return rows;
}

function flattenMeetings(meetingsByDate, userId) {
  const rows = [];
  Object.entries(meetingsByDate).forEach(([day, list]) => {
    list.forEach(m => {
      rows.push({
        id: m.id,
        user_id: userId,
        day,
        title: m.title || '',
        time: m.time || null,
        duration: parseInt(m.duration, 10) || 30,
        repeat: m.repeat || 'none',
        notes: m.notes || '',
        linked_page_id: m.linkedPageId || null,
      });
    });
  });
  return rows;
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

export async function pushChanges(userId, prev, next) {
  const prevNbs = flattenNotebooks(prev.notebooks, userId);
  const nextNbs = flattenNotebooks(next.notebooks, userId);
  const prevPgs = flattenPages(prev.notebooks, userId);
  const nextPgs = flattenPages(next.notebooks, userId);
  const prevTs  = flattenTasks(prev.tasksByDate, userId);
  const nextTs  = flattenTasks(next.tasksByDate, userId);
  const prevMs  = flattenMeetings(prev.meetingsByDate, userId);
  const nextMs  = flattenMeetings(next.meetingsByDate, userId);

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
