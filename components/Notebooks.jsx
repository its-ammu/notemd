// Notebooks feature — notebook tree + page editor
// Relies on window.MarkdownView, window.useStorage

const NB_COLORS = [
  { id: 'blue',    color: '#5167F4', label: 'Blue' },
  { id: 'purple',  color: '#C89EF4', label: 'Purple' },
  { id: 'rose',    color: '#CD2C54', label: 'Rose' },
  { id: 'deep',    color: '#6B52AE', label: 'Deep' },
  { id: 'ink',     color: '#444444', label: 'Graphite' },
  { id: 'moss',    color: '#7A8A5F', label: 'Moss' },
  { id: 'rust',    color: '#B85C2C', label: 'Rust' },
];

function relTime(ts) {
  if (!ts) return '';
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'now';
  if (d < 3600) return Math.floor(d/60) + 'm';
  if (d < 86400) return Math.floor(d/3600) + 'h';
  const days = Math.floor(d/86400);
  if (days === 1) return 'yesterday';
  if (days < 7) return days + 'd';
  if (days < 14) return 'last week';
  if (days < 30) return Math.floor(days/7) + 'w';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function NotebooksPane({ notebooks, setNotebooks, activeSel, setActiveSel }) {
  const [openIds, setOpenIds] = React.useState(() => new Set(notebooks.map(n => n.id).slice(0, 3)));
  const [query, setQuery] = React.useState('');
  const [creatingNb, setCreatingNb] = React.useState(false);
  const [newNbName, setNewNbName] = React.useState('');
  const [menuState, setMenuState] = React.useState(null); // {x, y, nbId}
  const [renamingNbId, setRenamingNbId] = React.useState(null);
  const [view, setView] = React.useState(() => localStorage.getItem('nmd_view') || 'rendered');

  React.useEffect(() => { localStorage.setItem('nmd_view', view); }, [view]);

  const activeNb = notebooks.find(n => n.id === activeSel.nbId) || notebooks[0];
  const activePage = activeNb?.pages.find(p => p.id === activeSel.pageId) || activeNb?.pages[0];

  // Ensure activeSel valid
  React.useEffect(() => {
    if (!activeNb) return;
    if (!activeNb.pages.find(p => p.id === activeSel.pageId)) {
      setActiveSel({ nbId: activeNb.id, pageId: activeNb.pages[0]?.id || null });
    }
  }, [activeNb, activeSel.pageId]);

  React.useEffect(() => {
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
    const id = 'nb' + Date.now();
    const color = NB_COLORS[notebooks.length % NB_COLORS.length].color;
    const firstPage = { id: 'p' + Date.now(), title: '', body: '', created: Date.now(), updated: Date.now() };
    const nb = { id, name, color, paper: 'plain', pages: [firstPage] };
    setNotebooks(nbs => [...nbs, nb]);
    setOpenIds(s => new Set([...s, id]));
    setActiveSel({ nbId: id, pageId: firstPage.id });
    setNewNbName(''); setCreatingNb(false);
  };

  const newPage = (nbId) => {
    const id = 'p' + Date.now();
    const page = { id, title: '', body: '', created: Date.now(), updated: Date.now() };
    setNotebooks(nbs => nbs.map(nb => nb.id === nbId ? { ...nb, pages: [page, ...nb.pages] } : nb));
    setOpenIds(s => new Set([...s, nbId]));
    setActiveSel({ nbId, pageId: id });
  };

  const deletePage = (nbId, pageId) => {
    setNotebooks(nbs => nbs.map(nb => nb.id === nbId ? { ...nb, pages: nb.pages.filter(p => p.id !== pageId) } : nb));
  };

  const setPaper = (paper) => updateNb(activeNb.id, { paper });

  return (
    <React.Fragment>
      {/* Sidebar */}
      <aside className="nmd-sidebar" data-screen-label="Notebooks sidebar">
        <div className="nmd-sidebar-top">
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <span style={{
              fontFamily:'var(--font-sans)', fontWeight:600, fontSize:16,
              color:'var(--fg1)', letterSpacing:'-0.01em'
            }}>Notebooks</span>
          </div>
          <button
            className="nmd-iconbtn"
            onClick={() => { setCreatingNb(true); }}
            aria-label="New notebook" title="New notebook"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
        <div className="nmd-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input placeholder="Find in notes" value={query} onChange={e => setQuery(e.target.value)}/>
          <span className="nmd-kbd">⌘K</span>
        </div>
        <div className="nmd-note-count">
          {notebooks.length} {notebooks.length === 1 ? 'notebook' : 'notebooks'} · {notebooks.reduce((a,b) => a + b.pages.length, 0)} pages
        </div>

        {creatingNb && (
          <div className="nmd-inline-form">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--fg3)" strokeWidth="2"><path d="M4 19V8l8-4 8 4v11"/><path d="M4 19h16"/></svg>
            <input
              autoFocus
              placeholder="Notebook name"
              value={newNbName}
              onChange={e => setNewNbName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') createNotebook();
                if (e.key === 'Escape') { setCreatingNb(false); setNewNbName(''); }
              }}
              onBlur={() => { if (!newNbName.trim()) { setCreatingNb(false); } }}
            />
          </div>
        )}

        <div className="nmd-nb">
          {notebooks.map(nb => {
            const open = openIds.has(nb.id);
            const pages = query
              ? nb.pages.filter(p => (p.title + ' ' + p.body).toLowerCase().includes(query.toLowerCase()))
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
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6"/></svg>
                  </span>
                  <span className="nmd-nb-dot" style={{background: nb.color}}/>
                  {renamingNbId === nb.id ? (
                    <input
                      autoFocus
                      defaultValue={nb.name}
                      style={{
                        flex:1, border:'none', outline:'none', background:'var(--bg-raised)',
                        font:'inherit', fontSize:13, color:'var(--fg1)', padding:'1px 4px', borderRadius:3
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
                    {pages.map(p => (
                      <button
                        key={p.id}
                        className={'nmd-page-row' + (p.id === activePage?.id ? ' sel' : '')}
                        onClick={() => setActiveSel({ nbId: nb.id, pageId: p.id })}
                        onContextMenu={e => {
                          e.preventDefault(); e.stopPropagation();
                          setMenuState({ x: e.clientX, y: e.clientY, nbId: nb.id, pageId: p.id });
                        }}
                      >
                        <span className="nmd-page-title">{p.title || 'Untitled'}</span>
                        <span className="nmd-page-meta">{relTime(p.updated)}</span>
                      </button>
                    ))}
                    <button className="nmd-nb-newpage" onClick={() => newPage(nb.id)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                      New page
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main editor area */}
      <main className="nmd-main" style={{'--nb-accent': activeNb?.color || '#5167F4'}}>
        {activeNb && activePage ? (
          <React.Fragment>
            <header className="nmd-header">
              <span className="nmd-nb-strip"/>
              <span className="nmd-nb-context"><b>{activeNb.name}</b></span>
              <span style={{color:'var(--fg4)', fontFamily:'var(--font-mono)', fontSize:12}}>/</span>
              <input
                className="nmd-title-input"
                value={activePage.title}
                placeholder="Untitled"
                onChange={e => updatePage({ title: e.target.value })}
              />
              <span className="nmd-saved" title="Stored in your browser">Saved locally</span>
              <div className="nmd-paper-picker" title="Paper style">
                {['plain','dotted','squared'].map(pap => (
                  <button
                    key={pap}
                    className={activeNb.paper === pap ? 'active' : ''}
                    onClick={() => setPaper(pap)}
                    title={pap}
                  >
                    {pap === 'plain' && <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>}
                    {pap === 'dotted' && <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>{[5,8,11].flatMap(y => [5,8,11].map(x => <circle key={x+','+y} cx={x} cy={y} r="0.7" fill="currentColor"/>))}</svg>}
                    {pap === 'squared' && <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M2 6h12M2 10h12M6 2v12M10 2v12" stroke="currentColor" strokeWidth="0.6" opacity="0.6"/></svg>}
                  </button>
                ))}
              </div>
              <div className="nmd-view-toggle">
                <button className={view === 'rendered' ? 'active' : ''} onClick={() => setView('rendered')}>Read</button>
                <button className={view === 'source' ? 'active' : ''} onClick={() => setView('source')}>Edit</button>
              </div>
            </header>
            <div className="nmd-editor nmd-mode-preview">
              {view === 'source' ? (
                <div className="nmd-pane nmd-pane-write">
                  <textarea
                    value={activePage.body}
                    onChange={e => updatePage({ body: e.target.value })}
                    spellCheck={false}
                    placeholder="# Start typing&#10;&#10;Your words. On your machine."
                  />
                </div>
              ) : (
                <div className={'nmd-pane nmd-pane-preview nmd-paper ' + (activeNb.paper || 'plain')}>
                  {activePage.body.trim() ? (
                    <window.MarkdownView source={activePage.body} />
                  ) : (
                    <div style={{color:'var(--fg4)', fontSize:14, lineHeight:1.6, maxWidth:600}}>
                      <p style={{fontSize:15, color:'var(--fg3)'}}>Empty page.</p>
                      <p>Switch to <b style={{color:'var(--fg2)'}}>Edit</b> to start writing in markdown.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </React.Fragment>
        ) : (
          <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'var(--fg3)'}}>
            <div style={{fontSize:14}}>No page selected.</div>
            <div style={{fontSize:12, color:'var(--fg4)', fontFamily:'var(--font-mono)'}}>Select a notebook, or press <span className="kbd">⌘N</span>.</div>
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
            <React.Fragment>
              <button onClick={() => { setActiveSel({ nbId: menuState.nbId, pageId: menuState.pageId }); setMenuState(null); }}>
                Open page
              </button>
              <button onClick={() => {
                const nb = notebooks.find(n => n.id === menuState.nbId);
                const p = nb.pages.find(p => p.id === menuState.pageId);
                const copy = { ...p, id: 'p' + Date.now(), title: (p.title || 'Untitled') + ' copy', updated: Date.now(), created: Date.now() };
                setNotebooks(nbs => nbs.map(n => n.id === nb.id ? { ...n, pages: [copy, ...n.pages] } : n));
                setMenuState(null);
              }}>Duplicate</button>
              <hr/>
              <button className="danger" onClick={() => { deletePage(menuState.nbId, menuState.pageId); setMenuState(null); }}>
                Delete page
              </button>
            </React.Fragment>
          ) : (
            <React.Fragment>
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
                      style={{background: opt.color}}
                      title={opt.label}
                      onClick={() => { updateNb(menuState.nbId, { color: opt.color }); setMenuState(null); }}
                    />
                  );
                })}
              </div>
              <hr/>
              <button className="danger" onClick={() => { deleteNb(menuState.nbId); setMenuState(null); }}>Delete notebook</button>
            </React.Fragment>
          )}
        </div>
      )}
    </React.Fragment>
  );
}

window.NotebooksPane = NotebooksPane;
window.NB_COLORS = NB_COLORS;
window.relTime = relTime;
