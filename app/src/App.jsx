import React, { useState, useEffect } from 'react';
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
  const [showHowTo, setShowHowTo] = useState(false);
  const [howToExpanded, setHowToExpanded] = useState(false);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useStoredState('nmd_theme', 'light');

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
          notebooks={notebooks}
          onNavigateToPage={(nbId, pageId) => { setActiveSel({ nbId, pageId }); setTab('notebooks'); }}
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
              <h2>Getting around</h2>
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
            <div className="nmd-modal-body nmd-howto">
              <p className="nmd-howto-lede">
                NoteMD is three things in one place — a home dashboard, a markdown notebook, and a weekly planner.
                The icons on the left rail switch between them. Everything saves automatically.
              </p>

              <section>
                <div className="nmd-howto-sec-head">
                  <span className="nmd-howto-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></svg>
                  </span>
                  <div>
                    <h3>Home</h3>
                    <p>Your day at a glance.</p>
                  </div>
                </div>
                <p>You'll land here each day. It pulls today's tasks and meetings from the tracker, shows the pages you were last working on, and lets you tick things off without leaving the page.</p>
              </section>

              <section>
                <div className="nmd-howto-sec-head">
                  <span className="nmd-howto-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 19.5z" /><path d="M4 7.5h16M4 12h16M4 16.5h16" /></svg>
                  </span>
                  <div>
                    <h3>Notebooks</h3>
                    <p>Where you write.</p>
                  </div>
                </div>
                <div className="nmd-howto-walk">
                  <p><b>Making a notebook.</b> Hit the <kbd>+</kbd> at the top of the sidebar, name it, done. Each notebook gets its own color so you can tell them apart at a glance.</p>
                  <p><b>Adding pages.</b> Expand a notebook and click "New page". Type a title, then start writing below. There's no save button — pages save as you type.</p>
                  <p><b>Read vs. Edit.</b> The toggle in the top-right switches between writing markdown and reading it rendered. In Read mode, a small list icon on the right opens a table of contents for the current page.</p>
                  <p><b>Searching.</b> The "Find in notes" box at the top of the sidebar looks through every title and body. Matches show up with a snippet of surrounding text.</p>
                  <p><b>More actions.</b> Right-click a notebook or page for rename, duplicate, recolor, and delete. The chevron button in the header hides the sidebar when you want more room.</p>
                </div>
                <div className="nmd-howto-cheat">
                  <div className="nmd-howto-cheat-title">Markdown you can use</div>
                  <div className="nmd-howto-cheat-grid">
                    <div><code># Heading</code><span>up to four levels</span></div>
                    <div><code>**bold**</code><span>bold text</span></div>
                    <div><code>*italic*</code><span>italic text</span></div>
                    <div><code>`code`</code><span>inline code</span></div>
                    <div><code>&gt; quote</code><span>block quote</span></div>
                    <div><code>- item</code><span>bullet list</span></div>
                    <div><code>1. item</code><span>numbered list</span></div>
                    <div><code>- [ ] todo</code><span>checkbox</span></div>
                    <div><code>[text](url)</code><span>link</span></div>
                    <div><code>---</code><span>divider</span></div>
                  </div>
                </div>
              </section>

              <section>
                <div className="nmd-howto-sec-head">
                  <span className="nmd-howto-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>
                  </span>
                  <div>
                    <h3>Weekly tracker</h3>
                    <p>Tasks and meetings by day.</p>
                  </div>
                </div>
                <div className="nmd-howto-walk">
                  <p><b>Adding things.</b> Click inside any day column to add a task or meeting. Tasks get checkboxes, meetings get a time.</p>
                  <p><b>Getting around.</b> Use the arrows to move weeks, or hit "Today" to snap back. Switch between Week and Day view from the header when you want a zoomed-in look.</p>
                  <p><b>Changing things.</b> Click an item to edit it inline. Checked tasks cross themselves out; they still count in the weekly totals up top.</p>
                </div>
              </section>

              <section>
                <div className="nmd-howto-sec-head">
                  <span className="nmd-howto-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87M4.6 9a1.7 1.7 0 0 1-.34-1.87" /></svg>
                  </span>
                  <div>
                    <h3>Settings & your data</h3>
                    <p>Preferences and backups.</p>
                  </div>
                </div>
                <div className="nmd-howto-walk">
                  <p>Set your display name (shows up in the home greeting), pick which tab opens on launch, and sign out from here.</p>
                  <p>Your data syncs to your account — but you can still grab a <b>JSON backup</b> any time, or import one to restore. The <b>Reset</b> button wipes everything, so be careful with that one.</p>
                </div>
              </section>

              <section className="nmd-howto-tips">
                <h3>Good to know</h3>
                <ul>
                  <li>Right-click is your friend — notebooks and pages both have context menus with the less common actions.</li>
                  <li>Nothing needs saving. If you close the tab mid-sentence, it'll be there when you come back.</li>
                  <li>On phones, the back chevron in the page header takes you back to the notebook list.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="nmd-toast">{toast}</div>}
    </div>
  );
}

export default App;
