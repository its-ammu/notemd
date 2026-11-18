import React, { useEffect, useRef, useState } from 'react';
import FixedContextMenu from '../../shared/components/FixedContextMenu';
import { IconCheck } from '../../shared/components/Doodles';

/* A compact "which calendar?" picker for forms: a button showing the chosen
   calendar that opens the same menu the tracker's switcher uses. Stands in for
   a native <select>, which can't be themed. */
export default function CalendarSelect({ calendars, value, onChange, className = '' }) {
  const [pos, setPos] = useState(null); // menu anchor, null = closed
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const open = pos !== null;
  const current = calendars.byId(value);

  const toggle = () => {
    if (open) return setPos(null);
    const r = btnRef.current.getBoundingClientRect();
    setPos({ x: r.left, y: r.bottom + 6 });
  };

  useEffect(() => {
    if (!open) return;
    // Land on the chosen calendar so the arrow keys and Enter work straight away.
    menuRef.current?.querySelector('[aria-checked="true"]')?.focus();
    const close = () => setPos(null);
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        btnRef.current?.focus();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = [...(menuRef.current?.querySelectorAll('button') || [])];
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items[(i + step + items.length) % items.length].focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const pick = (id) => {
    onChange(id);
    setPos(null);
    btnRef.current?.focus();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={'nmd-cal-select' + (open ? ' open' : '') + (className ? ' ' + className : '')}
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Calendar: ${current.name}`}
        title="Which calendar"
      >
        <span className="nmd-cal-switch-name">{current.name}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <FixedContextMenu x={pos.x} y={pos.y} className="nmd-menu nmd-cal-select-menu">
          <div ref={menuRef} role="radiogroup" aria-label="Calendar">
            <div className="nmd-menu-label">Add to</div>
            {calendars.list.map(c => {
              const on = c.id === current.id;
              return (
                <button
                  key={c.id || 'default'}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={on ? 'active' : ''}
                  onClick={() => pick(c.id)}
                >
                  <span className="nmd-cal-name">{c.name}</span>
                  {on && <IconCheck size={12} className="nmd-cal-check" />}
                </button>
              );
            })}
          </div>
        </FixedContextMenu>
      )}
    </>
  );
}
