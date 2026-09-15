import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import MarkdownView from './editor/MarkdownView';
import MarkdownEditor from './editor/MarkdownEditor';
import { NB_COLORS } from '../../shared/utils/constants';
import { parseHeadings } from './editor/markdown';
import { setPagePublic } from '../../shared/lib/sync';
import { setImageRefSize } from '../../shared/lib/uploadImage';
import { tagStyle } from '../../shared/utils/tags';
import EmptyState from '../../shared/components/EmptyState';
import FixedContextMenu from '../../shared/components/FixedContextMenu';
import { HelpIcon } from '../../shared/components/Tooltip';
import { useStoredState } from '../../shared/hooks/useStoredState';
import {
  SIDEBAR_DEFAULT, SIDEBAR_MIN, SIDEBAR_MAX, SIDEBAR_COLLAPSE, clampSidebarW, shareBase,
} from './helpers';
import TagInput from './TagInput';
import NotebookSidebar from './NotebookSidebar';
import ShareDialog from './ShareDialog';

export default function NotebooksPane({ notebooks, setNotebooks, activeSel, setActiveSel, saving, syncError, showToast }) {
  const [openIds, setOpenIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nmd_nb_open') || 'null');
      if (Array.isArray(saved)) return new Set(saved);
    } catch { /* ignore */ }
    return new Set(notebooks.map(n => n.id).slice(0, 3));
  });
  const [query, setQuery] = useState('');
  const [tagFilters, setTagFilters] = useState([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [creatingNb, setCreatingNb] = useState(false);
  const [newNbName, setNewNbName] = useState('');
  const [menuState, setMenuState] = useState(null);
  const [renamingNbId, setRenamingNbId] = useState(null);
  const [view, setView] = useState(() => localStorage.getItem('nmd_view') || 'rendered');
  const [mobileTree, setMobileTree] = useState(true);
  // Not persisted on purpose — reloading into a chrome-less view is disorienting.
  const [focusMode, setFocusMode] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareExpiry, setShareExpiry] = useState('never'); // 'keep' | 'never' | days
  const [shareHideTags, setShareHideTags] = useState(false);
  const previewRef = useRef(null);
  const longPressRef = useRef(null);
  const [sidebarW, setSidebarW] = useStoredState('nmd_sidebar_w', SIDEBAR_DEFAULT);
  const [sidebarOpen, setSidebarOpen] = useStoredState('nmd_sidebar_open', true);
  const [dragW, setDragW] = useState(null);
  const resizingRef = useRef(null);
  const dragWRef = useRef(null);

  const appliedSidebarW = dragW ?? sidebarW;

  useLayoutEffect(() => {
    const shell = document.querySelector('.nmd-app-shell');
    if (!shell) return;
    const open = sidebarOpen || dragW != null;
    shell.style.setProperty('--sidebar-w', open ? `${appliedSidebarW}px` : '0px');
    shell.classList.toggle('sidebar-collapsed', !open);
    return () => {
      shell.classList.remove('sidebar-collapsed', 'sidebar-resizing');
      shell.style.removeProperty('--sidebar-w');
    };
  }, [sidebarOpen, appliedSidebarW, dragW]);

  const openSidebar = () => {
    setSidebarW(w => (w < SIDEBAR_MIN ? SIDEBAR_DEFAULT : w));
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setDragW(null);
    setSidebarOpen(false);
  };

  const onSidebarResizeStart = (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = appliedSidebarW;
    resizingRef.current = { startX, startW, el: e.currentTarget };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    document.querySelector('.nmd-app-shell')?.classList.add('sidebar-resizing');
    document.body.classList.add('nmd-resizing-sidebar');
    setDragW(startW);
    dragWRef.current = startW;
  };

  const onSidebarResizeMove = (e) => {
    const r = resizingRef.current;
    if (!r) return;
    const next = Math.min(SIDEBAR_MAX, Math.max(0, r.startW + (e.clientX - r.startX)));
    dragWRef.current = next;
    setDragW(next);
  };

  const onSidebarResizeEnd = () => {
    if (!resizingRef.current) return;
    const live = dragWRef.current;
    resizingRef.current = null;
    dragWRef.current = null;
    document.querySelector('.nmd-app-shell')?.classList.remove('sidebar-resizing');
    document.body.classList.remove('nmd-resizing-sidebar');
    setDragW(null);
    if (live == null) return;
    if (live < SIDEBAR_COLLAPSE) {
      setSidebarOpen(false);
      setSidebarW(w => (w < SIDEBAR_MIN ? SIDEBAR_DEFAULT : w));
    } else {
      setSidebarOpen(true);
      setSidebarW(clampSidebarW(live));
    }
  };

  useEffect(() => { localStorage.setItem('nmd_view', view); }, [view]);
  useEffect(() => { localStorage.setItem('nmd_nb_open', JSON.stringify([...openIds])); }, [openIds]);
  useEffect(() => {
    document.body.classList.toggle('nmd-focus', focusMode);
    return () => document.body.classList.remove('nmd-focus');
  }, [focusMode]);
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e) => { if (e.key === 'Escape') setFocusMode(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode]);

  const openPage = (nbId, pageId) => { setActiveSel({ nbId, pageId }); setMobileTree(false); };

  // Navigate to a page by id alone (used by inline `page:` links in the body).
  const openPageById = (pageId) => {
    const nb = notebooks.find(n => n.pages.some(p => p.id === pageId));
    if (nb) openPage(nb.id, pageId);
  };

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

  // Drag-and-drop reordering. Row order in the client arrays is what sync
  // flattens into the `position` column, so reordering here persists.
  // A ref holds the live payload because dragover fires before React
  // re-renders from dragStart state, and Firefox needs setData() to allow drops.
  const [dragItem, setDragItem] = useState(null); // { type:'nb', id } | { type:'page', nbId, id }
  const [dragOverId, setDragOverId] = useState(null);
  const dragItemRef = useRef(null);

  const clearDrag = () => {
    dragItemRef.current = null;
    setDragItem(null);
    setDragOverId(null);
  };

  const startDrag = (e, item) => {
    dragItemRef.current = item;
    setDragItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
  };

  const moveNotebook = (fromId, toId, placeAfter = false) => {
    if (fromId === toId) return;
    setNotebooks(nbs => {
      const from = nbs.findIndex(n => n.id === fromId);
      if (from < 0) return nbs;
      const moved = nbs[from];
      const rest = nbs.filter(n => n.id !== fromId);
      let to = rest.findIndex(n => n.id === toId);
      if (to < 0) return nbs;
      if (placeAfter) to += 1;
      return [...rest.slice(0, to), moved, ...rest.slice(to)];
    });
  };

  const movePage = (fromNbId, pageId, toNbId, beforeId = null, placeAfter = false) => {
    if (fromNbId === toNbId && pageId === beforeId) return;
    setNotebooks(nbs => {
      const fromNb = nbs.find(n => n.id === fromNbId);
      const page = fromNb?.pages.find(p => p.id === pageId);
      if (!page) return nbs;
      return nbs.map(nb => {
        let pages = nb.id === fromNbId ? nb.pages.filter(p => p.id !== pageId) : nb.pages.slice();
        if (nb.id !== toNbId) {
          return nb.id === fromNbId ? { ...nb, pages } : nb;
        }
        if (!beforeId) {
          pages = [...pages, page];
        } else {
          let idx = pages.findIndex(p => p.id === beforeId);
          if (idx < 0) idx = pages.length;
          else if (placeAfter) idx += 1;
          pages = [...pages.slice(0, idx), page, ...pages.slice(idx)];
        }
        return { ...nb, pages };
      });
    });
    if (activeSel.pageId === pageId && fromNbId !== toNbId) {
      setActiveSel({ nbId: toNbId, pageId });
    }
    if (fromNbId !== toNbId) {
      setOpenIds(s => { const ns = new Set(s); ns.add(toNbId); return ns; });
    }
  };

  const updateNb = (id, patch) => setNotebooks(nbs => nbs.map(nb => nb.id === id ? { ...nb, ...patch } : nb));
  const deleteNb = (id) => {
    if (!confirm('Delete this notebook and all its pages?')) return;
    const idx = notebooks.findIndex(nb => nb.id === id);
    const nb = notebooks[idx];
    setNotebooks(nbs => nbs.filter(n => n.id !== id));
    showToast?.(`Deleted "${nb?.name || 'notebook'}"`, {
      type: 'success',
      action: { label: 'Undo', onClick: () => setNotebooks(nbs => [...nbs.slice(0, idx), nb, ...nbs.slice(idx)]) },
    });
  };

  const updatePage = (patch) => {
    setNotebooks(nbs => nbs.map(nb => nb.id !== activeNb.id ? nb : {
      ...nb,
      pages: nb.pages.map(p => p.id === activePage.id ? { ...p, ...patch, updated: Date.now() } : p),
    }));
  };

  // Resize an image in the rendered preview by rewriting its size in the body.
  const resizeImage = (src, sizeId) => updatePage({ body: setImageRefSize(activePage.body, src, sizeId) });

  // Patch share fields on a page without bumping `updated` (these columns are
  // written directly via RPC, not through the normal sync diff).
  const setPageShareState = (nbId, pageId, patch) => setNotebooks(nbs => nbs.map(nb => nb.id !== nbId ? nb : {
    ...nb,
    pages: nb.pages.map(p => p.id === pageId ? { ...p, ...patch } : p),
  }));

  // Turn an expiry choice into an absolute ISO timestamp (or null).
  const computeExpiry = (opt) => {
    if (opt === 'keep') return activePage?.publicExpiresAt || null;
    if (opt === 'never' || !opt) return null;
    return new Date(Date.now() + Number(opt) * 86400000).toISOString();
  };

  const openShare = () => {
    setShareCopied(false);
    setShareExpiry(activePage?.publicExpiresAt ? 'keep' : 'never');
    setShareHideTags(!!activePage?.publicHideTags);
    setShareOpen(true);
  };

  // Apply share settings. `next` overrides any of { makePublic, expiry, hideTags }.
  const applyShare = async (next = {}) => {
    if (!activePage) return;
    const makePublic = next.makePublic ?? activePage.isPublic;
    const expiryOpt = next.expiry ?? shareExpiry;
    const hideTags = next.hideTags ?? shareHideTags;
    setShareBusy(true);
    try {
      const expiresAt = makePublic ? computeExpiry(expiryOpt) : null;
      // Pass the page content so sharing rewrites it plaintext (or back to
      // ciphertext) in the same call — the public link works immediately
      // instead of serving encrypted blobs until the next debounced save.
      const token = await setPagePublic(activePage.id, makePublic, activePage, { expiresAt, hideTags });
      setPageShareState(activeNb.id, activePage.id, {
        isPublic: makePublic,
        publicToken: makePublic ? token : activePage.publicToken,
        publicExpiresAt: makePublic ? expiresAt : activePage.publicExpiresAt,
        publicHideTags: hideTags,
      });
      // Collapse a concrete expiry choice to "keep" so re-edits don't re-extend it.
      if (makePublic && expiresAt) setShareExpiry('keep');
    } catch (err) {
      showToast?.('Could not update sharing: ' + err.message, { type: 'error', duration: 4000 });
    } finally {
      setShareBusy(false);
    }
  };

  const shareUrl = activePage?.publicToken
    ? `${shareBase()}?p=${activePage.publicToken}`
    : '';

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1600);
    } catch {
      // Clipboard blocked (e.g. insecure context) — leave the field for manual copy.
    }
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
    const nb = notebooks.find(n => n.id === nbId);
    const idx = nb ? nb.pages.findIndex(p => p.id === pageId) : -1;
    if (idx === -1) return;
    const page = nb.pages[idx];
    setNotebooks(nbs => nbs.map(n => n.id === nbId ? { ...n, pages: n.pages.filter(p => p.id !== pageId) } : n));
    showToast?.(`Deleted "${page.title || 'Untitled'}"`, {
      type: 'success',
      action: {
        label: 'Undo',
        onClick: () => setNotebooks(nbs => nbs.map(n => n.id === nbId
          ? { ...n, pages: [...n.pages.slice(0, idx), page, ...n.pages.slice(idx)] }
          : n)),
      },
    });
  };

  const setPaper = (paper) => updateNb(activeNb.id, { paper });

  const headings = useMemo(() => parseHeadings(activePage?.body || ''), [activePage?.body]);

  // All unique tags across notebooks, plus how many pages use each one.
  const { allTags, tagCounts } = useMemo(() => {
    const counts = {};
    notebooks.forEach(nb => nb.pages.forEach(p => (p.tags || []).forEach(t => {
      const k = t.toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
    })));
    return { allTags: Object.keys(counts).sort(), tagCounts: counts };
  }, [notebooks]);

  const toggleTagFilter = (tag) => {
    setTagFilters(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const scrollToHeading = (id) => {
    setTocOpen(false);
    // Wait for the drawer to unmount so layout settles, otherwise the
    // fixed-position drawer can intercept scroll on mobile.
    requestAnimationFrame(() => {
      const root = previewRef.current;
      if (!root) return;
      const el = root.querySelector('#' + CSS.escape(id));
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <>
      <NotebookSidebar
        mobileTree={mobileTree}
        sidebarOpen={sidebarOpen}
        dragW={dragW}
        closeSidebar={closeSidebar}
        onSidebarResizeStart={onSidebarResizeStart}
        onSidebarResizeMove={onSidebarResizeMove}
        onSidebarResizeEnd={onSidebarResizeEnd}
        query={query}
        setQuery={setQuery}
        allTags={allTags}
        tagCounts={tagCounts}
        tagFilters={tagFilters}
        setTagFilters={setTagFilters}
        tagDropdownOpen={tagDropdownOpen}
        setTagDropdownOpen={setTagDropdownOpen}
        toggleTagFilter={toggleTagFilter}
        notebooks={notebooks}
        creatingNb={creatingNb}
        setCreatingNb={setCreatingNb}
        newNbName={newNbName}
        setNewNbName={setNewNbName}
        createNotebook={createNotebook}
        openIds={openIds}
        toggleNb={toggleNb}
        renamingNbId={renamingNbId}
        setRenamingNbId={setRenamingNbId}
        updateNb={updateNb}
        dragItem={dragItem}
        dragOverId={dragOverId}
        setDragOverId={setDragOverId}
        dragItemRef={dragItemRef}
        startDrag={startDrag}
        clearDrag={clearDrag}
        moveNotebook={moveNotebook}
        movePage={movePage}
        openPage={openPage}
        newPage={newPage}
        activePage={activePage}
        longPressRef={longPressRef}
        setMenuState={setMenuState}
      />

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
              {!(sidebarOpen || dragW != null) && (
                <button
                  className="nmd-iconbtn nmd-sidebar-open"
                  onClick={openSidebar}
                  aria-label="Show notebooks pane"
                  title="Show notebooks pane"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M9 4v16" />
                    <path d="m14 9 3 3-3 3" />
                  </svg>
                </button>
              )}
              <span className="nmd-nb-strip" />
              <span className="nmd-nb-context"><b>{activeNb.name}</b></span>
              <span style={{ color: 'var(--fg4)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>/</span>
              <input
                className="nmd-title-input"
                value={activePage.title}
                placeholder="Untitled"
                onChange={e => updatePage({ title: e.target.value })}
              />
              <span
                className={'nmd-saved' + (syncError ? ' error' : '')}
                title={syncError || 'Synced to your account'}
              >
                {syncError ? 'Sync error' : saving ? 'Saving…' : 'Saved'}
              </span>
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
              <button
                className={'nmd-iconbtn nmd-share-btn' + (activePage.isPublic ? ' shared' : '')}
                onClick={openShare}
                aria-label="Share page"
                title={activePage.isPublic ? 'Shared publicly' : 'Share page'}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
                </svg>
              </button>
              <div className="nmd-view-toggle">
                <button className={view === 'rendered' ? 'active' : ''} onClick={() => setView('rendered')}>Read</button>
                <button className={view === 'source' ? 'active' : ''} onClick={() => setView('source')}>Edit</button>
              </div>
              <button
                className={'nmd-iconbtn nmd-focus-btn' + (focusMode ? ' active' : '')}
                onClick={() => setFocusMode(v => !v)}
                aria-pressed={focusMode}
                aria-label={focusMode ? 'Exit focus mode' : 'Focus mode'}
                title={focusMode ? 'Exit focus mode (Esc)' : 'Focus mode — hide everything but the page'}
              >
                {focusMode ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4v5H4M20 15h-5v5M15 4v5h5M4 15h5v5" /></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
                )}
              </button>
              <HelpIcon tip="Read mode renders your markdown. Edit mode lets you write. Use # for headings, **bold**, *italic*, - for lists." position="bottom" />
            </header>
            <div className="nmd-tags-bar">
              {(activePage.tags || []).map(tag => (
                <span
                  key={tag}
                  className={'nmd-tag clickable' + (tagFilters.includes(tag.toLowerCase()) ? ' active' : '')}
                  style={tagStyle(tag)}
                  onClick={() => toggleTagFilter(tag.toLowerCase())}
                >
                  {tag}
                  <button
                    className="nmd-tag-remove"
                    onClick={e => { e.stopPropagation(); updatePage({ tags: (activePage.tags || []).filter(t => t !== tag) }); }}
                    aria-label={`Remove tag ${tag}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
              <TagInput
                allTags={allTags}
                existing={activePage.tags}
                onAdd={tag => updatePage({ tags: [...(activePage.tags || []), tag] })}
                onRemoveLast={() => {
                  const tags = activePage.tags || [];
                  if (tags.length) updatePage({ tags: tags.slice(0, -1) });
                }}
              />
            </div>
            <div className={'nmd-editor ' + (view === 'source' ? 'nmd-mode-write' : 'nmd-mode-preview')}>
              {view === 'source' ? (
                <div className={'nmd-pane nmd-pane-write nmd-paper ' + (activeNb.paper || 'plain')}>
                  <MarkdownEditor
                    value={activePage.body}
                    onChange={body => updatePage({ body })}
                    placeholder="# Start typing..."
                    notebooks={notebooks}
                  />
                </div>
              ) : (
                <div
                  ref={previewRef}
                  className={'nmd-pane nmd-pane-preview nmd-paper ' + (activeNb.paper || 'plain')}
                >
                  {activePage.body.trim() ? (
                    <MarkdownView source={activePage.body} onNavigate={openPageById} onResizeImage={resizeImage} />
                  ) : (
                    <div style={{ color: 'var(--fg4)', fontSize: 14, lineHeight: 1.6, maxWidth: 600 }}>
                      <p style={{ fontSize: 15, color: 'var(--fg3)' }}>Empty page.</p>
                      <p>Switch to <b style={{ color: 'var(--fg2)' }}>Edit</b> to start writing in markdown.</p>
                    </div>
                  )}
                </div>
              )}
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
          <>
            {!(sidebarOpen || dragW != null) && (
              <header className="nmd-header">
                <button
                  className="nmd-iconbtn nmd-sidebar-open"
                  onClick={openSidebar}
                  aria-label="Show notebooks pane"
                  title="Show notebooks pane"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M9 4v16" />
                    <path d="m14 9 3 3-3 3" />
                  </svg>
                </button>
              </header>
            )}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--fg3)' }}>
              <div style={{ fontSize: 14 }}>No page selected.</div>
              <div style={{ fontSize: 12, color: 'var(--fg4)', fontFamily: 'var(--font-mono)' }}>Open a notebook and pick a page, or create a new one.</div>
            </div>
          </>
        )}
      </main>

      <ShareDialog
        page={activePage}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={shareUrl}
        shareBusy={shareBusy}
        shareCopied={shareCopied}
        shareExpiry={shareExpiry}
        setShareExpiry={setShareExpiry}
        shareHideTags={shareHideTags}
        setShareHideTags={setShareHideTags}
        onApplyShare={applyShare}
        onCopyLink={copyShareLink}
      />

      {/* Context menu */}
      {menuState && (
        <FixedContextMenu
          x={menuState.x}
          y={menuState.y}
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
        </FixedContextMenu>
      )}
    </>
  );
}
