import React, { useEffect, useRef, useState } from 'react';
import { DoodleClockMini } from '../../shared/components/Doodles';
import { isMeetingOver } from './meetings';

const HOUR = 48;
const DEFAULT_START = 8;
const DEFAULT_END = 20;
const SNAP = 30; // minutes a click on the grid snaps to

function minutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

function clockLabel(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`;
}

/** "HH:MM" for a meeting's time field. */
function clockValue(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Side-by-side columns for meetings that overlap. */
function place(meetings) {
  const items = meetings.map(m => {
    const start = minutes(m.time);
    const dur = parseInt(m.duration, 10);
    const length = Number.isFinite(dur) && dur > 0 ? dur : 30;
    return { m, start, end: start + length, col: 0, cols: 1 };
  }).filter(i => i.start !== null).sort((a, b) => a.start - b.start || a.end - b.end);

  const colEnds = [];
  for (const item of items) {
    let col = colEnds.findIndex(end => end <= item.start);
    if (col < 0) { col = colEnds.length; colEnds.push(item.end); }
    else colEnds[col] = item.end;
    item.col = col;
  }

  let cluster = [];
  let clusterEnd = -1;
  const finish = () => {
    const n = Math.max(...cluster.map(i => i.col)) + 1;
    cluster.forEach(i => { i.cols = n; });
  };
  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) { finish(); cluster = []; clusterEnd = -1; }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (cluster.length) finish();
  return items;
}

/* Day view's meetings, laid on a clock instead of a flat list. The grid
   always renders (8am–8pm at minimum) so the day keeps its shape even when
   empty. Meetings with no time sit above the grid. */
export default function DayTimeline({ date, meetings, now, onEdit, onAddAt, calendarName }) {
  const gridRef = useRef(null);
  const [ghost, setGhost] = useState(null); // minutes of the hovered empty slot
  const untimed = meetings.filter(m => minutes(m.time) === null);
  const placed = place(meetings);

  let startH = DEFAULT_START;
  let endH = DEFAULT_END;
  for (const item of placed) {
    startH = Math.min(startH, Math.floor(item.start / 60));
    endH = Math.max(endH, Math.ceil(item.end / 60));
  }
  startH = Math.max(0, startH);
  endH = Math.min(24, Math.max(endH, startH + 1));
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);

  const today = new Date(now);
  const isToday = date.toDateString() === today.toDateString();
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const showNow = isToday && nowMin >= startH * 60 && nowMin <= endH * 60;

  // On opening a day, bring the useful part of the clock into view: the
  // current time today, otherwise the first meeting.
  const dayKey = date.toDateString();
  const focusMin = showNow ? nowMin : (placed[0]?.start ?? null);
  useEffect(() => {
    const grid = gridRef.current;
    const scroller = grid?.closest('.nmd-day-pane-body');
    if (!grid || !scroller || focusMin === null || scroller.scrollHeight <= scroller.clientHeight) return;
    const offset = grid.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const y = offset + ((focusMin - startH * 60) / 60) * HOUR;
    scroller.scrollTop = Math.max(0, y - scroller.clientHeight / 3);
  }, [dayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Minutes under the pointer, snapped to the half hour.
  const slotAt = (e) => {
    const rect = gridRef.current.getBoundingClientRect();
    const raw = startH * 60 + ((e.clientY - rect.top) / HOUR) * 60;
    const snapped = Math.floor(raw / SNAP) * SNAP;
    return Math.min(Math.max(snapped, startH * 60), endH * 60 - SNAP);
  };
  const onEmpty = (e) => e.target === gridRef.current || e.target.classList.contains('nmd-tl-hour');

  return (
    <div className="nmd-tl">
      {untimed.length > 0 && (
        <div className="nmd-tl-untimed">
          {untimed.map(m => (
            <button
              key={m.id}
              type="button"
              className={'nmd-day-meeting' + (isMeetingOver(date, m, now) ? ' done' : '')}
              onClick={() => onEdit(m.id)}
            >
              <DoodleClockMini size={14} className="nmd-day-meeting-clock" />
              <span className="nmd-day-meeting-title">{m.title}</span>
              {calendarName && <span className="nmd-cal-tag">{calendarName(m)}</span>}
            </button>
          ))}
        </div>
      )}
      <div
        ref={gridRef}
        className={'nmd-tl-grid' + (onAddAt ? ' can-add' : '')}
        style={{ height: hours.length * HOUR }}
        onMouseMove={onAddAt ? (e => setGhost(onEmpty(e) ? slotAt(e) : null)) : undefined}
        onMouseLeave={() => setGhost(null)}
        onClick={onAddAt ? (e => { if (onEmpty(e)) { setGhost(null); onAddAt(clockValue(slotAt(e))); } }) : undefined}
      >
        {hours.map((h, i) => (
          <div key={h} className="nmd-tl-hour" style={{ top: i * HOUR }}>
            <span>{clockLabel(h * 60)}</span>
          </div>
        ))}
        {ghost !== null && (
          <div className="nmd-tl-ghost" style={{ top: ((ghost - startH * 60) / 60) * HOUR, height: (SNAP / 60) * HOUR - 3 }} aria-hidden="true">
            + {clockLabel(ghost)}
          </div>
        )}
        {showNow && (
          <div className="nmd-tl-now" style={{ top: ((nowMin - startH * 60) / 60) * HOUR }} />
        )}
        {placed.map(item => {
          const top = ((item.start - startH * 60) / 60) * HOUR;
          const height = Math.max(38, ((item.end - item.start) / 60) * HOUR - 3);
          return (
            <button
              key={item.m.id}
              type="button"
              className={'nmd-tl-block' + (isMeetingOver(date, item.m, now) ? ' done' : '')}
              style={{
                top,
                height,
                left: `calc(${(item.col / item.cols) * 100}% + 2px)`,
                width: `calc(${100 / item.cols}% - 4px)`,
              }}
              onClick={() => onEdit(item.m.id)}
              title={`${item.m.title} · ${clockLabel(item.start)}–${clockLabel(item.end)}`}
            >
              <span className="nmd-tl-row">
                <DoodleClockMini size={13} className="nmd-day-meeting-clock" />
                <span className="nmd-tl-title">{item.m.title || 'Untitled meeting'}</span>
                {calendarName && <span className="nmd-cal-tag">{calendarName(item.m)}</span>}
              </span>
              <span className="nmd-tl-time">{clockLabel(item.start)} – {clockLabel(item.end)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
