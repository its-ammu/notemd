/* Tracker calendars.

   Stored rows (`calendars` state) look like `{ id, name, isDefault }`.
   The default calendar is special: tasks and meetings on it carry no
   `calendarId` at all, which is exactly what every item looked like before
   calendars existed. Its row is optional — it only appears once the default
   calendar has been renamed — so until then it's implied.

   Calendars deliberately have no colour: you look at one at a time, so the
   name is enough, and colour in the tracker already means priority.

   Everything in the UI works with the list from `listCalendars`, where the
   default calendar always comes first with `id: null`. */

export const DEFAULT_CALENDAR_NAME = 'Personal';

/** The row carrying the default calendar's name, if there is one. */
export const defaultCalendarRow = (rows) => (rows || []).find(c => c.isDefault) || null;

/** Calendars as the UI shows them: default first (`id: null`), then the rest. */
export function listCalendars(rows) {
  const row = defaultCalendarRow(rows);
  return [
    {
      id: null,
      name: row?.name || DEFAULT_CALENDAR_NAME,
      isDefault: true,
    },
    ...(rows || []).filter(c => !c.isDefault).map(c => ({
      id: c.id,
      name: c.name || 'Untitled',
      isDefault: false,
    })),
  ];
}

/** Ids an item may point at. Anything else belongs to the default calendar. */
export function calendarIdSet(rows) {
  return new Set((rows || []).filter(c => !c.isDefault).map(c => c.id));
}

/** The calendar an item lives on: its own if that still exists, else default (null). */
export function itemCalendarId(item, ids) {
  const id = item?.calendarId;
  return id && ids.has(id) ? id : null;
}

/** Rename a calendar. The default calendar (`id: null`) gets its
    row created the first time it's changed; `newId` is the id to give it. */
export function patchCalendarRows(rows, id, patch, newId) {
  const list = rows || [];
  if (id) return list.map(c => (c.id === id ? { ...c, ...patch } : c));
  const row = defaultCalendarRow(list);
  if (row) return list.map(c => (c === row ? { ...c, ...patch } : c));
  const current = listCalendars(list)[0];
  return [{ id: newId, name: current.name, isDefault: true, ...patch }, ...list];
}

/** Calendars read from a backup file: well-formed rows only, one default at most. */
export function sanitizeCalendarRows(rows) {
  if (!Array.isArray(rows)) return [];
  let sawDefault = false;
  const seen = new Set();
  return rows.flatMap(c => {
    if (!c || typeof c.id !== 'string' || !c.id || seen.has(c.id)) return [];
    if (c.isDefault && sawDefault) return [];
    if (c.isDefault) sawDefault = true;
    seen.add(c.id);
    return [{
      id: c.id,
      name: typeof c.name === 'string' ? c.name : '',
      isDefault: !!c.isDefault,
    }];
  });
}

/** How many tasks / meetings (series count once) sit on a calendar. */
export function countOnCalendar(byDate, calendarId, ids) {
  let n = 0;
  for (const list of Object.values(byDate || {})) {
    for (const item of list) if (itemCalendarId(item, ids) === calendarId) n++;
  }
  return n;
}

/** Keep only one calendar's items in a `{ day: [items] }` map. */
export function filterByCalendar(byDate, calendarId, ids) {
  const out = {};
  for (const [day, list] of Object.entries(byDate || {})) {
    const kept = list.filter(item => itemCalendarId(item, ids) === calendarId);
    if (kept.length) out[day] = kept;
  }
  return out;
}

/** Send every item of one calendar back to the default calendar. */
/** Put `calendarId` back on the items whose ids are in `itemIds` — the undo
    for releaseCalendar. */
export function restampCalendar(byDate, calendarId, itemIds) {
  if (!itemIds.size) return byDate;
  const out = {};
  for (const [day, list] of Object.entries(byDate || {})) {
    out[day] = list.map(item => (itemIds.has(item.id) ? { ...item, calendarId } : item));
  }
  return out;
}

export function releaseCalendar(byDate, calendarId) {
  let touched = false;
  const out = {};
  for (const [day, list] of Object.entries(byDate || {})) {
    out[day] = list.map(item => {
      if (item.calendarId !== calendarId) return item;
      touched = true;
      const { calendarId: _dropped, ...rest } = item;
      return rest;
    });
  }
  return touched ? out : byDate;
}
