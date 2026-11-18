import React, { useEffect, useRef, useState } from 'react';
import { PRIO } from '../../shared/utils/constants';
import TaskContextMenu from './TaskContextMenu';

export default function Task({ task, onUpdate, onDragStart, onDragEnd, dragging, onEdit, onStartPomodoro, onDuplicate, onTaskDragOver, onTaskDrop, dropEdge, calendarName = null, onMoveTomorrow, onDelete }) {
  const doneCount = task.subtasks.filter(s => s.done).length;
  const hasSubs = task.subtasks.length > 0;
  const toggleDone = (e) => {
    e.stopPropagation();
    if (hasSubs && !task.done) {
      onUpdate({ done: true, subtasks: task.subtasks.map(s => ({ ...s, done: true })) });
    } else if (hasSubs && task.done) {
      onUpdate({ done: false, subtasks: task.subtasks.map(s => ({ ...s, done: false })) });
    } else {
      onUpdate({ done: !task.done });
    }
  };

  const updateSubtask = (id, patch, e) => {
    if (e) e.stopPropagation();
    const subs = task.subtasks.map(s => s.id === id ? { ...s, ...patch } : s);
    const allDone = subs.length > 0 && subs.every(s => s.done);
    onUpdate({ subtasks: subs, done: allDone });
  };

  const [menuPos, setMenuPos] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title || '');
  const clickTimer = useRef(null);
  const skipCommit = useRef(false);

  // Touch screens: press and hold opens the same menu as a right-click,
  // since drag-and-drop and right-click don't exist there.
  const press = useRef(null); // { timer, x, y, fired }
  const cancelPress = () => { if (press.current) clearTimeout(press.current.timer); };
  const onTouchStart = (e) => {
    if (editing || e.touches.length !== 1) return;
    const { clientX: x, clientY: y } = e.touches[0];
    cancelPress();
    press.current = {
      x, y, fired: false,
      timer: setTimeout(() => {
        press.current.fired = true;
        navigator.vibrate?.(10);
        setMenuPos({ x, y });
      }, 480),
    };
  };
  const onTouchMove = (e) => {
    const p = press.current;
    if (!p) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - p.x) > 8 || Math.abs(t.clientY - p.y) > 8) cancelPress();
  };

  useEffect(() => () => { clearTimeout(clickTimer.current); cancelPress(); }, []);

  const startRename = (e) => {
    e.stopPropagation();
    e.preventDefault();
    clearTimeout(clickTimer.current);
    setDraft(task.title || '');
    setEditing(true);
  };
  const commitRename = () => {
    if (skipCommit.current) { skipCommit.current = false; return; }
    const title = draft.trim();
    setEditing(false);
    if (title && title !== task.title) onUpdate({ title });
  };
  const cancelRename = (e) => {
    e.stopPropagation();
    skipCommit.current = true;
    setEditing(false);
  };
  const open = () => {
    clearTimeout(clickTimer.current);
    // Wait briefly so a double-click can rename instead of opening the dialog.
    clickTimer.current = setTimeout(() => onEdit(task.id), 220);
  };
  const cls = 'nmd-task ' + PRIO[task.priority || 'none'].cls + (task.done ? ' done' : '') + (dragging ? ' dragging' : '')
    + (dropEdge === 'top' ? ' drop-before' : dropEdge === 'bottom' ? ' drop-after' : '');

  return (
    <div
      className={cls}
      draggable={!editing}
      tabIndex={editing ? -1 : 0}
      onKeyDown={(e) => {
        if (editing) return;
        if (e.key === 'Enter') { e.preventDefault(); onEdit(task.id); }
      }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={onTaskDragOver}
      onDrop={onTaskDrop}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={(e) => {
        cancelPress();
        // A hold that opened the menu shouldn't also open the dialog.
        if (press.current?.fired) { e.preventDefault(); press.current = null; }
      }}
      onTouchCancel={cancelPress}
      onClick={() => { if (!editing) open(); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenuPos({ x: e.clientX, y: e.clientY }); }}
      style={{ cursor: 'pointer' }}
    >
      <div className="nmd-task-row">
        <button
          className={'nmd-check' + (task.done ? ' checked' : '')}
          onClick={toggleDone}
          title={task.done ? 'Mark not done' : 'Mark done'}
          style={{ cursor: 'pointer' }}
        >
          {task.done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 12l5 5L20 6" /></svg>}
        </button>
        <div className="nmd-task-title">
          {editing ? (
            <input
              autoFocus
              className="nmd-task-rename"
              value={draft}
              aria-label="Task name"
              onChange={e => setDraft(e.target.value)}
              onClick={e => e.stopPropagation()}
              onDoubleClick={e => e.stopPropagation()}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                if (e.key === 'Escape') cancelRename(e);
              }}
            />
          ) : (
            <span className="nmd-task-title-text" onDoubleClick={startRename}>{task.title}</span>
          )}
        </div>
        {hasSubs && <span className="nmd-task-progress">{doneCount}/{task.subtasks.length}</span>}
      </div>
      {calendarName && <span className="nmd-cal-tag nmd-task-cal">{calendarName}</span>}
      {hasSubs && (
        <div className="nmd-subtasks">
          {task.subtasks.map(s => (
            <div key={s.id} className={'nmd-subtask' + (s.done ? ' done' : '')}>
              <button
                className={'nmd-check' + (s.done ? ' checked' : '')}
                onClick={(e) => updateSubtask(s.id, { done: !s.done }, e)}
              >
                {s.done && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 12l5 5L20 6" /></svg>}
              </button>
              <span className="nmd-subtask-text">{s.text}</span>
            </div>
          ))}
        </div>
      )}
      {menuPos && (
        <TaskContextMenu
          x={menuPos.x}
          y={menuPos.y}
          onStartPomodoro={(workSecs, breakSecs) => onStartPomodoro?.(task, workSecs, breakSecs)}
          onDuplicate={() => onDuplicate?.(task)}
          onMoveTomorrow={onMoveTomorrow ? () => onMoveTomorrow(task.id) : undefined}
          onDelete={onDelete ? () => onDelete(task.id) : undefined}
          onClose={() => setMenuPos(null)}
        />
      )}
    </div>
  );
}
