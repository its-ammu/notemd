import React, { useState } from 'react';
import NotebooksPane from './components/NotebooksPane';
import WeeklyTracker from './components/WeeklyTracker';
import HomePane from './components/HomePane';
import AuthScreen from './components/AuthScreen';
import { useStoredState } from './hooks/useStoredState';
import { useAuth } from './hooks/useAuth';
import { useCloudData } from './hooks/useCloudData';
import { useProfile } from './hooks/useProfile';
import { TWEAK_DEFAULTS } from './utils/constants';
import { isSupabaseConfigured } from './lib/supabase';

function App() {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const {
    notebooks, setNotebooks,
    tasksByDate, setTasksByDate,
    meetingsByDate, setMeetingsByDate,
    loaded, error: syncError,
  } = useCloudData(user?.id || null);
  const { profile, updateProfile } = useProfile(user?.id || null, user?.email);

  const prefs = profile?.preferences || {};

  const [tab, setTab] = useStoredState('nmd_tab', TWEAK_DEFAULTS.defaultView);
  const [activeSel, setActiveSel] = useStoredState('nmd_active', { nbId: null, pageId: null });
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 1800);
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
        alert('Could not import: ' + err.message);
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

  const RailBtn = ({ id, label, children }) => (
    <button
      className={'nmd-rail-btn' + (tab === id ? ' active' : '')}
      onClick={() => setTab(id)}
      aria-label={label}
    >
      {children}
      <span className="nmd-tip">{label}</span>
    </button>
  );

  return (
    <div
      className={'nmd-app-shell' + (tab === 'tracker' || tab === 'home' ? ' tracker-layout' : '')}
    >
      <nav className="nmd-rail">
        <div className="nmd-rail-logo"><span>m</span></div>
        <RailBtn id="home" label="Home">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
          </svg>
        </RailBtn>
        <RailBtn id="notebooks" label="Notebooks">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 19.5z" />
            <path d="M4 7.5h16M4 12h16M4 16.5h16" />
          </svg>
        </RailBtn>
        <RailBtn id="tracker" label="Weekly tracker">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 9h18M8 3v4M16 3v4" />
            <path d="M7 13h3M13 13h4M7 17h6" strokeWidth="1.2" />
          </svg>
        </RailBtn>

        <div className="nmd-rail-spacer" />

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
          displayName={profile?.display_name || (user.email ? user.email.split('@')[0] : '')}
          onOpenPage={(nbId, pageId) => { setActiveSel({ nbId, pageId }); setTab('notebooks'); }}
          onGoToTab={setTab}
        />
      )}
      {tab === 'notebooks' && (
        <NotebooksPane
          notebooks={notebooks}
          setNotebooks={setNotebooks}
          activeSel={activeSel}
          setActiveSel={setActiveSel}
        />
      )}
      {tab === 'tracker' && (
        <WeeklyTracker
          tasksByDate={tasksByDate}
          setTasksByDate={setTasksByDate}
          meetingsByDate={meetingsByDate}
          setMeetingsByDate={setMeetingsByDate}
          showToast={showToast}
        />
      )}

      {showSettings && (
        <div className="nmd-modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="nmd-modal" onClick={e => e.stopPropagation()}>
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
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Display name</div>
                  <div className="nmd-modal-row-desc">Shown on your home screen greeting.</div>
                </div>
                <input
                  className="nmd-modal-input"
                  type="text"
                  value={profile?.display_name || ''}
                  onChange={e => updateProfile({ display_name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Default view</div>
                  <div className="nmd-modal-row-desc">Which tab opens when you launch the app.</div>
                </div>
                <select
                  className="nmd-modal-input"
                  value={prefs.defaultView || 'home'}
                  onChange={e => {
                    const v = e.target.value;
                    updateProfile({ preferences: { defaultView: v } });
                    setTab(v);
                  }}
                >
                  <option value="home">Home</option>
                  <option value="notebooks">Notebooks</option>
                  <option value="tracker">Weekly tracker</option>
                </select>
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

      {toast && <div className="nmd-toast">{toast}</div>}
    </div>
  );
}

export default App;
