import React, { useMemo, useState } from 'react';
import { fmtDate, startOfWeek, addDays } from '../utils/time';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function DatePicker({ value, onChange, minKey }) {
  const [cursor, setCursor] = useState(() => {
    const base = value ? new Date(value + 'T00:00:00') : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const days = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(firstOfMonth);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = fmtDate(today);

  const shift = (delta) => {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + delta);
    setCursor(d);
  };

  return (
    <div className="nmd-dp">
      <div className="nmd-dp-header">
        <button className="nmd-dp-nav" type="button" onClick={() => shift(-1)} aria-label="Previous month">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
        </button>
        <span className="nmd-dp-label">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</span>
        <button className="nmd-dp-nav" type="button" onClick={() => shift(1)} aria-label="Next month">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>
      <div className="nmd-dp-weekdays">
        {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="nmd-dp-grid">
        {days.map((d) => {
          const key = fmtDate(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = key === todayKey;
          const isSelected = key === value;
          const disabled = minKey && key < minKey;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              className={
                'nmd-dp-day'
                + (inMonth ? '' : ' out')
                + (isToday ? ' today' : '')
                + (isSelected ? ' sel' : '')
              }
              onClick={() => onChange(key)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
