import React from 'react';

export default function SettingsModal({
  open,
  onClose,
  user,
  profile,
  prefs,
  updateProfile,
  setTab,
  theme,
  setTheme,
  syncError,
  notebooks,
  tasksByDate,
  meetingsByDate,
  onSignOut,
  onExport,
  onImport,
  onClearAll,
}) {
  if (!open) return null;
  return (
        <div className="nmd-modal-backdrop" onClick={onClose}>
          <div className="nmd-modal nmd-modal-settings" onClick={e => e.stopPropagation()}>
            <div className="nmd-modal-header">
              <h2>Settings & data</h2>
              <button className="nmd-iconbtn" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="nmd-modal-body">
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Account</div>
                  <div className="nmd-modal-row-desc">{user.email}</div>
                </div>
                <button className="nmd-btn" onClick={onSignOut}>Sign out</button>
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
                <button className="nmd-btn primary" onClick={onExport}>Export</button>
              </div>
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Import backup</div>
                  <div className="nmd-modal-row-desc">Replace current data with a previously exported file.</div>
                </div>
                <label className="nmd-btn" style={{ cursor: 'pointer' }}>
                  Import
                  <input type="file" accept=".json,application/json" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files[0]; if (f) onImport(f); e.target.value = ''; }} />
                </label>
              </div>
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Reset everything</div>
                  <div className="nmd-modal-row-desc">Erase all notebooks, pages, and tracker entries.</div>
                </div>
                <button className="nmd-btn danger" onClick={onClearAll}>Erase data</button>
              </div>
            </div>
          </div>
        </div>
  );
}
