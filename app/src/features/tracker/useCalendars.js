import { useMemo } from 'react';
import { useStoredState } from '../../shared/hooks/useStoredState';
import {
  listCalendars, calendarIdSet, itemCalendarId,
  patchCalendarRows, releaseCalendar, restampCalendar, countOnCalendar, filterByCalendar,
} from '../../shared/utils/calendars';

/* Everything the UI needs to show and manage tracker calendars.

   Returns null when calendars aren't available (the database hasn't been
   migrated yet). Callers treat null as "no calendars": every task and meeting
   is shown together and nothing calendar-related is rendered — the tracker
   behaves exactly as it did before the feature existed. */
export function useCalendars({
  supported, calendars, setCalendars,
  tasksByDate, setTasksByDate, meetingsByDate, setMeetingsByDate,
}) {
  // Which calendar you're looking at is a per-device choice, like the tab.
  const [storedId, setStoredId] = useStoredState('nmd_calendar', null);

  const list = useMemo(() => listCalendars(calendars), [calendars]);
  const ids = useMemo(() => calendarIdSet(calendars), [calendars]);

  if (!supported) return null;

  // 'all' shows every calendar at once. It isn't a calendar, so new items
  // filed while it's selected land on the default one.
  const viewingAll = storedId === 'all' && list.length > 1;
  const activeId = viewingAll ? 'all' : (storedId && ids.has(storedId) ? storedId : null);
  const byId = (id) => list.find(c => c.id === (id || null)) || list[0];

  return {
    list,
    activeId,
    viewingAll,
    active: viewingAll ? { id: 'all', name: 'All calendars', isDefault: false } : byId(activeId),
    setActiveId: (id) => setStoredId(id || null),
    /** More than one calendar exists — only then do items need labelling. */
    multiple: list.length > 1,
    /** The calendar an item is on (items from a deleted calendar are on the default). */
    idOf: (item) => itemCalendarId(item, ids),
    of: (item) => byId(itemCalendarId(item, ids)),
    byId,
    /** A `{ day: [items] }` map narrowed to one calendar (the active one by default).
        `'all'` leaves the map untouched. */
    filter: (byDate, id = activeId) => (id === 'all' ? byDate : filterByCalendar(byDate, id || null, ids)),
    /** `{ calendarId }` to spread into a new item, or nothing for the default calendar. */
    stamp: (id = activeId) => {
      const chosen = !id || id === 'all' ? null : id;
      return chosen ? { calendarId: chosen } : {};
    },
    count: (id) => ({
      tasks: countOnCalendar(tasksByDate, id || null, ids),
      meetings: countOnCalendar(meetingsByDate, id || null, ids),
    }),

    create(name) {
      const row = {
        id: crypto.randomUUID(),
        name: name.trim() || 'Untitled',
        isDefault: false,
      };
      setCalendars(prev => [...prev, row]);
      setStoredId(row.id);
      return row.id;
    },
    update(id, patch) {
      const newId = crypto.randomUUID();
      setCalendars(prev => patchCalendarRows(prev, id || null, patch, newId));
    },
    /** Drag-reorder. `beforeId` null appends. The default calendar stays pinned first. */
    reorder(id, beforeId) {
      if (!id || id === beforeId) return;
      setCalendars(prev => {
        const rows = [...(prev || [])];
        const from = rows.findIndex(c => c.id === id && !c.isDefault);
        if (from < 0) return prev;
        const [row] = rows.splice(from, 1);
        const to = beforeId ? rows.findIndex(c => c.id === beforeId) : -1;
        rows.splice(to < 0 ? rows.length : to, 0, row);
        return rows;
      });
    },
    /** Removing a calendar keeps what was on it: it all moves to the default
        calendar. Returns a function that undoes the removal. */
    remove(id) {
      if (!id) return () => {};
      const idsOn = (byDate) => new Set(Object.values(byDate || {}).flat().filter(i => i.calendarId === id).map(i => i.id));
      const taskIds = idsOn(tasksByDate);
      const meetingIds = idsOn(meetingsByDate);
      const rows = calendars || [];
      const idx = rows.findIndex(c => c.id === id);
      const row = rows[idx];
      const wasViewing = storedId === id;
      setTasksByDate(prev => releaseCalendar(prev, id));
      setMeetingsByDate(prev => releaseCalendar(prev, id));
      setCalendars(prev => prev.filter(c => c.id !== id));
      if (wasViewing) setStoredId(null);
      return () => {
        if (row) setCalendars(prev => (prev || []).some(c => c.id === id) ? prev : [...(prev || []).slice(0, idx), row, ...(prev || []).slice(idx)]);
        setTasksByDate(prev => restampCalendar(prev, id, taskIds));
        setMeetingsByDate(prev => restampCalendar(prev, id, meetingIds));
        if (wasViewing) setStoredId(id);
      };
    },
  };
}
