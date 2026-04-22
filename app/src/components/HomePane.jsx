import React, { useMemo, useState, useEffect } from 'react';
import { fmtDate, relTime, startOfWeek, addDays } from '../utils/time';
import { getMeetingsForDay, expandRecurringMeetings } from '../utils/meetings';
import EmptyState from './EmptyState';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}

function fmtTime(t) {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr;
  const suffix = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return m === '00' ? `${h}${suffix}` : `${h}:${m}${suffix}`;
}

function getNextMeeting(meetings) {
  if (!meetings.length) return null;
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const upcoming = meetings
    .filter(m => m.time)
    .map(m => {
      const [h, min] = m.time.split(':').map(Number);
      const startMins = h * 60 + min;
      const endMins = startMins + (parseInt(m.duration, 10) || 30);
      return { ...m, startMins, endMins };
    })
    .filter(m => m.endMins > nowMins)
    .sort((a, b) => a.startMins - b.startMins);

  if (!upcoming.length) return null;

  const next = upcoming[0];
  const minsUntil = next.startMins - nowMins;
  const inProgress = minsUntil <= 0;

  return { ...next, minsUntil, inProgress };
}

function formatCountdown(mins) {
  if (mins <= 0) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function HomePane({
  notebooks, tasksByDate, setTasksByDate, meetingsByDate, setMeetingsByDate,
  onOpenPage, onGoToTab, displayName,
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayKey = fmtDate(today);
  const todayTasks = tasksByDate[todayKey] || [];
  const todayMeetings = useMemo(
    () => getMeetingsForDay(meetingsByDate, today),
    [meetingsByDate, todayKey]
  );

  // Quick add states
  const [quickAddTask, setQuickAddTask] = useState(false);
  const [quickAddMeeting, setQuickAddMeeting] = useState(false);
  const [taskText, setTaskText] = useState('');
  const [meetingText, setMeetingText] = useState('');
  const [meetingTime, setMeetingTime] = useState('');

  // Countdown ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const nextMeeting = useMemo(() => getNextMeeting(todayMeetings), [todayMeetings, Math.floor(Date.now() / 60000)]);

  // Mini week calendar data
  const weekDays = useMemo(() => {
    const ws = startOfWeek(today);
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const expanded = expandRecurringMeetings(meetingsByDate, days);
    return days.map(d => {
      const key = fmtDate(d);
      const tasks = tasksByDate[key] || [];
      const meetings = expanded[key] || [];
      const isToday = key === todayKey;
      const dow = d.getDay();
      const dayName = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dow];
      return { date: d, key, dayName, dayNum: d.getDate(), isToday, taskCount: tasks.length, meetingCount: meetings.length, hasTasks: tasks.length > 0, hasMeetings: meetings.length > 0 };
    });
  }, [today, todayKey, tasksByDate, meetingsByDate]);

  const addQuickTask = () => {
    const title = taskText.trim();
    if (!title) return;
    const task = { id: crypto.randomUUID(), title, done: false, priority: 'none', subtasks: [], created: Date.now() };
    setTasksByDate(prev => ({ ...prev, [todayKey]: [...(prev[todayKey] || []), task] }));
    setTaskText('');
    setQuickAddTask(false);
  };

  const addQuickMeeting = () => {
    const title = meetingText.trim() || 'Meeting';
    const meeting = { id: crypto.randomUUID(), title, time: meetingTime, duration: '30', repeat: 'none', notes: '' };
    setMeetingsByDate(prev => ({ ...prev, [todayKey]: [...(prev[todayKey] || []), meeting] }));
    setMeetingText('');
    setMeetingTime('');
    setQuickAddMeeting(false);
  };

  const recentPages = useMemo(() => {
    const all = notebooks.flatMap(nb =>
      nb.pages.map(p => ({
        id: p.id, title: p.title, updated: p.updated || 0,
        nbId: nb.id, nbName: nb.name, nbColor: nb.color,
        preview: (p.body || '').replace(/\s+/g, ' ').slice(0, 120),
      }))
    );
    return all.sort((a, b) => b.updated - a.updated).slice(0, 6);
  }, [notebooks]);

  const weekStats = useMemo(() => {
    const ws = startOfWeek(today);
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const keys = days.map(d => fmtDate(d));
    const flatTasks = keys.flatMap(k => tasksByDate[k] || []);
    const done = flatTasks.filter(t => t.done).length;
    const highOpen = flatTasks.filter(t => !t.done && t.priority === 'high').length;
    const expanded = expandRecurringMeetings(meetingsByDate, days);
    const meetingsCount = Object.values(expanded).reduce((a, list) => a + list.length, 0);
    return { total: flatTasks.length, done, highOpen, meetingsCount };
  }, [tasksByDate, meetingsByDate, today]);

  const toggleTask = (id) => {
    setTasksByDate(prev => ({
      ...prev,
      [todayKey]: (prev[todayKey] || []).map(t => t.id === id ? { ...t, done: !t.done } : t),
    }));
  };

  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <main className="nmd-home">
      <header className="nmd-home-header">
        <h1>{greeting()}{displayName ? `, ${displayName}` : ''}</h1>
        <p>{todayLabel}</p>
      </header>

      {nextMeeting && (nextMeeting.inProgress || nextMeeting.minsUntil <= 240) ? (
        <div className="nmd-home-countdown">
          <div className="nmd-home-countdown-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div className="nmd-home-countdown-text">
            {nextMeeting.inProgress ? (
              <><span className="nmd-home-countdown-label">In progress:</span> <span className="nmd-home-countdown-title">{nextMeeting.title}</span></>
            ) : (
              <><span className="nmd-home-countdown-title">{nextMeeting.title}</span> <span className="nmd-home-countdown-label">in</span> <span className="nmd-home-countdown-time">{formatCountdown(nextMeeting.minsUntil)}</span></>
            )}
          </div>
        </div>
      ) : (
        <div className="nmd-home-countdown nmd-home-countdown-clear">
          <div className="nmd-home-countdown-icon clear">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div className="nmd-home-countdown-text">
            <span className="nmd-home-countdown-title">No meetings soon</span>
            <span className="nmd-home-countdown-label">~ yayy!</span>
          </div>
        </div>
      )}

      <div className="nmd-home-grid">
        <section className="nmd-home-card">
          <div className="nmd-home-card-header">
            <h2>Today</h2>
            <button className="nmd-home-link" onClick={() => onGoToTab('tracker')}>Open tracker →</button>
          </div>

          {todayMeetings.length > 0 && (
            <div className="nmd-home-sub">
              <h3>Meetings</h3>
              <ul className="nmd-home-list">
                {todayMeetings.map(m => (
                  <li key={m.id} className="nmd-home-meeting">
                    <span className="nmd-home-time">{fmtTime(m.time) || '—'}</span>
                    <span className="nmd-home-meeting-title">{m.title || 'Untitled meeting'}</span>
                    {m.duration && <span className="nmd-home-dur">{m.duration}m</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {todayTasks.length === 0 && todayMeetings.length === 0 && (
            <EmptyState type="todayEmpty" onAction={() => onGoToTab('tracker')} />
          )}

          {(todayTasks.length > 0 || todayMeetings.length > 0) && (
            <div className="nmd-home-sub">
              <h3>Tasks</h3>
              {todayTasks.length === 0 ? (
                <div className="nmd-home-empty">No tasks for today.</div>
              ) : (
                <ul className="nmd-home-list">
                  {todayTasks.map(t => (
                    <li key={t.id} className={'nmd-home-task' + (t.done ? ' done' : '')}>
                      <button
                        type="button"
                        className={'nmd-home-check' + (t.done ? ' checked' : '')}
                        onClick={() => toggleTask(t.id)}
                        aria-label={t.done ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {t.done && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                        )}
                      </button>
                      <span className="nmd-home-task-title">{t.title || 'Untitled'}</span>
                      {t.priority && t.priority !== 'none' && (
                        <span className={`nmd-task-prio-dot nmd-prio-${t.priority}`} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="nmd-home-card">
          <div className="nmd-home-card-header">
            <h2>Recent pages</h2>
            <button className="nmd-home-link" onClick={() => onGoToTab('notebooks')}>All notebooks →</button>
          </div>
          {recentPages.length === 0 ? (
            <EmptyState type="recentPages" onAction={() => onGoToTab('notebooks')} />
          ) : (
            <ul className="nmd-home-list nmd-home-pages">
              {recentPages.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="nmd-home-page"
                    onClick={() => onOpenPage(p.nbId, p.id)}
                  >
                    <span className="nmd-nb-dot" style={{ background: p.nbColor }} />
                    <span className="nmd-home-page-body">
                      <span className="nmd-home-page-title">{p.title || 'Untitled'}</span>
                      {p.preview && <span className="nmd-home-page-preview">{p.preview}</span>}
                    </span>
                    <span className="nmd-home-page-meta">
                      <span>{p.nbName}</span>
                      <span>·</span>
                      <span>{relTime(p.updated)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="nmd-home-card nmd-home-quickadd">
          <div className="nmd-home-card-header"><h2>Quick add</h2></div>
          <div className="nmd-home-quickadd-btns">
            {!quickAddTask && !quickAddMeeting && (
              <>
                <button className="nmd-home-quickadd-btn" onClick={() => setQuickAddTask(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add task
                </button>
                <button className="nmd-home-quickadd-btn" onClick={() => setQuickAddMeeting(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                  </svg>
                  Add meeting
                </button>
              </>
            )}
            {quickAddTask && (
              <div className="nmd-home-quickadd-form">
                <input
                  autoFocus
                  type="text"
                  placeholder="What needs doing?"
                  value={taskText}
                  onChange={e => setTaskText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addQuickTask();
                    if (e.key === 'Escape') { setQuickAddTask(false); setTaskText(''); }
                  }}
                />
                <button className="nmd-home-quickadd-submit" onClick={addQuickTask}>Add</button>
                <button className="nmd-home-quickadd-cancel" onClick={() => { setQuickAddTask(false); setTaskText(''); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            {quickAddMeeting && (
              <div className="nmd-home-quickadd-form">
                <input
                  autoFocus
                  type="text"
                  placeholder="Meeting title"
                  value={meetingText}
                  onChange={e => setMeetingText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addQuickMeeting();
                    if (e.key === 'Escape') { setQuickAddMeeting(false); setMeetingText(''); setMeetingTime(''); }
                  }}
                />
                <input
                  type="time"
                  value={meetingTime}
                  onChange={e => setMeetingTime(e.target.value)}
                  className="nmd-home-quickadd-time"
                />
                <button className="nmd-home-quickadd-submit" onClick={addQuickMeeting}>Add</button>
                <button className="nmd-home-quickadd-cancel" onClick={() => { setQuickAddMeeting(false); setMeetingText(''); setMeetingTime(''); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="nmd-home-card nmd-home-stats">
          <div className="nmd-home-card-header"><h2>This week</h2></div>
          <div className="nmd-home-mini-week">
            {weekDays.map(d => (
              <button
                key={d.key}
                className={'nmd-home-mini-day' + (d.isToday ? ' today' : '') + (d.hasTasks || d.hasMeetings ? ' has-items' : '')}
                onClick={() => onGoToTab('tracker')}
                title={`${d.taskCount} tasks, ${d.meetingCount} meetings`}
              >
                <span className="nmd-home-mini-name">{d.dayName}</span>
                <span className="nmd-home-mini-num">{d.dayNum}</span>
                <span className="nmd-home-mini-dots">
                  {d.hasTasks && <span className="nmd-home-mini-dot task" />}
                  {d.hasMeetings && <span className="nmd-home-mini-dot meeting" />}
                </span>
              </button>
            ))}
          </div>
          <div className="nmd-home-stat-grid">
            <div className="nmd-home-stat">
              <div className="nmd-home-stat-num">{weekStats.done}<span>/{weekStats.total}</span></div>
              <div className="nmd-home-stat-label">Tasks done</div>
            </div>
            <div className="nmd-home-stat">
              <div className="nmd-home-stat-num">{weekStats.highOpen}</div>
              <div className="nmd-home-stat-label">High-priority open</div>
            </div>
            <div className="nmd-home-stat">
              <div className="nmd-home-stat-num">{weekStats.meetingsCount}</div>
              <div className="nmd-home-stat-label">Meetings</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
