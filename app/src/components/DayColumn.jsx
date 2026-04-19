import React, { useState } from 'react';
import Task from './Task';
import { DAY_NAMES } from '../utils/constants';

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

const REPEAT_LABELS = { none: null, daily: 'M-F', weekly: 'wk', biweekly: '2wk' };

function MeetingCard({ meeting, onClick }) {
  return (
    <div className="nmd-meeting" onClick={onClick}>
      <div className="nmd-meeting-row">
        <svg className="nmd-meeting-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span className="nmd-meeting-title">{meeting.title}</span>
      </div>
      <div className="nmd-meeting-meta">
        {meeting.time && <span>{fmtTime(meeting.time)}</span>}
        {meeting.duration && <span>{fmtDuration(meeting.duration)}</span>}
        {meeting.repeat && meeting.repeat !== 'none' && (
          <span className="nmd-meeting-repeat-badge">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
            {REPEAT_LABELS[meeting.repeat]}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DayColumn({ dayIdx, date, tasks, meetings, isToday, isWeekend, onAddTask, onUpdateTask, onDeleteTask, onDropTask, onDragStart, onDragEnd, draggingId, showToast, onEditTask, onAddMeeting, onEditMeeting }) {
  const [adding, setAdding] = useState(false);
  const [addText, setAddText] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const submitAdd = () => {
    const t = addText.trim();
    if (t) onAddTask(t);
    setAddText('');
    setAdding(false);
  };

  const copyDay = () => {
    const dayLabel = DAY_NAMES[dayIdx] + ' ' + date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const lines = [dayLabel];

    // Tasks
    if (tasks.length > 0) {
      lines.push('', 'Tasks:');
      tasks.forEach(t => {
        const subs = t.subtasks.map(s => `    - ${s.text}`);
        lines.push(`- ${t.title}${subs.length ? '\n' + subs.join('\n') : ''}`);
      });
    }

    // Meetings
    if (meetings.length > 0) {
      lines.push('', 'Meetings:');
      meetings.forEach(m => {
        const timeStr = m.time ? fmtTime(m.time) : '';
        const durStr = m.duration ? ` (${fmtDuration(m.duration)})` : '';
        lines.push(`- ${timeStr ? timeStr + ' ' : ''}${m.title}${durStr}`);
        if (m.notes) lines.push(`  ${m.notes}`);
      });
    }

    if (tasks.length === 0 && meetings.length === 0) {
      lines.push('(no entries)');
    }

    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      showToast(`Copied ${DAY_NAMES[dayIdx]}'s entries`);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const dateNum = date.getDate();
  const monthLetter = date.toLocaleDateString(undefined, { month: 'short' }).toLowerCase();
  const sortedMeetings = [...meetings].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  return (
    <div
      className={'nmd-day' + (isToday ? ' today' : '') + (isWeekend ? ' weekend' : '') + (dragOver ? ' drop-target' : '')}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDropTask(id);
      }}
    >
      <div className="nmd-day-header">
        <div className="nmd-day-labels">
          <span className="nmd-day-name">{DAY_NAMES[dayIdx]}</span>
          <span className="nmd-day-num">
            {dateNum}
            <span style={{ fontSize: 11, color: 'var(--fg4)', fontWeight: 400, marginLeft: 4, fontFamily: 'var(--font-mono)' }}>{monthLetter}</span>
          </span>
        </div>
        <div className="nmd-day-actions">
          <button
            className={'nmd-day-btn' + (copied ? ' copied' : '')}
            title="Copy entries (for timesheet)"
            onClick={copyDay}
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12l5 5L20 6" /></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="8" y="8" width="12" height="12" rx="2" />
                <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
              </svg>
            )}
          </button>
          <button className="nmd-day-btn" title="New task" onClick={() => setAdding(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </div>

      {/* Tasks section */}
      <div className="nmd-day-body">
        {tasks.length === 0 && meetings.length === 0 && !adding && (
          <div className="nmd-day-empty">Nothing planned.</div>
        )}
        {tasks.map(t => (
          <Task
            key={t.id}
            task={t}
            onUpdate={(patch) => onUpdateTask(t.id, patch)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            dragging={draggingId === t.id}
            onEdit={onEditTask}
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
          <button className="nmd-add-task" onClick={() => setAdding(true)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
            Add task
          </button>
        )}
      </div>

      {/* Meetings section */}
      <div className="nmd-day-meetings">
        <div className="nmd-meetings-divider">
          <span className="nmd-meetings-label">Meetings</span>
          <button className="nmd-day-btn" title="Add meeting" onClick={onAddMeeting} style={{ width: 20, height: 20 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
        {sortedMeetings.map(m => (
          <MeetingCard key={m.id} meeting={m} onClick={() => onEditMeeting(m.id)} />
        ))}
        {sortedMeetings.length === 0 && (
          <button className="nmd-add-meeting-btn" onClick={onAddMeeting}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Add meeting
          </button>
        )}
      </div>
    </div>
  );
}
