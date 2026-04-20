import React, { useState, useEffect, useMemo } from 'react';
import DayColumn from './DayColumn';
import TaskDialog from './TaskDialog';
import MeetingDialog from './MeetingDialog';
import { startOfWeek, addDays, fmtDate, fmtRange } from '../utils/time';
import { expandRecurringMeetings } from '../utils/meetings';
import { PRIO } from '../utils/constants';

export default function WeeklyTracker({ tasksByDate, setTasksByDate, meetingsByDate, setMeetingsByDate, showToast, notebooks, onNavigateToPage }) {
  const [weekStart, setWeekStart] = useState(() => {
    const stored = localStorage.getItem('nmd_week');
    return stored ? startOfWeek(new Date(stored)) : startOfWeek(new Date());
  });
  const [draggingId, setDraggingId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editingMeeting, setEditingMeeting] = useState(null); // { dateKey, id } or { dateKey, new: true }
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('nmd_tracker_mode') || 'full');
  const [dayOffset, setDayOffset] = useState(() => {
    const raw = parseInt(localStorage.getItem('nmd_day_offset') || '', 10);
    return Number.isFinite(raw) && raw >= 0 && raw <= 6 ? raw : new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  });

  useEffect(() => { localStorage.setItem('nmd_week', weekStart.toISOString()); }, [weekStart]);
  useEffect(() => { localStorage.setItem('nmd_tracker_mode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('nmd_day_offset', String(dayOffset)); }, [dayOffset]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const days =
    viewMode === 'day' ? [allDays[dayOffset]] :
    viewMode === 'workweek' ? allDays.slice(0, 5) :
    allDays;

  const getTasks = (d) => tasksByDate[fmtDate(d)] || [];

  // Expand recurring meetings for visible week
  const expandedMeetings = useMemo(
    () => expandRecurringMeetings(meetingsByDate, days),
    [meetingsByDate, days.map(d => fmtDate(d)).join(',')]
  );

  const getMeetings = (d) => expandedMeetings[fmtDate(d)] || [];

  // Task operations
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

  // Meeting operations
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
      // If the cutoff is on or before the origin, the whole series goes.
      if (endKey <= sourceDate) {
        const filtered = list.filter(m => m.id !== sourceId);
        if (filtered.length === 0) delete next[sourceDate]; else next[sourceDate] = filtered;
        return next;
      }
      next[sourceDate] = list.map(m => m.id === sourceId ? { ...m, endDate: endKey } : m);
      return next;
    });
  };

  // Stats
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

  // Resolve meeting for editing
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
        </div>
      </header>

      <div className={'nmd-week-grid' + (isDayView ? ' day-view' : '')} style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
        {days.map((d, i) => {
          const key = fmtDate(d);
          const dow = d.getDay();
          return (
            <DayColumn
              key={key}
              dayIdx={i}
              date={d}
              tasks={getTasks(d)}
              meetings={getMeetings(d)}
              isToday={fmtDate(d) === fmtDate(today)}
              isWeekend={dow === 0 || dow === 6}
              onAddTask={(title) => addTask(key, title)}
              onUpdateTask={(id, patch) => updateTask(key, id, patch)}
              onDeleteTask={(id) => deleteTask(key, id)}
              onDropTask={(id) => moveTask(id, key)}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
              draggingId={draggingId}
              showToast={showToast}
              onEditTask={(id) => setEditingTask({ dateKey: key, id })}
              onAddMeeting={() => addMeeting(key)}
              onEditMeeting={(id) => setEditingMeeting({ dateKey: key, id })}
            />
          );
        })}
      </div>

      {/* Task edit dialog */}
      {editingTask && (() => {
        const tList = tasksByDate[editingTask.dateKey] || [];
        const task = tList.find(x => x.id === editingTask.id);
        if (!task) return null;
        return (
          <TaskDialog
            task={task}
            dateKey={editingTask.dateKey}
            onUpdate={(p) => updateTask(editingTask.dateKey, task.id, p)}
            onDelete={() => { deleteTask(editingTask.dateKey, task.id); setEditingTask(null); }}
            onMove={(toKey) => { moveTask(task.id, toKey); setEditingTask(null); }}
            onClose={() => setEditingTask(null)}
            notebooks={notebooks}
            onNavigateToPage={onNavigateToPage}
          />
        );
      })()}

      {/* Meeting edit dialog */}
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
                // Update the source meeting
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
              // Source itself: skip this date and keep the series going
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
