import { fmtDate } from '../../shared/utils/time';

export function expandRecurringMeetings(meetingsByDate, days) {
  const result = {};
  days.forEach(d => { result[fmtDate(d)] = []; });

  for (const [dateKey, list] of Object.entries(meetingsByDate)) {
    if (result[dateKey]) {
      result[dateKey] = list.filter(m => {
        if ((m.skipDates || []).includes(dateKey)) return false;
        if (m.endDate && dateKey >= m.endDate) return false;
        return true;
      });
    }
  }

  const existingIds = new Set();
  for (const list of Object.values(result)) list.forEach(m => existingIds.add(m.id));

  for (const [originDate, list] of Object.entries(meetingsByDate)) {
    for (const meeting of list) {
      if (!meeting.repeat || meeting.repeat === 'none') continue;
      const origin = new Date(originDate + 'T00:00:00');
      const skip = meeting.skipDates || [];
      const endDate = meeting.endDate;

      days.forEach(day => {
        const dayKey = fmtDate(day);
        if (dayKey === originDate) return;
        if (skip.includes(dayKey)) return;
        if (endDate && dayKey >= endDate) return;
        const diffDays = Math.round((day - origin) / 86400000);
        if (diffDays <= 0) return;

        const dayOfWeek = day.getDay();
        let matches = false;
        if (meeting.repeat === 'daily' && dayOfWeek >= 1 && dayOfWeek <= 5) {
          matches = true;
        } else if (meeting.repeat === 'weekly' && day.getDay() === origin.getDay()) {
          matches = true;
        } else if (meeting.repeat === 'biweekly' && day.getDay() === origin.getDay()) {
          matches = Math.round(diffDays / 7) % 2 === 0;
        }

        if (matches) {
          const ghostId = meeting.id + '_' + dayKey;
          if (!existingIds.has(ghostId) && !result[dayKey]?.some(m => m.sourceId === meeting.id || m.id === ghostId)) {
            result[dayKey] = result[dayKey] || [];
            result[dayKey].push({
              ...meeting, id: ghostId, sourceId: meeting.id, sourceDate: originDate, _recurring: true,
            });
          }
        }
      });
    }
  }
  return result;
}

export function getMeetingsForDay(meetingsByDate, day) {
  const map = expandRecurringMeetings(meetingsByDate, [day]);
  const list = map[fmtDate(day)] || [];
  return [...list].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

/** End timestamp of a meeting on `date`, or null if it has no start time. */
export function meetingEndMs(date, meeting) {
  if (!meeting?.time) return null;
  const [h, m] = String(meeting.time).split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  const start = new Date(date);
  start.setHours(h, Number.isFinite(m) ? m : 0, 0, 0);
  const dur = parseInt(meeting.duration, 10);
  const mins = Number.isFinite(dur) && dur > 0 ? dur : 30;
  return start.getTime() + mins * 60 * 1000;
}

/** True once the meeting's day is over, or today's slot has ended. */
export function isMeetingOver(date, meeting, now = Date.now()) {
  const day = date instanceof Date ? new Date(date) : new Date(String(date) + 'T00:00:00');
  day.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (day < today) return true;
  if (day > today) return false;
  const end = meetingEndMs(day, meeting);
  if (end == null) return false;
  return now >= end;
}
