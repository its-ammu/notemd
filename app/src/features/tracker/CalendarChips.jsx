import React from 'react';

/* One chip per calendar — picks which calendar a task or meeting belongs to. */
export default function CalendarChips({ calendars, value, onChange }) {
  return (
    <div className="nmd-cal-chips" role="radiogroup" aria-label="Calendar">
      {calendars.list.map(c => {
        const on = c.id === (value || null);
        return (
          <button
            key={c.id || 'default'}
            type="button"
            role="radio"
            aria-checked={on}
            className={'nmd-cal-chip' + (on ? ' active' : '')}
            onClick={() => { if (!on) onChange(c.id); }}
          >
            <span className="nmd-cal-chip-name">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
