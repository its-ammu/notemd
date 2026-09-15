import React, { useState, useEffect } from 'react';
import NotebooksPane from './features/notebooks/NotebooksPane';
import WeeklyTracker from './features/tracker/WeeklyTracker';
import HomePane from './features/home/HomePane';
import AuthScreen, { ResetPasswordScreen } from './features/auth/AuthScreen';
import PomodoroTimer from './features/pomodoro/PomodoroTimer';
import RadioPane from './features/radio/RadioPane';
import { useRadio } from './features/radio/useRadio';
import { useStoredState } from './shared/hooks/useStoredState';
import { useAuth } from './shared/hooks/useAuth';
import { useCloudData } from './shared/hooks/useCloudData';
import { useProfile } from './shared/hooks/useProfile';
import { TWEAK_DEFAULTS } from './shared/utils/constants';
import { isSupabaseConfigured } from './shared/lib/supabase';
import { fetchPomoSessions, insertPomoSession } from './shared/lib/sync';
import NavRail from './shared/components/NavRail';
import SettingsModal from './shared/components/SettingsModal';
import HowToModal from './shared/components/HowToModal';
import { useToast } from './shared/hooks/useToast';

function App() {
  const {
    user, loading: authLoading, signIn, signUp, signOut,
    resetPassword, updatePassword, passwordRecovery, clearPasswordRecovery,
  } = useAuth();
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
  const { toast, showToast, dismissToast } = useToast();
  const [theme, setTheme] = useStoredState('nmd_theme', 'light');
  const [pomodoroConfig, setPomodoroConfig] = useState(null); // { task, workSecs }
  // { dateKey, taskId? , meetingId? } — jump the tracker to a linked item.
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

  if (user && passwordRecovery) {
    return <ResetPasswordScreen onUpdatePassword={updatePassword} onDone={clearPasswordRecovery} />;
  }

  if (!user) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} onResetPassword={resetPassword} />;
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
      <NavRail
        tab={tab}
        setTab={setTab}
        radio={radio}
        onOpenHowTo={() => setShowHowTo(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

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
          onOpenTrackerItem={(focus) => { setTrackerFocus(focus); setTab('tracker'); }}
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

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        user={user}
        profile={profile}
        prefs={prefs}
        updateProfile={updateProfile}
        setTab={setTab}
        theme={theme}
        setTheme={setTheme}
        syncError={syncError}
        notebooks={notebooks}
        tasksByDate={tasksByDate}
        meetingsByDate={meetingsByDate}
        onSignOut={handleSignOut}
        onExport={exportData}
        onImport={importData}
        onClearAll={clearAll}
      />

      <HowToModal
        open={showHowTo}
        onClose={() => setShowHowTo(false)}
        expanded={howToExpanded}
        onToggleExpanded={setHowToExpanded}
        howToTab={howToTab}
        setHowToTab={setHowToTab}
      />

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
