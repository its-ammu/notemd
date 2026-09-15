import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { IMAGE_BUCKET } from '../lib/uploadImage';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

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
  // Which settings tab is showing; reset to General each time the modal opens.
  const [settingsTab, setSettingsTab] = useState('general');
  useEffect(() => { if (open) setSettingsTab('general'); }, [open]);

  const storageSize = useMemo(
    () => new Blob([JSON.stringify({ notebooks, tasksByDate, meetingsByDate })]).size,
    [notebooks, tasksByDate, meetingsByDate]
  );

  // Total bytes of images uploaded by this user (page-images/<userId>/…).
  // null while loading or if the listing fails (e.g. bucket not set up).
  const [imageBytes, setImageBytes] = useState(null);
  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        let total = 0;
        const PAGE = 100;
        for (let offset = 0; ; offset += PAGE) {
          const { data, error } = await supabase.storage
            .from(IMAGE_BUCKET)
            .list(user.id, { limit: PAGE, offset });
          if (error || !data) { if (offset === 0) return; break; }
          total += data.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);
          if (data.length < PAGE) break;
        }
        if (!cancelled) setImageBytes(total);
      } catch {
        /* leave as null — row falls back to text-only size */
      }
    })();
    return () => { cancelled = true; };
  }, [open, user?.id]);

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
            <div className="nmd-modal-tabs" role="tablist" aria-label="Settings sections">
              {[
                { id: 'general', label: 'General' },
                { id: 'tracker', label: 'Tracker' },
                { id: 'data', label: 'Data' },
              ].map(t => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={settingsTab === t.id}
                  className={settingsTab === t.id ? 'active' : ''}
                  onClick={() => setSettingsTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="nmd-modal-body">
              {settingsTab === 'general' && (
                <>
                  <div className="nmd-modal-row">
                    <div className="nmd-modal-row-text">
                      <div className="nmd-modal-row-title">Account</div>
                      <div className="nmd-modal-row-desc">{user.email}</div>
                    </div>
                    <button className="nmd-btn" onClick={onSignOut}>Sign out</button>
                  </div>
                  <div className="nmd-modal-row">
                    <div className="nmd-modal-row-text">
                      <label className="nmd-modal-row-title" htmlFor="nmd-display-name">Display name</label>
                      <div className="nmd-modal-row-desc">Shown on your home screen greeting.</div>
                    </div>
                    <input
                      id="nmd-display-name"
                      className="nmd-modal-input"
                      type="text"
                      value={profile?.display_name || ''}
                      onChange={e => updateProfile({ display_name: e.target.value })}
                      placeholder="Your name"
                      autoComplete="nickname"
                    />
                  </div>
                  <div className="nmd-modal-row">
                    <div className="nmd-modal-row-text">
                      <div className="nmd-modal-row-title">Default view</div>
                      <div className="nmd-modal-row-desc">Which tab opens when you launch the app.</div>
                    </div>
                    <div className="nmd-segmented nmd-segmented-compact" role="group" aria-label="Default view">
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
                </>
              )}
              {settingsTab === 'tracker' && (
                <>
                  <div className="nmd-modal-row">
                    <div className="nmd-modal-row-text">
                      <div className="nmd-modal-row-title">Meetings in tracker</div>
                      <div className="nmd-modal-row-desc">Inside each day, or in a panel below the week.</div>
                    </div>
                    <div className="nmd-segmented nmd-segmented-compact" role="group" aria-label="Meetings in tracker">
                      {[
                        { value: 'inline', label: 'In columns' },
                        { value: 'drawer', label: 'Bottom panel' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          className={'nmd-segmented-btn' + ((prefs.meetingsDisplay || 'inline') === opt.value ? ' active' : '')}
                          onClick={() => updateProfile({ preferences: { meetingsDisplay: opt.value } })}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="nmd-modal-row">
                    <div className="nmd-modal-row-text">
                      <div className="nmd-modal-row-title">Copied meetings</div>
                      <div className="nmd-modal-row-desc">What "Copy entries" includes for each meeting.</div>
                    </div>
                    <div className="nmd-segmented nmd-segmented-compact" role="group" aria-label="Copied meetings">
                      {[
                        { value: 'full', label: 'Time + duration' },
                        { value: 'title', label: 'Name only' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          className={'nmd-segmented-btn' + ((prefs.copyMeetingDetails || 'full') === opt.value ? ' active' : '')}
                          onClick={() => updateProfile({ preferences: { copyMeetingDetails: opt.value } })}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="nmd-modal-row">
                    <div className="nmd-modal-row-text">
                      <div className="nmd-modal-row-title">Copied text case</div>
                      <div className="nmd-modal-row-desc">Capitalisation applied to copied entries.</div>
                    </div>
                    <div className="nmd-segmented nmd-segmented-compact" role="group" aria-label="Copied text case">
                      {[
                        { value: 'original', label: 'As typed', title: 'Keep text exactly as you wrote it' },
                        { value: 'lower', label: 'abc', title: 'lowercase everything' },
                        { value: 'upper', label: 'ABC', title: 'UPPERCASE EVERYTHING' },
                        { value: 'title', label: 'Abc', title: 'Title Case Every Word' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          title={opt.title}
                          className={'nmd-segmented-btn' + ((prefs.copyCase || 'original') === opt.value ? ' active' : '')}
                          onClick={() => updateProfile({ preferences: { copyCase: opt.value } })}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {settingsTab === 'data' && (
                <>
                  <div className="nmd-modal-row nmd-modal-row-storage">
                    <div className="nmd-modal-row-text">
                      <div className="nmd-modal-row-title">Storage</div>
                      <div className="nmd-modal-row-desc">
                        {syncError ? <span style={{ color: '#c1432b' }}>Sync error: {syncError}</span> : 'Synced to Supabase. Changes save automatically.'}
                      </div>
                    </div>
                    <div className="nmd-storage-stats">
                      <span className="nmd-storage-stat">
                        <strong>{imageBytes != null ? formatBytes(storageSize + imageBytes) : formatBytes(storageSize)}</strong> used
                      </span>
                      {imageBytes != null && imageBytes > 0 && (
                        <span className="nmd-storage-stat"><strong>{formatBytes(imageBytes)}</strong> images</span>
                      )}
                      <span className="nmd-storage-stat"><strong>{notebooks.reduce((a, b) => a + b.pages.length, 0)}</strong> pages</span>
                      <span className="nmd-storage-stat"><strong>{Object.values(tasksByDate).reduce((a, b) => a + b.length, 0)}</strong> tasks</span>
                      <span className="nmd-storage-stat"><strong>{Object.values(meetingsByDate).reduce((a, b) => a + b.length, 0)}</strong> meetings</span>
                    </div>
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
                </>
              )}
            </div>
          </div>
        </div>
  );
}
