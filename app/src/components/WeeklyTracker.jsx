import React, { useState, useEffect, useMemo } from 'react';
import DayColumn from './DayColumn';
import TaskDialog from './TaskDialog';
import MeetingDialog from './MeetingDialog';
import MeetingsDrawer from './MeetingsDrawer';
import { startOfWeek, addDays, fmtDate, fmtRange } from '../utils/time';
import { expandRecurringMeetings } from '../utils/meetings';
import { PRIO } from '../utils/constants';
import { HelpIcon } from './Tooltip';

export default function WeeklyTracker({ tasksByDate, setTasksByDate, meetingsByDate, setMeetingsByDate, showToast, notebooks, onNavigateToPage, onStartPomodoro, pomoStats, focusRequest, onFocusHandled }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [draggingId, setDraggingId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('nmd_tracker_mode') || 'full');
  const todayDow = new Date().getDay();
  const [dayOffset, setDayOffset] = useState(todayDow === 0 ? 6 : todayDow - 1);
  useEffect(() => { localStorage.setItem('nmd_tracker_mode', viewMode); }, [viewMode]);

  // Jump to a linked task/meeting (e.g. from a storyboard card badge):
  // navigate to its week/day and open the matching dialog.
  useEffect(() => {
    if (!focusRequest) return;
    const { dateKey, taskId, meetingId } = focusRequest;
    const d = new Date(dateKey + 'T00:00:00');
    setWeekStart(startOfWeek(d));
    const dow = d.getDay();
    if (viewMode === 'day') setDayOffset(dow === 0 ? 6 : dow - 1);
    // Weekend items aren't visible in workweek view; widen so the dialog can resolve.
    if (viewMode === 'workweek' && (dow === 0 || dow === 6)) setViewMode('full');
    if (taskId) setEditingTask({ dateKey, id: taskId });
    if (meetingId) setEditingMeeting({ dateKey, id: meetingId });
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const days =
    viewMode === 'day' ? [allDays[dayOffset]] :
    viewMode === 'workweek' ? allDays.slice(0, 5) :
    allDays;

  const expandedMeetings = useMemo(
    () => expandRecurringMeetings(meetingsByDate, days),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meetingsByDate, days.map(d => fmtDate(d)).join(',')]
  );

  const getTasks = (d) => tasksByDate[fmtDate(d)] || [];
  const getMeetings = (d) => expandedMeetings[fmtDate(d)] || [];

  // ── Task operations ──────────────────────────────────────────────

  const updateTasks = (dateKey, fn) => {
    setTasksByDate(prev => {
      const existing = prev[dateKey] || [];
      const next = fn(existing);
      if (next.length === 0) {
        const { [dateKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [dateKey]: next };
    });
  };

  const addTask = (dateKey, title) => {
    const t = { id: crypto.randomUUID(), title, done: false, priority: 'none', subtasks: [], created: Date.now() };
    updateTasks(dateKey, tasks => [...tasks, t]);
  };

  const updateTask = (dateKey, id, patch) => {
    updateTasks(dateKey, tasks => tasks.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const deleteTask = (dateKey, id) => {
    updateTasks(dateKey, tasks => tasks.filter(t => t.id !== id));
  };

  const duplicateTask = (dateKey, sourceTask) => {
    const copy = {
      ...sourceTask,
      id: crypto.randomUUID(),
      title: sourceTask.title,
      done: false,
      subtasks: (sourceTask.subtasks || []).map(s => ({ ...s, id: crypto.randomUUID(), done: false })),
      created: Date.now(),
    };
    updateTasks(dateKey, tasks => {
      const idx = tasks.findIndex(t => t.id === sourceTask.id);
      const next = [...tasks];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const moveTask = (taskId, toDateKey) => {
    let task = null, fromKey = null;
    for (const [k, list] of Object.entries(tasksByDate)) {
      const f = list.find(t => t.id === taskId);
      if (f) { task = f; fromKey = k; break; }
    }
    if (!task || fromKey === toDateKey) return;
    setTasksByDate(prev => {
      const next = { ...prev };
      const fromList = (next[fromKey] || []).filter(t => t.id !== taskId);
      if (fromList.length === 0) delete next[fromKey]; else next[fromKey] = fromList;
      next[toDateKey] = [...(next[toDateKey] || []), task];
      return next;
    });
  };

  // ── Meeting operations ───────────────────────────────────────────

  const addMeeting = (dateKey) => {
    setEditingMeeting({ dateKey, new: true });
  };

  const saveMeeting = (dateKey, id, patch) => {
    setMeetingsByDate(prev => {
      const next = { ...prev };
      const list = next[dateKey] || [];
      const existing = list.find(m => m.id === id);
      if (existing) {
        next[dateKey] = list.map(m => m.id === id ? { ...m, ...patch } : m);
      } else {
        next[dateKey] = [...list, { id, ...patch }];
      }
      return next;
    });
  };

  const updateRecurringSource = (sourceDate, sourceId, patch) => {
    setMeetingsByDate(prev => {
      const next = { ...prev };
      const list = next[sourceDate] || [];
      next[sourceDate] = list.map(m => m.id === sourceId ? { ...m, ...patch } : m);
      return next;
    });
  };

  const deleteMeeting = (dateKey, id) => {
    setMeetingsByDate(prev => {
      const next = { ...prev };
      const list = (next[dateKey] || []).filter(m => m.id !== id);
      if (list.length === 0) delete next[dateKey]; else next[dateKey] = list;
      return next;
    });
  };

  const skipMeetingOccurrence = (sourceDate, sourceId, skipKey) => {
    setMeetingsByDate(prev => {
      const next = { ...prev };
      const list = next[sourceDate] || [];
      next[sourceDate] = list.map(m => {
        if (m.id !== sourceId) return m;
        const skipDates = Array.from(new Set([...(m.skipDates || []), skipKey]));
        return { ...m, skipDates };
      });
      return next;
    });
  };

  const endMeetingFrom = (sourceDate, sourceId, endKey) => {
    setMeetingsByDate(prev => {
      const next = { ...prev };
      const list = next[sourceDate] || [];
      if (endKey <= sourceDate) {
        const filtered = list.filter(m => m.id !== sourceId);
        if (filtered.length === 0) delete next[sourceDate]; else next[sourceDate] = filtered;
        return next;
      }
      next[sourceDate] = list.map(m => m.id === sourceId ? { ...m, endDate: endKey } : m);
      return next;
    });
  };

  // ── Stats ────────────────────────────────────────────────────────

  const weekTasks = days.flatMap(d => getTasks(d));
  const doneCount = weekTasks.filter(t => t.done).length;
  const totalCount = weekTasks.length;
  const byPrio = { high: 0, med: 0, low: 0 };
  weekTasks.forEach(t => { if (byPrio[t.priority] !== undefined && !t.done) byPrio[t.priority]++; });
  const weekMeetingCount = days.reduce((acc, d) => acc + getMeetings(d).length, 0);

  const isCurrentWeek = fmtDate(weekStart) === fmtDate(startOfWeek(today));
  const isDayView = viewMode === 'day';
  const focusedDay = allDays[dayOffset];
  const isCurrent = isDayView ? fmtDate(focusedDay) === fmtDate(today) : isCurrentWeek;

  const stepBack = () => {
    if (isDayView) {
      if (dayOffset > 0) setDayOffset(dayOffset - 1);
      else { setWeekStart(addDays(weekStart, -7)); setDayOffset(6); }
    } else {
      setWeekStart(addDays(weekStart, -7));
    }
  };
  const stepForward = () => {
    if (isDayView) {
      if (dayOffset < 6) setDayOffset(dayOffset + 1);
      else { setWeekStart(addDays(weekStart, 7)); setDayOffset(0); }
    } else {
      setWeekStart(addDays(weekStart, 7));
    }
  };
  const goToToday = () => {
    setWeekStart(startOfWeek(today));
    if (isDayView) {
      const dow = today.getDay();
      setDayOffset(dow === 0 ? 6 : dow - 1);
    }
  };
  const rangeLabel = isDayView
    ? focusedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    : fmtRange(weekStart);

  // ── Resolve task for dialog ──────────────────────────────────────

  const taskDialogData = useMemo(() => {
    if (!editingTask) return null;
    const list = tasksByDate[editingTask.dateKey] || [];
    const found = list.find(x => x.id === editingTask.id);
    if (!found) return null;
    return { task: found, dateKey: editingTask.dateKey };
  }, [editingTask, tasksByDate]);

  // ── Resolve meeting for dialog ───────────────────────────────────

  const meetingDialogData = useMemo(() => {
    if (!editingMeeting) return null;
    if (editingMeeting.new) {
      return {
        meeting: { id: '', title: '', time: '', duration: '30', repeat: 'none', notes: '' },
        isNew: true,
        dateKey: editingMeeting.dateKey,
      };
    }
    const list = expandedMeetings[editingMeeting.dateKey] || [];
    const m = list.find(x => x.id === editingMeeting.id);
    if (!m) return null;
    return { meeting: m, isNew: false, dateKey: editingMeeting.dateKey };
  }, [editingMeeting, expandedMeetings]);

  return (
    <div className="nmd-tracker">
      <header className="nmd-tracker-header">
        <div className="nmd-tracker-title">
          <h1>{isDayView ? 'Day' : 'Week'}</h1>
          <span className="nmd-tracker-range">{rangeLabel}</span>
        </div>
        <div className="nmd-tracker-nav">
          <button className="nmd-iconbtn" title={isDayView ? 'Previous day' : 'Previous week'} onClick={stepBack}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m15 6-6 6 6 6" /></svg>
          </button>
          {!isCurrent && (
            <button className="nmd-btn" onClick={goToToday}>Today</button>
          )}
          <button className="nmd-iconbtn" title={isDayView ? 'Next day' : 'Next week'} onClick={stepForward}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m9 6 6 6-6 6" /></svg>
          </button>
          <div style={{ width: 8 }} />
          <div className="nmd-view-toggle">
            <button className={viewMode === 'day' ? 'active' : ''} onClick={() => setViewMode('day')}>Day</button>
            <button className={viewMode === 'workweek' ? 'active' : ''} onClick={() => setViewMode('workweek')}>Workweek</button>
            <button className={viewMode === 'full' ? 'active' : ''} onClick={() => setViewMode('full')}>Week</button>
          </div>
        </div>
        <div className="nmd-tracker-spacer" />
        <div className="nmd-week-stats">
          <span className="nmd-pill"><b>{doneCount}</b>/{totalCount} done</span>
          {weekMeetingCount > 0 && (
            <span className="nmd-pill">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: -1 }}>
                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
              </svg>
              <b>{weekMeetingCount}</b> mtg{weekMeetingCount !== 1 ? 's' : ''}
            </span>
          )}
          {byPrio.high > 0 && <span className="nmd-pill" title="Open high-priority"><span className="nmd-task-prio-dot nmd-prio-high" style={{ marginRight: 5 }} /><b>{byPrio.high}</b> high</span>}
          {byPrio.med > 0 && <span className="nmd-pill"><span className="nmd-task-prio-dot nmd-prio-med" style={{ marginRight: 5 }} /><b>{byPrio.med}</b> med</span>}
          <HelpIcon tip="Drag tasks between days. Click tasks to edit priority, add subtasks, or link to pages. Meetings can repeat daily, weekly, or biweekly. Click the candle icon on any task to start a Pomodoro timer." position="bottom" />
        </div>
      </header>

      <div className={'nmd-week-grid' + (isDayView ? ' day-view' : '')} style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
        {days.map((d) => {
          const key = fmtDate(d);
          const dow = d.getDay();
          return (
            <DayColumn
              key={key}
              date={d}
              tasks={getTasks(d)}
              isToday={fmtDate(d) === fmtDate(today)}
              isWeekend={dow === 0 || dow === 6}
              onAddTask={(title) => addTask(key, title)}
              onUpdateTask={(id, patch) => updateTask(key, id, patch)}
              onDropTask={(id) => moveTask(id, key)}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
              draggingId={draggingId}
              showToast={showToast}
              onEditTask={(id) => setEditingTask({ dateKey: key, id })}
              meetings={getMeetings(d)}
              onStartPomodoro={onStartPomodoro}
              onDuplicate={(task) => duplicateTask(key, task)}
            />
          );
        })}
      </div>

      <MeetingsDrawer
        days={days}
        getMeetings={getMeetings}
        onAddMeeting={(dateKey) => setEditingMeeting({ dateKey, new: true })}
        onEditMeeting={(dateKey, id) => setEditingMeeting({ dateKey, id })}
      />

      {/* Task dialog */}
      {taskDialogData && (
        <TaskDialog
          task={taskDialogData.task}
          dateKey={taskDialogData.dateKey}
          onUpdate={(p) => updateTask(taskDialogData.dateKey, taskDialogData.task.id, p)}
          onDelete={() => { deleteTask(taskDialogData.dateKey, taskDialogData.task.id); setEditingTask(null); }}
          onMove={(toKey) => { moveTask(taskDialogData.task.id, toKey); setEditingTask(null); }}
          onClose={() => setEditingTask(null)}
          notebooks={notebooks}
          onNavigateToPage={onNavigateToPage}
          pomoStats={pomoStats}
        />
      )}

      {/* Meeting dialog */}
      {meetingDialogData && (
        <MeetingDialog
          meeting={meetingDialogData.meeting}
          dateKey={meetingDialogData.dateKey}
          notebooks={notebooks}
          onNavigateToPage={onNavigateToPage}
          onUpdate={(patch) => {
            if (meetingDialogData.isNew) {
              const id = crypto.randomUUID();
              saveMeeting(meetingDialogData.dateKey, id, patch);
            } else {
              const m = meetingDialogData.meeting;
              if (m._recurring) {
                updateRecurringSource(m.sourceDate, m.sourceId, patch);
              } else {
                saveMeeting(meetingDialogData.dateKey, m.id, patch);
              }
            }
          }}
          onDelete={() => {
            const m = meetingDialogData.meeting;
            if (m._recurring) {
              deleteMeeting(m.sourceDate, m.sourceId);
            } else {
              deleteMeeting(meetingDialogData.dateKey, m.id);
            }
          }}
          onDeleteOccurrence={() => {
            const m = meetingDialogData.meeting;
            if (m._recurring) {
              skipMeetingOccurrence(m.sourceDate, m.sourceId, meetingDialogData.dateKey);
            } else {
              skipMeetingOccurrence(meetingDialogData.dateKey, m.id, meetingDialogData.dateKey);
            }
          }}
          onDeleteFuture={() => {
            const m = meetingDialogData.meeting;
            if (m._recurring) {
              endMeetingFrom(m.sourceDate, m.sourceId, meetingDialogData.dateKey);
            } else {
              endMeetingFrom(meetingDialogData.dateKey, m.id, meetingDialogData.dateKey);
            }
          }}
          onClose={() => setEditingMeeting(null)}
        />
      )}

    </div>
  );
}
