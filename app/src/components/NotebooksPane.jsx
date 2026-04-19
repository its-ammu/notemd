import React, { useState, useEffect, useMemo, useRef } from 'react';
import MarkdownView from './MarkdownView';
import { NB_COLORS } from '../utils/constants';
import { relTime } from '../utils/time';
import { parseHeadings } from '../utils/markdown';

function makeSnippet(body, q) {
  if (!body || !q) return null;
  const flat = body.replace(/\s+/g, ' ').trim();
  const idx = flat.toLowerCase().indexOf(q);
  if (idx === -1) return null;
  const before = 30, after = 60;
  const start = Math.max(0, idx - before);
  const end = Math.min(flat.length, idx + q.length + after);
  const prefix = start > 0 ? '… ' : '';
  const suffix = end < flat.length ? ' …' : '';
  const matchStart = idx - start;
  const raw = flat.slice(start, end);
  return (
    <>
      {prefix}
      {raw.slice(0, matchStart)}
      <mark>{raw.slice(matchStart, matchStart + q.length)}</mark>
      {raw.slice(matchStart + q.length)}
      {suffix}
    </>
  );
}

export default function NotebooksPane({ notebooks, setNotebooks, activeSel, setActiveSel }) {
  const [openIds, setOpenIds] = useState(() => new Set(notebooks.map(n => n.id).slice(0, 3)));
  const [query, setQuery] = useState('');
  const [creatingNb, setCreatingNb] = useState(false);
  const [newNbName, setNewNbName] = useState('');
  const [menuState, setMenuState] = useState(null);
  const [renamingNbId, setRenamingNbId] = useState(null);
  const [view, setView] = useState(() => localStorage.getItem('nmd_view') || 'rendered');
  const [mobileTree, setMobileTree] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('nmd_nb_sidebar') === 'collapsed');
  const [tocOpen, setTocOpen] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => { localStorage.setItem('nmd_view', view); }, [view]);
  useEffect(() => {
    localStorage.setItem('nmd_nb_sidebar', sidebarCollapsed ? 'collapsed' : 'open');
    document.body.classList.toggle('nmd-nb-collapsed', sidebarCollapsed);
    return () => document.body.classList.remove('nmd-nb-collapsed');
  }, [sidebarCollapsed]);

  const openPage = (nbId, pageId) => { setActiveSel({ nbId, pageId }); setMobileTree(false); };

  const activeNb = notebooks.find(n => n.id === activeSel.nbId) || notebooks[0];
  const activePage = activeNb?.pages.find(p => p.id === activeSel.pageId) || activeNb?.pages[0];

  useEffect(() => {
    if (!activeNb) return;
    if (!activeNb.pages.find(p => p.id === activeSel.pageId)) {
      setActiveSel({ nbId: activeNb.id, pageId: activeNb.pages[0]?.id || null });
    }
  }, [activeNb, activeSel.pageId]);

  useEffect(() => {
    const close = () => setMenuState(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const toggleNb = (id) => {
    setOpenIds(s => { const ns = new Set(s); if (ns.has(id)) ns.delete(id); else ns.add(id); return ns; });
  };

  const updateNb = (id, patch) => setNotebooks(nbs => nbs.map(nb => nb.id === id ? { ...nb, ...patch } : nb));
  const deleteNb = (id) => {
    if (!confirm('Delete this notebook and all its pages?')) return;
    setNotebooks(nbs => nbs.filter(nb => nb.id !== id));
  };

  const updatePage = (patch) => {
    setNotebooks(nbs => nbs.map(nb => nb.id !== activeNb.id ? nb : {
      ...nb,
      pages: nb.pages.map(p => p.id === activePage.id ? { ...p, ...patch, updated: Date.now() } : p),
    }));
  };

  const createNotebook = () => {
    const name = newNbName.trim() || 'New notebook';
    const id = crypto.randomUUID();
    const color = NB_COLORS[notebooks.length % NB_COLORS.length].color;
    const firstPage = { id: crypto.randomUUID(), title: '', body: '', created: Date.now(), updated: Date.now() };
    const nb = { id, name, color, paper: 'plain', pages: [firstPage] };
    setNotebooks(nbs => [...nbs, nb]);
    setOpenIds(s => new Set([...s, id]));
    setActiveSel({ nbId: id, pageId: firstPage.id });
    setNewNbName('');
    setCreatingNb(false);
  };

  const newPage = (nbId) => {
    const id = crypto.randomUUID();
    const page = { id, title: '', body: '', created: Date.now(), updated: Date.now() };
    setNotebooks(nbs => nbs.map(nb => nb.id === nbId ? { ...nb, pages: [page, ...nb.pages] } : nb));
    setOpenIds(s => new Set([...s, nbId]));
    setActiveSel({ nbId, pageId: id });
  };

  const deletePage = (nbId, pageId) => {
    setNotebooks(nbs => nbs.map(nb => nb.id === nbId ? { ...nb, pages: nb.pages.filter(p => p.id !== pageId) } : nb));
  };

  const setPaper = (paper) => updateNb(activeNb.id, { paper });

  const headings = useMemo(() => parseHeadings(activePage?.body || ''), [activePage?.body]);

  const scrollToHeading = (id) => {
    const root = previewRef.current;
    if (!root) return;
    const el = root.querySelector('#' + CSS.escape(id));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTocOpen(false);
  };

  return (
    <>
      {/* Sidebar */}
      <aside className={'nmd-sidebar ' + (mobileTree ? 'm-on' : 'm-off') + (sidebarCollapsed ? ' collapsed' : '')}>
        <div className="nmd-sidebar-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 16,
              color: 'var(--fg1)', letterSpacing: '-0.01em'
            }}>Notebooks</span>
          </div>
          <button
            className="nmd-iconbtn"
            onClick={() => setCreatingNb(true)}
            aria-label="New notebook" title="New notebook"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
        <div className="nmd-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input placeholder="Find in notes" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="nmd-note-count">
          {notebooks.length} {notebooks.length === 1 ? 'notebook' : 'notebooks'} · {notebooks.reduce((a, b) => a + b.pages.length, 0)} pages
        </div>

        {creatingNb && (
          <div className="nmd-inline-form">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--fg3)" strokeWidth="2"><path d="M4 19V8l8-4 8 4v11" /><path d="M4 19h16" /></svg>
            <input
              autoFocus
              placeholder="Notebook name"
              value={newNbName}
              onChange={e => setNewNbName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') createNotebook();
                if (e.key === 'Escape') { setCreatingNb(false); setNewNbName(''); }
              }}
              onBlur={() => { if (!newNbName.trim()) setCreatingNb(false); }}
            />
          </div>
        )}

        <div className="nmd-nb">
          {(() => {
            const q = query.trim().toLowerCase();
            const visibleNotebooks = q
              ? notebooks.filter(nb =>
                  nb.name.toLowerCase().includes(q) ||
                  nb.pages.some(p => (p.title + ' ' + p.body).toLowerCase().includes(q))
                )
              : notebooks;
            if (q && visibleNotebooks.length === 0) {
              return (
                <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--fg4)' }}>
                  No matches for "{query}"
                </div>
              );
            }
            return visibleNotebooks.map(nb => {
            const open = q ? true : openIds.has(nb.id);
            const nbNameMatches = q && nb.name.toLowerCase().includes(q);
            const pages = q && !nbNameMatches
              ? nb.pages.filter(p => (p.title + ' ' + p.body).toLowerCase().includes(q))
              : nb.pages;
            return (
              <div key={nb.id}>
                <button
                  className="nmd-nb-row"
                  onClick={() => toggleNb(nb.id)}
                  onContextMenu={e => {
                    e.preventDefault();
                    setMenuState({ x: e.clientX, y: e.clientY, nbId: nb.id });
                  }}
                >
                  <span className={'nmd-nb-chev' + (open ? ' open' : '')}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>
                  </span>
                  <span className="nmd-nb-dot" style={{ background: nb.color }} />
                  {renamingNbId === nb.id ? (
                    <input
                      autoFocus
                      defaultValue={nb.name}
                      style={{
                        flex: 1, border: 'none', outline: 'none', background: 'var(--bg-raised)',
                        font: 'inherit', fontSize: 13, color: 'var(--fg1)', padding: '1px 4px', borderRadius: 3
                      }}
                      onClick={e => e.stopPropagation()}
                      onBlur={e => { updateNb(nb.id, { name: e.target.value.trim() || nb.name }); setRenamingNbId(null); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') e.target.blur();
                        if (e.key === 'Escape') setRenamingNbId(null);
                      }}
                    />
                  ) : (
                    <span className="nmd-nb-name">{nb.name}</span>
                  )}
                  <span className="nmd-nb-count">{nb.pages.length}</span>
                </button>
                {open && (
                  <div className="nmd-nb-pages">
                    {pages.map(p => {
                      const snippet = q && !(p.title || '').toLowerCase().includes(q)
                        ? makeSnippet(p.body, q)
                        : null;
                      return (
                        <button
                          key={p.id}
                          className={'nmd-page-row' + (p.id === activePage?.id ? ' sel' : '') + (snippet ? ' with-snippet' : '')}
                          onClick={() => openPage(nb.id, p.id)}
                          onContextMenu={e => {
                            e.preventDefault(); e.stopPropagation();
                            setMenuState({ x: e.clientX, y: e.clientY, nbId: nb.id, pageId: p.id });
                          }}
                        >
                          <div className="nmd-page-row-main">
                            <span className="nmd-page-title">{p.title || 'Untitled'}</span>
                            <span className="nmd-page-meta">{relTime(p.updated)}</span>
                          </div>
                          {snippet && <div className="nmd-page-snippet">{snippet}</div>}
                        </button>
                      );
                    })}
                    <button className="nmd-nb-newpage" onClick={() => newPage(nb.id)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                      New page
                    </button>
                  </div>
                )}
              </div>
            );
            });
          })()}
        </div>
      </aside>

      {/* Main editor area */}
      <main className={'nmd-main ' + (mobileTree ? 'm-off' : 'm-on')} style={{ '--nb-accent': activeNb?.color || '#5167F4' }}>
        {activeNb && activePage ? (
          <>
            <header className="nmd-header">
              <button
                className="nmd-iconbtn nmd-mobile-back"
                onClick={() => setMobileTree(true)}
                aria-label="Back to notebooks"
                title="Back"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
              </button>
              <button
                className="nmd-iconbtn nmd-collapse-btn"
                onClick={() => setSidebarCollapsed(v => !v)}
                aria-label={sidebarCollapsed ? 'Show notebook list' : 'Hide notebook list'}
                title={sidebarCollapsed ? 'Show notebook list' : 'Hide notebook list'}
              >
                {sidebarCollapsed ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18M3 12h12M3 19h18" /></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6" /></svg>
                )}
              </button>
              <span className="nmd-nb-strip" />
              <span className="nmd-nb-context"><b>{activeNb.name}</b></span>
              <span style={{ color: 'var(--fg4)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>/</span>
              <input
                className="nmd-title-input"
                value={activePage.title}
                placeholder="Untitled"
                onChange={e => updatePage({ title: e.target.value })}
              />
              <span className="nmd-saved" title="Stored in your browser">Saved locally</span>
              <div className="nmd-paper-picker" title="Paper style">
                {['plain', 'dotted', 'squared'].map(pap => (
                  <button
                    key={pap}
                    className={activeNb.paper === pap ? 'active' : ''}
                    onClick={() => setPaper(pap)}
                    title={pap}
                  >
                    {pap === 'plain' && <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" /></svg>}
                    {pap === 'dotted' && <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />{[5, 8, 11].flatMap(y => [5, 8, 11].map(x => <circle key={x + ',' + y} cx={x} cy={y} r="0.7" fill="currentColor" />))}</svg>}
                    {pap === 'squared' && <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M2 6h12M2 10h12M6 2v12M10 2v12" stroke="currentColor" strokeWidth="0.6" opacity="0.6" /></svg>}
                  </button>
                ))}
              </div>
              <div className="nmd-view-toggle">
                <button className={view === 'rendered' ? 'active' : ''} onClick={() => setView('rendered')}>Read</button>
                <button className={view === 'source' ? 'active' : ''} onClick={() => setView('source')}>Edit</button>
              </div>
            </header>
            <div className={'nmd-editor ' + (view === 'source' ? 'nmd-mode-split' : 'nmd-mode-preview')}>
              {view === 'source' && (
                <div className="nmd-pane nmd-pane-write">
                  <textarea
                    value={activePage.body}
                    onChange={e => updatePage({ body: e.target.value })}
                    spellCheck={false}
                    placeholder={'# Start typing\n\nYour words. On your machine.'}
                  />
                </div>
              )}
              <div
                ref={previewRef}
                className={'nmd-pane nmd-pane-preview nmd-paper ' + (activeNb.paper || 'plain')}
              >
                {activePage.body.trim() ? (
                  <MarkdownView source={activePage.body} />
                ) : (
                  <div style={{ color: 'var(--fg4)', fontSize: 14, lineHeight: 1.6, maxWidth: 600 }}>
                    <p style={{ fontSize: 15, color: 'var(--fg3)' }}>Empty page.</p>
                    <p>Switch to <b style={{ color: 'var(--fg2)' }}>Edit</b> to start writing in markdown.</p>
                  </div>
                )}
              </div>
            </div>
            {view === 'rendered' && headings.length > 0 && (
              <>
                <button
                  className="nmd-toc-fab"
                  onClick={() => setTocOpen(v => !v)}
                  aria-label={tocOpen ? 'Hide contents' : 'Show contents'}
                  title="On this page"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M4 12h10M4 18h16" /></svg>
                </button>
                {tocOpen && (
                  <>
                    <div className="nmd-toc-backdrop" onClick={() => setTocOpen(false)} />
                    <aside className="nmd-toc nmd-toc-drawer" aria-label="On this page">
                      <div className="nmd-toc-header">
                        <div className="nmd-toc-label">On this page</div>
                        <button className="nmd-iconbtn" onClick={() => setTocOpen(false)} aria-label="Close">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                      </div>
                      <ul>
                        {headings.map(h => (
                          <li key={h.id} className={'nmd-toc-lvl-' + h.level}>
                            <button onClick={() => scrollToHeading(h.id)} title={h.text}>{h.text}</button>
                          </li>
                        ))}
                      </ul>
                    </aside>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--fg3)' }}>
            <div style={{ fontSize: 14 }}>No page selected.</div>
            <div style={{ fontSize: 12, color: 'var(--fg4)', fontFamily: 'var(--font-mono)' }}>Open a notebook and pick a page, or create a new one.</div>
          </div>
        )}
      </main>

      {/* Context menu */}
      {menuState && (
        <div
          className="nmd-menu"
          style={{ left: menuState.x, top: menuState.y }}
          onClick={e => e.stopPropagation()}
        >
          {menuState.pageId ? (
            <>
              <button onClick={() => { openPage(menuState.nbId, menuState.pageId); setMenuState(null); }}>
                Open page
              </button>
              <button onClick={() => {
                const nb = notebooks.find(n => n.id === menuState.nbId);
                const p = nb.pages.find(p => p.id === menuState.pageId);
                const copy = { ...p, id: crypto.randomUUID(), title: (p.title || 'Untitled') + ' copy', updated: Date.now(), created: Date.now() };
                setNotebooks(nbs => nbs.map(n => n.id === nb.id ? { ...n, pages: [copy, ...n.pages] } : n));
                setMenuState(null);
              }}>Duplicate</button>
              <hr />
              <button className="danger" onClick={() => { deletePage(menuState.nbId, menuState.pageId); setMenuState(null); }}>
                Delete page
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { newPage(menuState.nbId); setMenuState(null); }}>New page</button>
              <button onClick={() => { setRenamingNbId(menuState.nbId); setMenuState(null); }}>Rename</button>
              <div className="nmd-menu-label">Color</div>
              <div className="nmd-menu-swatches">
                {NB_COLORS.map(opt => {
                  const nb = notebooks.find(n => n.id === menuState.nbId);
                  const sel = nb && nb.color === opt.color;
                  return (
                    <button
                      key={opt.id}
                      className={sel ? 'sel' : ''}
                      style={{ background: opt.color }}
                      title={opt.label}
                      onClick={() => { updateNb(menuState.nbId, { color: opt.color }); setMenuState(null); }}
                    />
                  );
                })}
              </div>
              <hr />
              <button className="danger" onClick={() => { deleteNb(menuState.nbId); setMenuState(null); }}>Delete notebook</button>
            </>
          )}
        </div>
      )}
    </>
  );
}
