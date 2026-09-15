import React from 'react';

export default function HowToModal({
  open,
  onClose,
  expanded,
  onToggleExpanded,
  howToTab,
  setHowToTab,
}) {
  if (!open) return null;
  return (
        <div className="nmd-modal-backdrop" onClick={onClose}>
          <div className={'nmd-modal nmd-modal-howto' + (expanded ? ' expanded' : '')} onClick={e => e.stopPropagation()}>
            <div className="nmd-modal-header">
              <h2>How to use NoteMD</h2>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="nmd-iconbtn"
                  onClick={() => onToggleExpanded(!expanded)}
                  aria-label={expanded ? 'Shrink' : 'Expand'}
                  title={expanded ? 'Shrink' : 'Expand'}
                >
                  {expanded ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4v5H4M20 15h-5v5M9 9 4 4M20 20l-5-5" /></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10V4h6M20 14v6h-6M4 4l6 6M20 20l-6-6" /></svg>
                  )}
                </button>
                <button className="nmd-iconbtn" onClick={() => onClose()} aria-label="Close">
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
  );
}
