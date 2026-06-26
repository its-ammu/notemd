import React, { useState, useEffect, useRef } from 'react';
import NotebooksPane from './components/NotebooksPane';
import WeeklyTracker from './components/WeeklyTracker';
import HomePane from './components/HomePane';
import AuthScreen from './components/AuthScreen';
import PomodoroTimer from './components/PomodoroTimer';
import RadioPane from './components/RadioPane';
import { useRadio } from './hooks/useRadio';
import { useStoredState } from './hooks/useStoredState';
import { useAuth } from './hooks/useAuth';
import { useCloudData } from './hooks/useCloudData';
import { useProfile } from './hooks/useProfile';
import { TWEAK_DEFAULTS } from './utils/constants';
import { isSupabaseConfigured } from './lib/supabase';
import { fetchPomoSessions, insertPomoSession } from './lib/sync';

function RailBtn({ label, children, active, onClick }) {
  return (
    <button
      className={'nmd-rail-btn' + (active ? ' active' : '')}
      onClick={onClick}
      aria-label={label}
    >
      {children}
      <span className="nmd-tip">{label}</span>
    </button>
  );
}

function App() {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const {
    notebooks, setNotebooks,
    tasksByDate, setTasksByDate,
    meetingsByDate, setMeetingsByDate,
    loaded, error: syncError, saving,
  } = useCloudData(user?.id || null);
  const { profile, updateProfile } = useProfile(user?.id || null, user?.email);

  const prefs = profile?.preferences || {};

  const [tab, setTab] = useStoredState('nmd_tab', TWEAK_DEFAULTS.defaultView);
  const [activeSel, setActiveSel] = useStoredState('nmd_active', { nbId: null, pageId: null });
  const [showSettings, setShowSettings] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [howToExpanded, setHowToExpanded] = useState(false);
  const [howToTab, setHowToTab] = useState('overview');
  const [toast, setToast] = useState(null); // { text, type, action }
  const toastTimer = useRef(null);
  const [theme, setTheme] = useStoredState('nmd_theme', 'light');
  const [pomodoroConfig, setPomodoroConfig] = useState(null); // { task, workSecs }
  // { dateKey, taskId? , meetingId? } — set when a storyboard badge wants the
  // tracker to jump to a linked task/meeting.
  const [trackerFocus, setTrackerFocus] = useState(null);
  const [pomoStats, setPomoStats] = useState({ total: 0, mins: 0, byTask: {} });
  // Lives here (not in RadioPane) so the stream keeps playing across tabs.
  const radio = useRadio({ onError: msg => showToast(msg, { type: 'error', duration: 4000 }) });

  // Warm up the YouTube player as soon as the radio tab opens, so the first
  // press of play doesn't wait on the iframe API. Only once the main UI is
  // rendered — earlier the player container doesn't exist yet.
  useEffect(() => {
    if (tab === 'radio' && user && loaded) radio.ensurePlayer().catch(() => {});
  }, [tab, user, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // The fixed video dock pins itself to RadioPane's in-flow screen slot.
  const [screenEl, setScreenEl] = useState(null);
  const [screenRect, setScreenRect] = useState(null);
  useEffect(() => {
    // When the radio tab unmounts, screenEl goes null. Clear the stale rect
    // so the dock falls back to CSS aspect-ratio until a fresh measurement.
    if (!screenEl) { setScreenRect(null); return; }
    const update = () => {
      const r = screenEl.getBoundingClientRect();
      // Skip zero-height reads (element not yet laid out)
      if (r.width === 0 || r.height === 0) return;
      setScreenRect(prev =>
        prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height });
    };
    // Defer the first measurement to after layout so getBoundingClientRect
    // returns the real dimensions, not a pre-layout zero.
    const raf = requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    ro.observe(screenEl);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true); // capture nested scrollers
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [screenEl]);

  // Load pomo sessions from DB when user signs in
  useEffect(() => {
    if (!user) { setPomoStats({ total: 0, mins: 0, byTask: {} }); return; }
    fetchPomoSessions().then(setPomoStats).catch(console.error);
  }, [user?.id]);

  const startPomodoro = (task, workSecs = 25 * 60, breakSecs = 5 * 60) => setPomodoroConfig({ task, workSecs, breakSecs });

  const handleSessionComplete = (taskId, taskTitle, durationMins = 25) => {
    if (user) {
      insertPomoSession(user.id, taskId, taskTitle, durationMins).catch(console.error);
    }
    setPomoStats(prev => {
      const t = prev.byTask?.[taskId] || { sessions: 0, mins: 0 };
      return {
        total: prev.total + 1,
        mins: prev.mins + durationMins,
        byTask: { ...prev.byTask, [taskId]: { sessions: t.sessions + 1, mins: t.mins + durationMins } },
      };
    });
  };

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // showToast('Saved') or showToast('Page deleted', { type: 'success',
  // action: { label: 'Undo', onClick } }). Toasts with an action linger
  // longer so there's time to click it.
  const showToast = (text, opts = {}) => {
    clearTimeout(toastTimer.current);
    setToast({ text, type: opts.type || 'info', action: opts.action || null });
    toastTimer.current = setTimeout(() => setToast(null), opts.duration ?? (opts.action ? 5000 : 1800));
  };

  const dismissToast = () => {
    clearTimeout(toastTimer.current);
    setToast(null);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="nmd-auth-shell">
        <div className="nmd-auth-card">
          <h1>Supabase not configured</h1>
          <p className="nmd-auth-sub">
            Copy <code>.env.example</code> to <code>.env.local</code> and set
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>,
            then restart <code>npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="nmd-auth-shell">
        <div className="nmd-auth-card" style={{ textAlign: 'center' }}>Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />;
  }

  if (!loaded) {
    return (
      <div className="nmd-auth-shell">
        <div className="nmd-auth-card" style={{ textAlign: 'center' }}>
          {syncError ? (
            <>
              <h1>Couldn't load your data</h1>
              <p className="nmd-auth-sub">{syncError}</p>
              <button className="nmd-btn" onClick={() => signOut()}>Sign out</button>
            </>
          ) : 'Loading your notebooks…'}
        </div>
      </div>
    );
  }

  const exportData = () => {
    const payload = {
      app: 'NoteMD', version: 1, exportedAt: new Date().toISOString(),
      notebooks, tasksByDate, meetingsByDate,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notemd-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded');
  };

  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.notebooks && !data.tasksByDate && !data.meetingsByDate) throw new Error('Not a NoteMD backup');
        if (!confirm('Replace current data with imported backup? This cannot be undone.')) return;
        if (data.notebooks) setNotebooks(data.notebooks);
        if (data.tasksByDate) setTasksByDate(data.tasksByDate);
        if (data.meetingsByDate) setMeetingsByDate(data.meetingsByDate);
        showToast('Backup restored');
        setShowSettings(false);
      } catch (err) {
        showToast('Could not import: ' + err.message, { type: 'error', duration: 4000 });
      }
    };
    reader.readAsText(file);
  };

  const clearAll = () => {
    if (!confirm('Erase all notebooks and tracker data? This cannot be undone.')) return;
    setNotebooks([]);
    setTasksByDate({});
    setMeetingsByDate({});
    setActiveSel({ nbId: null, pageId: null });
    showToast('Data cleared');
  };

  const handleSignOut = async () => {
    await signOut();
    setShowSettings(false);
  };

  return (
    <div
      className={'nmd-app-shell' + (tab === 'tracker' || tab === 'home' || tab === 'radio' ? ' tracker-layout' : '')}
    >
      <nav className="nmd-rail">
        <div className="nmd-rail-logo"><span>m</span></div>
        <RailBtn id="home" label="Home" active={tab === 'home'} onClick={() => setTab('home')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
          </svg>
        </RailBtn>
        <RailBtn id="notebooks" label="Notebooks" active={tab === 'notebooks'} onClick={() => setTab('notebooks')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 19.5z" />
            <path d="M4 7.5h16M4 12h16M4 16.5h16" />
          </svg>
        </RailBtn>
        <RailBtn id="tracker" label="Weekly tracker" active={tab === 'tracker'} onClick={() => setTab('tracker')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 9h18M8 3v4M16 3v4" />
            <path d="M7 13h3M13 13h4M7 17h6" strokeWidth="1.2" />
          </svg>
        </RailBtn>
        <RailBtn id="radio" label="Lofi radio" active={tab === 'radio'} onClick={() => setTab('radio')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="9" width="18" height="11" rx="2" />
            <path d="m7.5 9 9-5" />
            <circle cx="9" cy="14.5" r="2.5" />
            <path d="M15 12.5h3M15 16.5h2" />
          </svg>
          {radio.playing && <span className="nmd-rail-live" />}
        </RailBtn>

        <div className="nmd-rail-spacer" />

        <button className="nmd-rail-btn" onClick={() => setShowHowTo(true)} aria-label="How to use NoteMD">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 2.2" />
            <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
          </svg>
          <span className="nmd-tip">How to use</span>
        </button>

        <button className="nmd-rail-btn" onClick={() => setShowSettings(true)} aria-label="Settings & data">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.08a1.7 1.7 0 0 0 1.56-1.03 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.08a1.7 1.7 0 0 0-1.56 1z" />
          </svg>
          <span className="nmd-tip">Settings & data</span>
        </button>
      </nav>

      {tab === 'home' && (
        <HomePane
          notebooks={notebooks}
          tasksByDate={tasksByDate}
          setTasksByDate={setTasksByDate}
          meetingsByDate={meetingsByDate}
          setMeetingsByDate={setMeetingsByDate}
          displayName={profile?.display_name || (user.email ? user.email.split('@')[0] : '')}
          onOpenPage={(nbId, pageId) => { setActiveSel({ nbId, pageId }); setTab('notebooks'); }}
          onGoToTab={setTab}
          pomoStats={pomoStats}
        />
      )}
      {tab === 'notebooks' && (
        <NotebooksPane
          notebooks={notebooks}
          setNotebooks={setNotebooks}
          activeSel={activeSel}
          setActiveSel={setActiveSel}
          saving={saving}
          syncError={syncError}
          tasksByDate={tasksByDate}
          meetingsByDate={meetingsByDate}
          onOpenTracker={(focus) => { setTrackerFocus(focus); setTab('tracker'); }}
          showToast={showToast}
        />
      )}
      {tab === 'tracker' && (
        <WeeklyTracker
          tasksByDate={tasksByDate}
          setTasksByDate={setTasksByDate}
          meetingsByDate={meetingsByDate}
          setMeetingsByDate={setMeetingsByDate}
          showToast={showToast}
          notebooks={notebooks}
          onNavigateToPage={(nbId, pageId) => { setActiveSel({ nbId, pageId }); setTab('notebooks'); }}
          onStartPomodoro={startPomodoro}
          pomoStats={pomoStats}
          focusRequest={trackerFocus}
          onFocusHandled={() => setTrackerFocus(null)}
        />
      )}

      {tab === 'radio' && (
        <RadioPane
          radio={radio}
          screenRef={setScreenEl}
          onStartFocus={() => {
            if (!radio.playing && !radio.connecting) radio.play();
            startPomodoro(null);
          }}
        />
      )}

      {pomodoroConfig && (
        <PomodoroTimer
          task={pomodoroConfig.task}
          workSecs={pomodoroConfig.workSecs}
          breakSecs={pomodoroConfig.breakSecs}
          onClose={() => setPomodoroConfig(null)}
          onSessionComplete={handleSessionComplete}
          onToast={showToast}
        />
      )}

      {showSettings && (
        <div className="nmd-modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="nmd-modal nmd-modal-settings" onClick={e => e.stopPropagation()}>
            <div className="nmd-modal-header">
              <h2>Settings & data</h2>
              <button className="nmd-iconbtn" onClick={() => setShowSettings(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="nmd-modal-body">
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Account</div>
                  <div className="nmd-modal-row-desc">{user.email}</div>
                </div>
                <button className="nmd-btn" onClick={handleSignOut}>Sign out</button>
              </div>
              <div className="nmd-modal-row nmd-modal-row-field">
                <label className="nmd-field" htmlFor="nmd-display-name">
                  <span className="nmd-field-label">Display name</span>
                  <span className="nmd-field-hint">Shown on your home screen greeting.</span>
                  <input
                    id="nmd-display-name"
                    className="nmd-field-input"
                    type="text"
                    value={profile?.display_name || ''}
                    onChange={e => updateProfile({ display_name: e.target.value })}
                    placeholder="Your name"
                    autoComplete="nickname"
                  />
                </label>
              </div>
              <div className="nmd-modal-row nmd-modal-row-field">
                <div className="nmd-field">
                  <span className="nmd-field-label">Default view</span>
                  <span className="nmd-field-hint">Which tab opens when you launch the app.</span>
                  <div className="nmd-segmented" role="group" aria-label="Default view">
                    {[
                      { value: 'home', label: 'Home' },
                      { value: 'notebooks', label: 'Notebooks' },
                      { value: 'tracker', label: 'Tracker' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        className={'nmd-segmented-btn' + ((prefs.defaultView || 'home') === opt.value ? ' active' : '')}
                        onClick={() => {
                          updateProfile({ preferences: { defaultView: opt.value } });
                          setTab(opt.value);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Theme</div>
                  <div className="nmd-modal-row-desc">Switch between light and dark mode.</div>
                </div>
                <button
                  className="nmd-theme-toggle"
                  onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                  aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                >
                  {theme === 'light' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  )}
                  <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
                </button>
              </div>
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Storage</div>
                  <div className="nmd-modal-row-desc">
                    {syncError ? <span style={{ color: '#c1432b' }}>Sync error: {syncError}</span> : 'Synced to Supabase. Changes save automatically.'}
                  </div>
                </div>
                <span className="nmd-saved" style={{ fontSize: 12 }}>
                  {notebooks.reduce((a, b) => a + b.pages.length, 0)} pages · {Object.values(tasksByDate).reduce((a, b) => a + b.length, 0)} tasks · {Object.values(meetingsByDate).reduce((a, b) => a + b.length, 0)} meetings
                </span>
              </div>
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Export backup</div>
                  <div className="nmd-modal-row-desc">Download a JSON file with all notebooks and tracker data.</div>
                </div>
                <button className="nmd-btn primary" onClick={exportData}>Export</button>
              </div>
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Import backup</div>
                  <div className="nmd-modal-row-desc">Replace current data with a previously exported file.</div>
                </div>
                <label className="nmd-btn" style={{ cursor: 'pointer' }}>
                  Import
                  <input type="file" accept=".json,application/json" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; }} />
                </label>
              </div>
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Reset everything</div>
                  <div className="nmd-modal-row-desc">Erase all notebooks, pages, and tracker entries.</div>
                </div>
                <button className="nmd-btn danger" onClick={clearAll}>Erase data</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHowTo && (
        <div className="nmd-modal-backdrop" onClick={() => setShowHowTo(false)}>
          <div className={'nmd-modal nmd-modal-howto' + (howToExpanded ? ' expanded' : '')} onClick={e => e.stopPropagation()}>
            <div className="nmd-modal-header">
              <h2>How to use NoteMD</h2>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="nmd-iconbtn"
                  onClick={() => setHowToExpanded(v => !v)}
                  aria-label={howToExpanded ? 'Shrink' : 'Expand'}
                  title={howToExpanded ? 'Shrink' : 'Expand'}
                >
                  {howToExpanded ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4v5H4M20 15h-5v5M9 9 4 4M20 20l-5-5" /></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10V4h6M20 14v6h-6M4 4l6 6M20 20l-6-6" /></svg>
                  )}
                </button>
                <button className="nmd-iconbtn" onClick={() => setShowHowTo(false)} aria-label="Close">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
              </div>
            </div>
            <div className="nmd-howto-tabs">
              <button className={howToTab === 'overview' ? 'active' : ''} onClick={() => setHowToTab('overview')}>Overview</button>
              <button className={howToTab === 'home' ? 'active' : ''} onClick={() => setHowToTab('home')}>Home</button>
              <button className={howToTab === 'notebooks' ? 'active' : ''} onClick={() => setHowToTab('notebooks')}>Notebooks</button>
              <button className={howToTab === 'tracker' ? 'active' : ''} onClick={() => setHowToTab('tracker')}>Tracker</button>
              <button className={howToTab === 'settings' ? 'active' : ''} onClick={() => setHowToTab('settings')}>Settings</button>
            </div>
            <div className="nmd-modal-body nmd-howto">
              {howToTab === 'overview' && (
                <>
                  <p className="nmd-howto-lede">
                    NoteMD is three things in one place — a home dashboard, a markdown notebook, and a weekly planner.
                    The icons on the left rail switch between them. Everything saves automatically to your account.
                  </p>
                  <section className="nmd-howto-tips">
                    <h3>Quick tips</h3>
                    <ul>
                      <li><b>Right-click</b> notebooks and pages for context menus with rename, duplicate, recolor, and delete.</li>
                      <li><b>Long-press</b> on mobile opens the same context menu.</li>
                      <li><b>Nothing needs saving</b> — close the tab mid-sentence and it'll be there when you return.</li>
                      <li><b>Lofi radio</b> — the boombox icon on the rail streams chill stations while you work; it keeps playing across tabs.</li>
                      <li><b>Light/Dark mode</b> — toggle in Settings to match your preference.</li>
                      <li><b>Export backups</b> — download a JSON file anytime from Settings.</li>
                    </ul>
                  </section>
                </>
              )}

              {howToTab === 'home' && (
                <section>
                  <div className="nmd-howto-sec-head">
                    <span className="nmd-howto-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></svg>
                    </span>
                    <div>
                      <h3>Home Dashboard</h3>
                      <p>Your day at a glance.</p>
                    </div>
                  </div>
                  <div className="nmd-howto-walk">
                    <p><b>Today's schedule.</b> See all your tasks and meetings for the current day. Check off tasks directly without switching views.</p>
                    <p><b>Recent pages.</b> Quick access to the pages you've been working on, sorted by last edited. Click any page to jump straight to it.</p>
                    <p><b>Weekly stats.</b> Track your progress with a summary of tasks done, high-priority items open, and meetings scheduled for the week.</p>
                    <p><b>Personalized greeting.</b> Set your display name in Settings to see a personalized greeting based on the time of day.</p>
                  </div>
                </section>
              )}

              {howToTab === 'notebooks' && (
                <section>
                  <div className="nmd-howto-sec-head">
                    <span className="nmd-howto-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 19.5z" /><path d="M4 7.5h16M4 12h16M4 16.5h16" /></svg>
                    </span>
                    <div>
                      <h3>Notebooks</h3>
                      <p>Markdown-powered note taking.</p>
                    </div>
                  </div>
                  <div className="nmd-howto-walk">
                    <p><b>Create notebooks.</b> Click the <kbd>+</kbd> button at the top of the sidebar. Each notebook gets a unique color for easy identification.</p>
                    <p><b>Add pages.</b> Expand a notebook and click "New page". Pages auto-save as you type.</p>
                    <p><b>Read vs Edit mode.</b> Toggle between writing markdown (Edit) and viewing rendered output (Read). In Read mode, a floating button opens the table of contents.</p>
                    <p><b>Search.</b> Use "Find in notes" to search all titles and content. Matches appear with highlighted snippets.</p>
                    <p><b>Tags.</b> Add tags to pages using the tag bar below the title. Filter by tags using the tag dropdown in the search bar.</p>
                    <p><b>Paper styles.</b> Choose between plain, dotted, or squared paper backgrounds from the header.</p>
                    <p><b>Focus mode.</b> Click the focus button in the header to hide everything but the page for distraction-free writing. Press <kbd>Esc</kbd> to exit.</p>
                  </div>
                  <div className="nmd-howto-cheat">
                    <div className="nmd-howto-cheat-title">Markdown reference</div>
                    <div className="nmd-howto-cheat-grid">
                      <div><code># Heading</code><span>up to four levels (##, ###, ####)</span></div>
                      <div><code>**bold**</code><span>bold text</span></div>
                      <div><code>*italic*</code><span>italic text</span></div>
                      <div><code>`code`</code><span>inline code</span></div>
                      <div><code>&gt; quote</code><span>block quote</span></div>
                      <div><code>- item</code><span>bullet list</span></div>
                      <div><code>1. item</code><span>numbered list</span></div>
                      <div><code>- [ ] todo</code><span>checkbox (- [x] for checked)</span></div>
                      <div><code>[text](url)</code><span>hyperlink</span></div>
                      <div><code>---</code><span>horizontal divider</span></div>
                    </div>
                  </div>
                </section>
              )}

              {howToTab === 'tracker' && (
                <section>
                  <div className="nmd-howto-sec-head">
                    <span className="nmd-howto-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>
                    </span>
                    <div>
                      <h3>Weekly Tracker</h3>
                      <p>Tasks and meetings organized by day.</p>
                    </div>
                  </div>
                  <div className="nmd-howto-walk">
                    <p><b>View modes.</b> Switch between Day, Workweek (Mon-Fri), and full Week view using the toggle in the header.</p>
                    <p><b>Navigation.</b> Use arrows to move between days/weeks. Click "Today" to jump back to the current date.</p>
                    <p><b>Add tasks.</b> Click the "+" in any day column to add a task. Set priority (high/medium/low) and add subtasks from the edit dialog.</p>
                    <p><b>Add meetings.</b> Click "Meeting" to schedule one. Set time, duration, and repeat options (daily, weekly, biweekly).</p>
                    <p><b>Link to pages.</b> Connect tasks or meetings to notebook pages for quick reference. Click the link to navigate directly.</p>
                    <p><b>Drag and drop.</b> Move tasks between days by dragging them to a different column.</p>
                    <p><b>Quick move.</b> In the task edit dialog, use +1 (tomorrow), +7 (next week), or the calendar picker to reschedule.</p>
                    <p><b>Recurring meetings.</b> Delete options include: this occurrence only, this and future occurrences, or the entire series.</p>
                    <p><b>Stats.</b> The header shows tasks completed, high-priority items remaining, and total meetings for the current view.</p>
                  </div>
                </section>
              )}

              {howToTab === 'settings' && (
                <section>
                  <div className="nmd-howto-sec-head">
                    <span className="nmd-howto-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87M4.6 9a1.7 1.7 0 0 1-.34-1.87" /></svg>
                    </span>
                    <div>
                      <h3>Settings & Data</h3>
                      <p>Preferences and account management.</p>
                    </div>
                  </div>
                  <div className="nmd-howto-walk">
                    <p><b>Display name.</b> Customize the name shown in your home greeting.</p>
                    <p><b>Default view.</b> Choose which tab (Home, Notebooks, or Tracker) opens when you launch the app.</p>
                    <p><b>Theme.</b> Toggle between light and dark mode to match your preference.</p>
                    <p><b>Cloud sync.</b> All your data syncs automatically to your account. View storage stats (pages, tasks, meetings) at a glance.</p>
                    <p><b>Export backup.</b> Download a JSON file containing all your notebooks and tracker data.</p>
                    <p><b>Import backup.</b> Restore from a previously exported backup file. This replaces all current data.</p>
                    <p><b>Reset everything.</b> Permanently delete all notebooks, pages, and tracker entries. Use with caution — this cannot be undone.</p>
                    <p><b>Sign out.</b> Log out of your account. Your data remains safely synced for next time.</p>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* YouTube "TV": framed on the radio page, a corner mini-player while
          playing on other tabs, parked invisibly otherwise. One persistent
          node — moving/remounting an iframe would restart the stream. */}
      <div
        className={'nmd-yt-dock ' + (tab === 'radio' ? 'stage' : (radio.playing || radio.connecting) ? 'mini' : 'off')}
        style={tab === 'radio' && screenRect ? {
          top: screenRect.top,
          left: screenRect.left,
          width: screenRect.width,
          height: screenRect.height,
          transform: 'none',
        } : undefined}
        onClick={tab !== 'radio' ? () => setTab('radio') : undefined}
        title={tab !== 'radio' ? 'Open radio' : undefined}
      >
        <div id="nmd-yt-player" />
        <svg className="nmd-yt-scribble" viewBox="0 0 400 240" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M14 9 C90 4 180 6 250 5 C310 4 370 6 388 11 C393 50 392 110 390 150 C389 190 391 215 386 229 C300 234 200 231 120 232 C80 233 30 232 13 228 C8 190 9 130 10 90 C10 55 9 30 14 9 Z"
            fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" vectorEffect="non-scaling-stroke"
          />
          <path
            d="M18 14 C120 10 300 9 384 14 C388 70 388 170 383 224 C280 229 110 228 17 224 C13 160 14 70 18 14"
            fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.35" vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {toast && (
        <div className={'nmd-toast ' + toast.type} role="status">
          {toast.type === 'success' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></svg>
          )}
          {toast.type === 'error' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><circle cx="12" cy="16.5" r="0.5" fill="currentColor" /></svg>
          )}
          <span className="nmd-toast-text">{toast.text}</span>
          {toast.action && (
            <button
              className="nmd-toast-action"
              onClick={() => { toast.action.onClick(); dismissToast(); }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
