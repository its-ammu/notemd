import React, { useEffect, useRef, useState } from 'react';
import FixedContextMenu from '../../shared/components/FixedContextMenu';
import { IconCheck, IconPlus } from '../../shared/components/Doodles';

const rowKey = (c) => c.id || 'default';
const MENU_WIDTH = 252; // matches .nmd-cal-menu

/* The pill at the right of the tracker header that says which calendar you're looking at,
   and the menu behind it: switch, add, rename, remove. */
export default function CalendarSwitcher({ calendars, showToast }) {
  const [pos, setPos] = useState(null);         // menu anchor, null = closed
  const [editing, setEditing] = useState(null); // rowKey of the calendar being edited
  const [draftName, setDraftName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null); // { id, after }
  const btnRef = useRef(null);
  const open = pos !== null;

  const close = () => {
    setPos(null);
    setEditing(null);
    setCreating(false);
    setNewName('');
  };

  const toggle = () => {
    if (open) return close();
    const r = btnRef.current.getBoundingClientRect();
    // The button sits at the right edge of the header, so line the menu's
    // right edge up with it (FixedContextMenu keeps it on screen).
    setPos({ x: r.right - MENU_WIDTH, y: r.bottom + 6 });
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (e.target.closest?.('.nmd-cal-menu')) return;
      close();
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Esc backs out one step at a time: the open form first, then the menu.
      if (editing) setEditing(null);
      else if (creating) { setCreating(false); setNewName(''); }
      else { close(); btnRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open, editing, creating]);

  const startEdit = (c) => {
    if (editing === rowKey(c)) return setEditing(null);
    setCreating(false);
    setDraftName(c.name);
    setEditing(rowKey(c));
  };

  const commitName = (c) => {
    const name = draftName.trim();
    if (name && name !== c.name) calendars.update(c.id, { name });
    else setDraftName(c.name);
  };

  const submitNew = () => {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    calendars.create(name);
    close();
  };

  const remove = (c) => {
    const { tasks, meetings } = calendars.count(c.id);
    const home = calendars.byId(null).name;
    const n = tasks + meetings;
    const undo = calendars.remove(c.id);
    setEditing(null);
    showToast?.(`Removed "${c.name}"` + (n ? ` — ${n} ${n === 1 ? 'item' : 'items'} moved to ${home}` : ''), {
      action: { label: 'Undo', onClick: undo },
    });
  };

  const { active, list, multiple, viewingAll } = calendars;

  // Where a dragged calendar should land relative to the row under the pointer.
  const dropBefore = (id, after) => {
    if (!after) return id;
    const i = list.findIndex(c => c.id === id);
    return list[i + 1]?.id || null;
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={'nmd-cal-switch' + (open ? ' open' : '')}
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        title="Switch calendar"
      >
        <span className="nmd-cal-switch-name">{active.name}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <FixedContextMenu x={pos.x} y={pos.y} className="nmd-menu nmd-cal-menu">
          <div className="nmd-menu-label">Calendars</div>
          {multiple && (
            <div className={'nmd-cal-row' + (viewingAll ? ' active' : '')}>
              <span className="nmd-cal-grip is-pin" aria-hidden="true" />
              <button
                type="button"
                className="nmd-cal-pick"
                onClick={() => { calendars.setActiveId('all'); close(); }}
                aria-current={viewingAll ? 'true' : undefined}
              >
                <span className="nmd-cal-name">All calendars</span>
                {viewingAll && <IconCheck size={12} className="nmd-cal-check" />}
              </button>
            </div>
          )}
          {list.map(c => {
            const isActive = c.id === calendars.activeId;
            const isEditing = editing === rowKey(c);
            return (
              <div key={rowKey(c)} className="nmd-cal-item">
                <div
                  className={'nmd-cal-row' + (isActive ? ' active' : '')
                    + (over?.id === c.id ? (over.after ? ' drop-after' : ' drop-before') : '')}
                  onDragOver={e => {
                    if (!dragId || c.isDefault || dragId === c.id) return;
                    e.preventDefault();
                    const after = e.clientY > e.currentTarget.getBoundingClientRect().top + e.currentTarget.offsetHeight / 2;
                    setOver({ id: c.id, after });
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    if (dragId && over) calendars.reorder(dragId, dropBefore(over.id, over.after));
                    setDragId(null);
                    setOver(null);
                  }}
                >
                  {c.isDefault && multiple && <span className="nmd-cal-grip is-pin" aria-hidden="true" />}
                  {!c.isDefault && (
                    <span
                      className="nmd-cal-grip"
                      draggable
                      title="Drag to reorder"
                      aria-label={`Reorder ${c.name}`}
                      onDragStart={e => {
                        e.dataTransfer.setData('text/plain', c.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(c.id);
                      }}
                      onDragEnd={() => { setDragId(null); setOver(null); }}
                    >
                      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
                        <circle cx="3" cy="2.5" r="1" /><circle cx="7" cy="2.5" r="1" />
                        <circle cx="3" cy="7" r="1" /><circle cx="7" cy="7" r="1" />
                        <circle cx="3" cy="11.5" r="1" /><circle cx="7" cy="11.5" r="1" />
                      </svg>
                    </span>
                  )}
                  <button
                    type="button"
                    className="nmd-cal-pick"
                    onClick={() => { calendars.setActiveId(c.id); close(); }}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <span className="nmd-cal-name">{c.name}</span>
                    {isActive && <IconCheck size={12} className="nmd-cal-check" />}
                  </button>
                  <button
                    type="button"
                    className={'nmd-cal-edit' + (isEditing ? ' on' : '')}
                    onClick={() => startEdit(c)}
                    title={c.isDefault ? 'Rename' : 'Rename or remove'}
                    aria-label={`Edit ${c.name}`}
                    aria-expanded={isEditing}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="m13.5 6.5 4 4" />
                    </svg>
                  </button>
                </div>

                {isEditing && (
                  <div className="nmd-cal-editor">
                    <div className="nmd-inline-form">
                      <input
                        autoFocus
                        value={draftName}
                        maxLength={40}
                        aria-label="Calendar name"
                        placeholder="Calendar name"
                        onChange={e => setDraftName(e.target.value)}
                        onBlur={() => commitName(c)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { commitName(c); setEditing(null); }
                        }}
                      />
                    </div>
                    {!c.isDefault && (
                      <button type="button" className="danger" onClick={() => remove(c)}>
                        Remove calendar
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <hr />
          {creating ? (
            <div className="nmd-inline-form">
              <input
                autoFocus
                value={newName}
                maxLength={40}
                aria-label="New calendar name"
                placeholder="Name it — work, family, side project…"
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitNew(); }}
                onBlur={() => { if (!newName.trim()) setCreating(false); }}
              />
            </div>
          ) : (
            <button type="button" onClick={() => { setEditing(null); setCreating(true); }}>
              <IconPlus size={12} />
              New calendar
            </button>
          )}
        </FixedContextMenu>
      )}
    </>
  );
}
