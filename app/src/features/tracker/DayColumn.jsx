import React, { useEffect, useState } from 'react';
import Task from './Task';
import DayTimeline from './DayTimeline';
import { DAY_NAMES } from '../../shared/utils/constants';
import EmptyState from '../../shared/components/EmptyState';
import {
  DoodleClockMini, DoodleClockAdd, IconCopy, IconCheck, IconPlus,
  DoodleMug, DoodlePlant, DoodlePlane, DoodleNote, DoodleSun, DoodleMoon,
} from '../../shared/components/Doodles';
import { isMeetingOver } from './meetings';

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

/* A faint doodle for an empty day in the week grid — a different one for each
   weekday so a quiet week reads as a sketchbook margin, not a row of blanks. */
const EMPTY_DAY_DOODLES = [
  { Doodle: DoodleMug, label: 'coffee first' },      // Mon
  { Doodle: DoodlePlant, label: 'room to grow' },    // Tue
  { Doodle: DoodlePlane, label: 'clear skies' },     // Wed
  { Doodle: DoodleNote, label: 'put a record on' },  // Thu
  { Doodle: DoodleSun, label: 'sunny outlook' },     // Fri
  { Doodle: DoodleSun, label: 'all yours' },         // Sat
  { Doodle: DoodleMoon, label: 'rest up' },          // Sun
];

/* Case transform for copied text, per the user's copy settings. */
function applyCase(text, mode) {
  if (mode === 'lower') return text.toLowerCase();
  if (mode === 'upper') return text.toUpperCase();
  if (mode === 'title') return text.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
  return text;
}

function EmptyDay({ dayIdx }) {
  const { Doodle, label } = EMPTY_DAY_DOODLES[dayIdx];
  return (
    <div className="nmd-day-empty-art" aria-label={`Nothing planned — ${label}`} role="img">
      <Doodle size={44} />
      <span className="nmd-day-empty-label">{label}</span>
    </div>
  );
}

export default function DayColumn({ date, tasks, meetings, showMeetings = true, timeline = false, calendarName = null, seedAdd = false, onSeedAddHandled, isToday, isWeekend, onAddTask, onUpdateTask, onDropTask, onDragStart, onDragEnd, draggingId, showToast, onEditTask, onEditMeeting, onAddMeeting, onStartPomodoro, onDuplicate, onMoveTaskTomorrow, onDeleteTask, copyPrefs = {}, now }) {
  const [adding, setAdding] = useState(false);
  const [addText, setAddText] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropInfo, setDropInfo] = useState(null); // { id, edge: 'top' | 'bottom' }

  useEffect(() => {
    if (!seedAdd) return;
    setAdding(true);
    onSeedAddHandled?.();
  }, [seedAdd]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const titleOnly = copyPrefs.meetingDetails === 'title';
      meetings.forEach(m => {
        if (titleOnly) {
          lines.push(`- ${m.title}`);
          return;
        }
        const timeStr = m.time ? fmtTime(m.time) : '';
        const durStr = m.duration ? ` (${fmtDuration(m.duration)})` : '';
        lines.push(`- ${timeStr ? timeStr + ' ' : ''}${m.title}${durStr}`);
        if (m.notes) lines.push(`  ${m.notes}`);
      });
    }

    if (tasks.length === 0 && (!meetings || meetings.length === 0)) {
      lines.push('(no entries)');
    }

    const text = applyCase(lines.join('\n'), copyPrefs.textCase);
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
  const doneCount = tasks.filter(t => t.done).length;

  const taskList = (
    <>
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
          calendarName={calendarName ? calendarName(t) : null}
          onStartPomodoro={onStartPomodoro}
          onDuplicate={onDuplicate}
          onMoveTomorrow={onMoveTaskTomorrow}
          onDelete={onDeleteTask}
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
          <IconPlus />
          Add task
        </button>
      )}
    </>
  );

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
          {!(timeline && showMeetings) && (
            <button className="nmd-day-btn" title="Add meeting" onClick={() => onAddMeeting()}>
              <DoodleClockAdd size={15} />
            </button>
          )}
          <button
            className={'nmd-day-btn' + (copied ? ' copied' : '')}
            title="Copy entries"
            onClick={copyDay}
          >
            {copied ? <IconCheck /> : <IconCopy />}
          </button>
        </div>
      </div>

      {timeline ? (
        <div className={'nmd-day-body nmd-day-split' + (showMeetings ? '' : ' tasks-only')}>
          <section className="nmd-day-pane nmd-day-pane-tasks" aria-label="Tasks">
            <div className="nmd-day-pane-head">
              <h3 className="nmd-day-pane-title">Tasks</h3>
              {tasks.length > 0 && (
                <span className="nmd-day-pane-count"><b>{doneCount}</b>/{tasks.length} done</span>
              )}
            </div>
            <div className="nmd-day-pane-body">
              {tasks.length === 0 && !adding && (
                <EmptyState type="dayTasks" compact />
              )}
              {taskList}
            </div>
          </section>
          {showMeetings && (
            <section className="nmd-day-pane nmd-day-pane-schedule" aria-label="Schedule">
              <div className="nmd-day-pane-head">
                <h3 className="nmd-day-pane-title">Schedule</h3>
                {meetingCount > 0 && (
                  <span className="nmd-day-pane-count"><b>{meetingCount}</b> {meetingCount === 1 ? 'meeting' : 'meetings'}</span>
                )}
                <button type="button" className="nmd-day-pane-add" onClick={() => onAddMeeting()} title="Add meeting" aria-label="Add meeting">
                  <IconPlus />
                </button>
              </div>
              <div className="nmd-day-pane-body">
                {meetingCount === 0 && (
                  <div className="nmd-day-pane-empty">No meetings. Suspiciously peaceful. Click an hour to add one.</div>
                )}
                <DayTimeline date={date} meetings={meetings || []} now={now} onEdit={onEditMeeting} onAddAt={(time) => onAddMeeting(time)} calendarName={calendarName} />
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="nmd-day-body">
          {tasks.length === 0 && (meetingCount === 0 || !showMeetings) && !adding && (
            <EmptyDay dayIdx={dayNameIdx} />
          )}
          {showMeetings && meetingCount > 0 && (
            <div className="nmd-day-meetings">
              {[...meetings]
                .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
                .map((m) => (
                  <button
                    key={m.id}
                    className={'nmd-day-meeting' + (calendarName ? ' has-cal' : '') + (isMeetingOver(date, m, now) ? ' done' : '')}
                    onClick={() => onEditMeeting(m.id)}
                    title={m.title + (m.time ? ` · ${fmtTime(m.time)}` : '') + (m.duration ? ` (${fmtDuration(m.duration)})` : '')}
                  >
                    <span className="nmd-day-meeting-line">
                      <DoodleClockMini size={14} className="nmd-day-meeting-clock" />
                      <span className="nmd-day-meeting-title">{m.title}</span>
                      {!calendarName && m.time && <span className="nmd-day-meeting-time">{fmtTime(m.time)}</span>}
                    </span>
                    {calendarName && (
                      <span className="nmd-day-meeting-meta">
                        {m.time && <span className="nmd-day-meeting-time">{fmtTime(m.time)}</span>}
                        <span className="nmd-cal-tag">{calendarName(m)}</span>
                      </span>
                    )}
                  </button>
                ))}
            </div>
          )}
          {taskList}
        </div>
      )}
    </div>
  );
}
