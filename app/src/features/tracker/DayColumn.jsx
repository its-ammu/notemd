import React, { useState } from 'react';
import Task from './Task';
import { DAY_NAMES } from '../../shared/utils/constants';

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

function fmtDuration(d) {
  const n = parseInt(d, 10);
  if (n < 60) return `${n}m`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}

export default function DayColumn({ date, tasks, meetings, isToday, isWeekend, onAddTask, onUpdateTask, onDropTask, onDragStart, onDragEnd, draggingId, showToast, onEditTask, onStartPomodoro, onDuplicate }) {
  const [adding, setAdding] = useState(false);
  const [addText, setAddText] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropInfo, setDropInfo] = useState(null); // { id, edge: 'top' | 'bottom' }

  // Where a task dropped onto `targetIdx` should land: before it (top half) or
  // after it (bottom half). Returns the id of the task to insert in front of,
  // or null for the end of the day.
  const dropTargetBeforeId = (e, targetIdx) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    const insertIdx = after ? targetIdx + 1 : targetIdx;
    return tasks[insertIdx] ? tasks[insertIdx].id : null;
  };

  const submitAdd = () => {
    const t = addText.trim();
    if (t) onAddTask(t);
    setAddText('');
    setAdding(false);
  };

  const copyDay = () => {
    const dow = date.getDay();
    const dayNameIndex = dow === 0 ? 6 : dow - 1;
    const dayLabel = DAY_NAMES[dayNameIndex] + ' ' + date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const lines = [dayLabel];

    if (tasks.length > 0) {
      lines.push('', 'Tasks:');
      tasks.forEach(t => {
        const subs = t.subtasks.map(s => `    - ${s.text}`);
        lines.push(`- ${t.title}${subs.length ? '\n' + subs.join('\n') : ''}`);
      });
    }

    if (meetings && meetings.length > 0) {
      lines.push('', 'Meetings:');
      meetings.forEach(m => {
        const timeStr = m.time ? fmtTime(m.time) : '';
        const durStr = m.duration ? ` (${fmtDuration(m.duration)})` : '';
        lines.push(`- ${timeStr ? timeStr + ' ' : ''}${m.title}${durStr}`);
        if (m.notes) lines.push(`  ${m.notes}`);
      });
    }

    if (tasks.length === 0 && (!meetings || meetings.length === 0)) {
      lines.push('(no entries)');
    }

    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      showToast(`Copied ${DAY_NAMES[dayNameIndex]}'s entries`);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const dateNum = date.getDate();
  const dayOfWeek = date.getDay();
  const dayNameIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const meetingCount = meetings ? meetings.length : 0;

  return (
    <div
      className={'nmd-day' + (isToday ? ' today' : '') + (isWeekend ? ' weekend' : '') + (dragOver ? ' drop-target' : '') + (draggingId ? ' is-dragging' : '')}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true); }}
      onDragLeave={e => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setDragOver(false);
        setDropInfo(null);
      }}
      onDrop={e => {
        if (e.target.closest('.nmd-task, .nmd-add-task, .nmd-add-task-input')) return;
        e.preventDefault();
        setDragOver(false);
        setDropInfo(null);
        const id = e.dataTransfer.getData('text/plain') || draggingId;
        if (id) onDropTask(id, null);
      }}
    >
      <div className="nmd-day-header">
        <div className="nmd-day-labels">
          <span className="nmd-day-name">{DAY_NAMES[dayNameIdx]}</span>
          <span className="nmd-day-num">{dateNum}</span>
        </div>
        <div className="nmd-day-actions">
          <button
            className={'nmd-day-btn' + (copied ? ' copied' : '')}
            title="Copy entries"
            onClick={copyDay}
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12l5 5L20 6" /></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="8" y="8" width="12" height="12" rx="2" />
                <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
              </svg>
            )}
          </button>
          {meetingCount > 0 && (
            <span className="nmd-day-mtg-chip" title={`${meetingCount} meeting${meetingCount !== 1 ? 's' : ''}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {meetingCount}
            </span>
          )}
        </div>
      </div>

      <div className="nmd-day-body">
        {tasks.length === 0 && !adding && (
          <div className="nmd-day-empty">—</div>
        )}
        {tasks.map((t, idx) => (
          <Task
            key={t.id}
            task={t}
            onUpdate={(patch) => onUpdateTask(t.id, patch)}
            onDragStart={onDragStart}
            onDragEnd={() => { onDragEnd(); setDropInfo(null); }}
            dragging={draggingId === t.id}
            dropEdge={dropInfo && dropInfo.id === t.id ? dropInfo.edge : null}
            onTaskDragOver={e => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              setDragOver(false);
              const rect = e.currentTarget.getBoundingClientRect();
              const after = e.clientY > rect.top + rect.height / 2;
              setDropInfo({ id: t.id, edge: after ? 'bottom' : 'top' });
            }}
            onTaskDrop={e => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
              setDropInfo(null);
              const id = e.dataTransfer.getData('text/plain') || draggingId;
              if (id) onDropTask(id, dropTargetBeforeId(e, idx));
            }}
            onEdit={onEditTask}
            onStartPomodoro={onStartPomodoro}
            onDuplicate={onDuplicate}
          />
        ))}
        {adding ? (
          <input
            autoFocus
            className="nmd-add-task-input"
            placeholder="What needs doing?"
            value={addText}
            onChange={e => setAddText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitAdd();
              if (e.key === 'Escape') { setAdding(false); setAddText(''); }
            }}
            onBlur={submitAdd}
          />
        ) : (
          <button
            className={'nmd-add-task' + (dropInfo?.id === '__end__' ? ' drop-target' : '')}
            onClick={() => setAdding(true)}
            onDragOver={e => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
              setDragOver(false);
              setDropInfo({ id: '__end__', edge: 'bottom' });
            }}
            onDrop={e => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
              setDropInfo(null);
              const id = e.dataTransfer.getData('text/plain') || draggingId;
              if (id) onDropTask(id, null);
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
            Add task
          </button>
        )}
      </div>
    </div>
  );
}
