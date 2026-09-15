import React, { useState } from 'react';
import { PRIO } from '../utils/constants';
import TaskContextMenu from './TaskContextMenu';

export default function Task({ task, onUpdate, onDragStart, onDragEnd, dragging, onEdit, onStartPomodoro, onDuplicate, onTaskDragOver, onTaskDrop, dropEdge }) {
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
  const cls = 'nmd-task ' + PRIO[task.priority || 'none'].cls + (task.done ? ' done' : '') + (dragging ? ' dragging' : '')
    + (dropEdge === 'top' ? ' drop-before' : dropEdge === 'bottom' ? ' drop-after' : '');

  return (
    <div
      className={cls}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={onTaskDragOver}
      onDrop={onTaskDrop}
      onClick={() => onEdit(task.id)}
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
          <span className="nmd-task-title-text">{task.title}</span>
        </div>
        {hasSubs && <span className="nmd-task-progress">{doneCount}/{task.subtasks.length}</span>}
      </div>
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
          onClose={() => setMenuPos(null)}
        />
      )}
    </div>
  );
}
