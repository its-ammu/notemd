import React, { useState } from 'react';
import { fmtDate } from '../../shared/utils/time';
import { DAY_NAMES } from '../../shared/utils/constants';
import { DoodleClockMini } from '../../shared/components/Doodles';

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

function fmtDuration(d) {
  const n = parseInt(d, 10);
  if (!n) return '';
  if (n < 60) return `${n}m`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}

export default function MeetingsDrawer({ days, getMeetings, onAddMeeting, onEditMeeting }) {
  const [open, setOpen] = useState(false);

  const totalCount = days.reduce((acc, d) => acc + getMeetings(d).length, 0);

  return (
    <div className={'nmd-mtg-drawer' + (open ? ' open' : '')}>
      <button
        className="nmd-mtg-drawer-handle"
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Hide meetings' : 'Show meetings'}
      >
        <DoodleClockMini size={14} strokeWidth={1.9} />
        <span className="nmd-mtg-drawer-label">Meetings</span>
        {totalCount > 0 && <span className="nmd-mtg-drawer-count">{totalCount}</span>}
        <svg
          className="nmd-mtg-drawer-chev"
          width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d={open ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
        </svg>
      </button>

      {open && (
        <div className="nmd-mtg-drawer-body">
          {days.map(d => {
            const key = fmtDate(d);
            const mtgs = [...getMeetings(d)].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
            const dow = d.getDay();
            const dayNameIdx = dow === 0 ? 6 : dow - 1;
            return (
              <div key={key} className="nmd-mtg-drawer-day">
                <div className="nmd-mtg-drawer-day-head">
                  <span className="nmd-mtg-drawer-day-name">
                    {DAY_NAMES[dayNameIdx]} {d.getDate()}
                  </span>
                  <button
                    className="nmd-mtg-drawer-add"
                    onClick={() => onAddMeeting(key)}
                    aria-label="Add meeting"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </div>
                {mtgs.length === 0 ? (
                  <div className="nmd-mtg-drawer-empty">—</div>
                ) : (
                  <ul className="nmd-mtg-drawer-list">
                    {mtgs.map(m => (
                      <li key={m.id}>
                        <button
                          className="nmd-mtg-drawer-item"
                          onClick={() => onEditMeeting(key, m.id)}
                        >
                          {m.time && <span className="nmd-mtg-drawer-time">{fmtTime(m.time)}</span>}
                          <span className="nmd-mtg-drawer-title">{m.title || 'Untitled'}</span>
                          {m.duration && <span className="nmd-mtg-drawer-dur">{fmtDuration(m.duration)}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
