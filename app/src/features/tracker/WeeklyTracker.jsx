import React, { useState, useEffect, useMemo } from 'react';
import DayColumn from './DayColumn';
import TaskDialog from './TaskDialog';
import MeetingDialog from './MeetingDialog';
import MeetingsDrawer from './MeetingsDrawer';
import CalendarSwitcher from './CalendarSwitcher';
import { startOfWeek, addDays, fmtDate, fmtRange } from '../../shared/utils/time';
import { expandRecurringMeetings } from './meetings';
import { PRIO } from '../../shared/utils/constants';
import { HelpIcon } from '../../shared/components/Tooltip';
import { DoodleClockMini } from '../../shared/components/Doodles';

// `calendars` is the useCalendars() API, or null when calendars aren't available
// — then every task and meeting is shown, as it always was.
export default function WeeklyTracker({ tasksByDate, setTasksByDate, meetingsByDate, setMeetingsByDate, showToast, notebooks, onNavigateToPage, onStartPomodoro, pomoStats, focusRequest, onFocusHandled, meetingsDisplay = 'inline', copyPrefs, calendars = null }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [draggingId, setDraggingId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [seedAddKey, setSeedAddKey] = useState(null);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('nmd_tracker_mode') || 'full');
  const todayDow = new Date().getDay();
  const [dayOffset, setDayOffset] = useState(todayDow === 0 ? 6 : todayDow - 1);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { localStorage.setItem('nmd_tracker_mode', viewMode); }, [viewMode]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Jump to a linked task/meeting (e.g. from home):
  // navigate to its week/day and open the matching dialog.
  useEffect(() => {
    if (!focusRequest) return;
    const { dateKey, taskId, meetingId, create, view } = focusRequest;
    const d = new Date(dateKey + 'T00:00:00');
    setWeekStart(startOfWeek(d));
    const dow = d.getDay();
    if (viewMode === 'day' || view === 'day') setDayOffset(dow === 0 ? 6 : dow - 1);
    if (view === 'day') setViewMode('day');
    // Weekend items aren't visible in workweek view; widen so the dialog can resolve.
    if (viewMode === 'workweek' && view !== 'day' && (dow === 0 || dow === 6)) setViewMode('full');
    // The item may live on a calendar other than the one in view.
    if (calendars && 'calendarId' in focusRequest) calendars.setActiveId(focusRequest.calendarId);
    if (taskId) setEditingTask({ dateKey, id: taskId });
    if (meetingId) setEditingMeeting({ dateKey, id: meetingId });
    if (create === 'task') setSeedAddKey(dateKey);
    if (create === 'meeting') setEditingMeeting({ dateKey, new: true });
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

  // What's on screen is the active calendar's slice. The full maps stay the
  // source of truth for every edit below, so other calendars are never touched.
  const calendarView = calendars ? `${calendars.activeId}` : '';
  const visibleTasks = useMemo(
    () => (calendars ? calendars.filter(tasksByDate) : tasksByDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasksByDate, calendarView, calendars?.list]
  );
  const visibleMeetings = useMemo(
    () => (calendars ? calendars.filter(meetingsByDate) : meetingsByDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meetingsByDate, calendarView, calendars?.list]
  );

  const expandedMeetings = useMemo(
    () => expandRecurringMeetings(visibleMeetings, days),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleMeetings, days.map(d => fmtDate(d)).join(',')]
  );

  const getTasks = (d) => visibleTasks[fmtDate(d)] || [];
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
    const t = { id: crypto.randomUUID(), title, done: false, priority: 'none', subtasks: [], created: Date.now(), ...calendars?.stamp() };
    updateTasks(dateKey, tasks => [...tasks, t]);
  };

  const updateTask = (dateKey, id, patch) => {
    updateTasks(dateKey, tasks => tasks.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const deleteTask = (dateKey, id) => {
    const list = tasksByDate[dateKey] || [];
    const idx = list.findIndex(t => t.id === id);
    const task = list[idx];
    updateTasks(dateKey, tasks => tasks.filter(t => t.id !== id));
    if (!task) return;
    showToast(`Deleted "${task.title || 'task'}"`, {
      action: {
        label: 'Undo',
        onClick: () => updateTasks(dateKey, tasks => {
          if (tasks.some(t => t.id === id)) return tasks;
          const next = [...tasks];
          next.splice(Math.min(idx, next.length), 0, task);
          return next;
        }),
      },
    });
  };

  // Snapshot a stored meeting so a delete / skip / end can be undone by
  // putting the original row back exactly as it was.
  const offerMeetingUndo = (dateKey, id, label) => {
    const original = (meetingsByDate[dateKey] || []).find(m => m.id === id);
    if (!original) return;
    showToast(label, {
      action: {
        label: 'Undo',
        onClick: () => setMeetingsByDate(prev => {
          const list = prev[dateKey] || [];
          const next = list.some(m => m.id === id)
            ? list.map(m => (m.id === id ? original : m))
            : [...list, original];
          return { ...prev, [dateKey]: next };
        }),
      },
    });
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

  // Move a task to another day, or reorder within the same day. `beforeId` is
  // the id of the task the dragged one should land in front of; null means
  // append to the end of the target day.
  const moveTask = (taskId, toDateKey, beforeId = null) => {
    if (beforeId === taskId) return;
    let task = null, fromKey = null;
    for (const [k, list] of Object.entries(tasksByDate)) {
      const f = list.find(t => t.id === taskId);
      if (f) { task = f; fromKey = k; break; }
    }
    if (!task) return;
    setTasksByDate(prev => {
      const next = { ...prev };
      const fromList = (next[fromKey] || []).filter(t => t.id !== taskId);
      if (fromKey === toDateKey) {
        let idx = beforeId ? fromList.findIndex(t => t.id === beforeId) : fromList.length;
        if (idx < 0) idx = fromList.length;
        fromList.splice(idx, 0, task);
        next[toDateKey] = fromList;
      } else {
        if (fromList.length === 0) delete next[fromKey]; else next[fromKey] = fromList;
        const toList = [...(next[toDateKey] || [])];
        let idx = beforeId ? toList.findIndex(t => t.id === beforeId) : toList.length;
        if (idx < 0) idx = toList.length;
        toList.splice(idx, 0, task);
        next[toDateKey] = toList;
      }
      return next;
    });
  };

  // Long-press "Move to tomorrow", with an undo that puts the task back in
  // its original slot (read from fresh state, since the toast outlives this render).
  const moveTaskTomorrow = (fromKey, date, id) => {
    const toKey = fmtDate(addDays(date, 1));
    const idx = (tasksByDate[fromKey] || []).findIndex(t => t.id === id);
    moveTask(id, toKey);
    showToast('Moved to tomorrow', {
      action: {
        label: 'Undo',
        onClick: () => setTasksByDate(prev => {
          const task = (prev[toKey] || []).find(t => t.id === id);
          if (!task) return prev;
          const next = { ...prev };
          const toList = next[toKey].filter(t => t.id !== id);
          if (toList.length) next[toKey] = toList; else delete next[toKey];
          const back = [...(next[fromKey] || [])];
          back.splice(Math.max(0, Math.min(idx, back.length)), 0, task);
          next[fromKey] = back;
          return next;
        }),
      },
    });
  };

  // ── Meeting operations ───────────────────────────────────────────

  const writeMeeting = ({ fromKey, toKey, id, patch, isNew, rescheduleOccurrence }) => {
    setMeetingsByDate(prev => {
      const next = { ...prev };
      if (rescheduleOccurrence) {
        const { sourceDate, sourceId, skipKey } = rescheduleOccurrence;
        const srcList = [...(next[sourceDate] || [])];
        const si = srcList.findIndex(m => m.id === sourceId);
        if (si >= 0) {
          const src = srcList[si];
          srcList[si] = { ...src, skipDates: Array.from(new Set([...(src.skipDates || []), skipKey])) };
          next[sourceDate] = srcList;
        }
        next[toKey] = [...(next[toKey] || []), {
          id: crypto.randomUUID(),
          title: patch.title,
          time: patch.time,
          duration: patch.duration,
          repeat: 'none',
          notes: patch.notes,
          linkedPageId: patch.linkedPageId,
          ...(patch.calendarId ? { calendarId: patch.calendarId } : null),
        }];
        return next;
      }
      if (isNew) {
        next[toKey] = [...(next[toKey] || []), { id: crypto.randomUUID(), ...patch }];
        return next;
      }
      const list = [...(next[fromKey] || [])];
      const idx = list.findIndex(m => m.id === id);
      if (idx < 0) {
        next[toKey] = [...(next[toKey] || []), { id, ...patch }];
        return next;
      }
      const meeting = { ...list[idx], ...patch };
      delete meeting._recurring;
      delete meeting.sourceId;
      delete meeting.sourceDate;
      list.splice(idx, 1);
      if (fromKey === toKey) {
        list.splice(idx, 0, meeting);
        next[fromKey] = list;
      } else {
        if (list.length === 0) delete next[fromKey];
        else next[fromKey] = list;
        next[toKey] = [...(next[toKey] || []), meeting];
      }
      return next;
    });
  };

  // An item just landed on a calendar that isn't the one in view — say where
  // it went, with a way to follow it.
  const announceCalendar = (verb, calendarId) => {
    if (!calendars || (calendarId || null) === calendars.activeId) return;
    showToast(`${verb} ${calendars.byId(calendarId).name}`, {
      action: { label: 'Open', onClick: () => calendars.setActiveId(calendarId) },
    });
  };

  const jumpToDay = (dateKey) => {
    const d = new Date(dateKey + 'T00:00:00');
    setWeekStart(startOfWeek(d));
    const dow = d.getDay();
    if (viewMode === 'day') setDayOffset(dow === 0 ? 6 : dow - 1);
    if (viewMode === 'workweek' && (dow === 0 || dow === 6)) setViewMode('full');
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
        meeting: { id: '', title: '', time: editingMeeting.time || '', duration: '30', repeat: 'none', notes: '' },
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
              <DoodleClockMini size={10} strokeWidth={2.4} style={{ marginRight: 4, verticalAlign: -1 }} />
              <b>{weekMeetingCount}</b> mtg{weekMeetingCount !== 1 ? 's' : ''}
            </span>
          )}
          {byPrio.high > 0 && <span className="nmd-pill" title="Open high-priority"><span className="nmd-task-prio-dot nmd-prio-high" style={{ marginRight: 5 }} /><b>{byPrio.high}</b> high</span>}
          {byPrio.med > 0 && <span className="nmd-pill"><span className="nmd-task-prio-dot nmd-prio-med" style={{ marginRight: 5 }} /><b>{byPrio.med}</b> med</span>}
          {calendars && <CalendarSwitcher calendars={calendars} showToast={showToast} />}
          <HelpIcon tip={"Drag tasks between days. Click a task to edit it, or double-click its name to rename it. Right-click a task (or press and hold on touch) for more options. Day view lays meetings on a clock; click an empty hour to add one there. Meetings can repeat daily, weekly, or biweekly." + (calendars ? ' The calendar menu on the right switches calendars, shows all of them at once, and lets you drag to reorder.' : '')} position="bottom" />
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
              onDropTask={(id, beforeId) => moveTask(id, key, beforeId)}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
              draggingId={draggingId}
              showToast={showToast}
              onEditTask={(id) => setEditingTask({ dateKey: key, id })}
              onEditMeeting={(id) => setEditingMeeting({ dateKey: key, id })}
              onAddMeeting={(time) => setEditingMeeting({ dateKey: key, new: true, time: typeof time === 'string' ? time : '' })}
              meetings={getMeetings(d)}
              now={now}
              showMeetings={meetingsDisplay !== 'drawer'}
              timeline={isDayView}
              calendarName={calendars?.viewingAll ? (item) => calendars.of(item).name : null}
              seedAdd={seedAddKey === key}
              onSeedAddHandled={() => setSeedAddKey(null)}
              copyPrefs={copyPrefs}
              onStartPomodoro={onStartPomodoro}
              onDuplicate={(task) => duplicateTask(key, task)}
              onMoveTaskTomorrow={(id) => moveTaskTomorrow(key, d, id)}
              onDeleteTask={(id) => deleteTask(key, id)}
            />
          );
        })}
      </div>

      {meetingsDisplay === 'drawer' && (
        <MeetingsDrawer
          days={days}
          getMeetings={getMeetings}
          now={now}
          onAddMeeting={(dateKey) => setEditingMeeting({ dateKey, new: true })}
          onEditMeeting={(dateKey, id) => setEditingMeeting({ dateKey, id })}
        />
      )}

      {/* Task dialog */}
      {taskDialogData && (
        <TaskDialog
          task={taskDialogData.task}
          dateKey={taskDialogData.dateKey}
          onUpdate={(p) => updateTask(taskDialogData.dateKey, taskDialogData.task.id, p)}
          onDelete={() => { deleteTask(taskDialogData.dateKey, taskDialogData.task.id); setEditingTask(null); }}
          onMove={(toKey) => { moveTask(taskDialogData.task.id, toKey); setEditingTask(null); }}
          calendars={calendars}
          onMoveCalendar={(calendarId) => {
            updateTask(taskDialogData.dateKey, taskDialogData.task.id, { calendarId: calendarId || undefined });
            setEditingTask(null);
            announceCalendar('Moved to', calendarId);
          }}
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
          calendars={calendars}
          onUpdate={(patch, saveDateKey) => {
            const target = saveDateKey || meetingDialogData.dateKey;
            announceCalendar(meetingDialogData.isNew ? 'Added to' : 'Moved to', patch.calendarId);
            if (meetingDialogData.isNew) {
              writeMeeting({ toKey: target, patch, isNew: true });
            } else {
              const m = meetingDialogData.meeting;
              const instanceKey = meetingDialogData.dateKey;
              if (m._recurring && target !== instanceKey) {
                writeMeeting({
                  toKey: target,
                  patch,
                  rescheduleOccurrence: {
                    sourceDate: m.sourceDate,
                    sourceId: m.sourceId,
                    skipKey: instanceKey,
                  },
                });
              } else if (m._recurring) {
                updateRecurringSource(m.sourceDate, m.sourceId, patch);
              } else {
                writeMeeting({ fromKey: instanceKey, toKey: target, id: m.id, patch });
              }
            }
            if (target !== meetingDialogData.dateKey) jumpToDay(target);
          }}
          onDelete={() => {
            const m = meetingDialogData.meeting;
            const [key, id] = m._recurring ? [m.sourceDate, m.sourceId] : [meetingDialogData.dateKey, m.id];
            offerMeetingUndo(key, id, `Deleted "${m.title || 'meeting'}"`);
            deleteMeeting(key, id);
          }}
          onDeleteOccurrence={() => {
            const m = meetingDialogData.meeting;
            offerMeetingUndo(m._recurring ? m.sourceDate : meetingDialogData.dateKey, m._recurring ? m.sourceId : m.id, 'Skipped this one');
            if (m._recurring) {
              skipMeetingOccurrence(m.sourceDate, m.sourceId, meetingDialogData.dateKey);
            } else {
              skipMeetingOccurrence(meetingDialogData.dateKey, m.id, meetingDialogData.dateKey);
            }
          }}
          onDeleteFuture={() => {
            const m = meetingDialogData.meeting;
            offerMeetingUndo(m._recurring ? m.sourceDate : meetingDialogData.dateKey, m._recurring ? m.sourceId : m.id, 'Ended the series here');
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
