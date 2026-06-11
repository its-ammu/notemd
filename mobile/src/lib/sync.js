// Mobile sync — tasks + meetings only (no notebooks/pages/pomo).
// linkedPageId is read and written back unchanged to preserve web data.
// skip_dates and end_date are included here (web flattenMeetings omits them — bug fix).

import { supabase } from './supabase';
import { ensureKey } from './encKey';
import { encryptText, decryptText, encryptJson, decryptJson } from './crypto';

export async function fetchAllData() {
  const key = await ensureKey();

  const [tsRes, msRes] = await Promise.all([
    supabase.from('tasks').select('*').order('position', { ascending: true }),
    supabase.from('meetings').select('*'),
  ]);

  if (tsRes.error) throw tsRes.error;
  if (msRes.error) throw msRes.error;

  const taskRows = await Promise.all((tsRes.data || []).map(async t => ({
    day: t.day,
    id: t.id,
    title: await decryptText(key, t.title || ''),
    done: !!t.done,
    priority: t.priority || 'none',
    subtasks: await decryptJson(key, t.subtasks),
    linkedPageId: t.linked_page_id || null,
    created: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
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
    repeat: m.repeat || 'none',
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

  return { tasksByDate, meetingsByDate };
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
  const upsert = [], remove = [];
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
  const key = await ensureKey();
  const [prevTs, nextTs, prevMs, nextMs] = await Promise.all([
    flattenTasks(key, prev.tasksByDate, userId),
    flattenTasks(key, next.tasksByDate, userId),
    flattenMeetings(key, prev.meetingsByDate, userId),
    flattenMeetings(key, next.meetingsByDate, userId),
  ]);

  await pushTable('tasks', diff(prevTs, nextTs));
  await pushTable('meetings', diff(prevMs, nextMs));
}
