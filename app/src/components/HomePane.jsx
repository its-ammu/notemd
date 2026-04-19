import React, { useMemo } from 'react';
import { fmtDate, relTime, startOfWeek, addDays } from '../utils/time';
import { getMeetingsForDay, expandRecurringMeetings } from '../utils/meetings';

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

export default function HomePane({
  notebooks, tasksByDate, setTasksByDate, meetingsByDate,
  onOpenPage, onGoToTab, displayName,
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayKey = fmtDate(today);
  const todayTasks = tasksByDate[todayKey] || [];
  const todayMeetings = useMemo(
    () => getMeetingsForDay(meetingsByDate, today),
    [meetingsByDate, todayKey]
  );

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

          <div className="nmd-home-sub">
            <h3>Tasks</h3>
            {todayTasks.length === 0 ? (
              <div className="nmd-home-empty">Nothing scheduled for today.</div>
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
        </section>

        <section className="nmd-home-card">
          <div className="nmd-home-card-header">
            <h2>Recent pages</h2>
            <button className="nmd-home-link" onClick={() => onGoToTab('notebooks')}>All notebooks →</button>
          </div>
          {recentPages.length === 0 ? (
            <div className="nmd-home-empty">No pages yet. Create one to get started.</div>
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

        <section className="nmd-home-card nmd-home-stats">
          <div className="nmd-home-card-header"><h2>This week</h2></div>
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
