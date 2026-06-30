import React, { useState, useEffect, useMemo, useRef } from 'react';
import MarkdownView from './MarkdownView';
import MarkdownEditor from './MarkdownEditor';
import { NB_COLORS } from '../utils/constants';
import { relTime } from '../utils/time';
import { parseHeadings } from '../utils/markdown';
import { setPagePublic } from '../lib/sync';
import { setImageRefSize } from '../lib/uploadImage';
import { tagStyle } from '../utils/tags';
import EmptyState from './EmptyState';
import NotebookBoard from './NotebookBoard';
import FixedContextMenu from './FixedContextMenu';
import { HelpIcon } from './Tooltip';

// Long-press handlers for mobile equivalent of right-click.
// Returns props to spread on a touchable element. The handler is called
// with { clientX, clientY } when the touch holds still for ~500ms.
function makeLongPressProps(handler, timerRef) {
  return {
    onTouchStart: (e) => {
      const t = e.touches[0];
      if (!t) return;
      const x = t.clientX, y = t.clientY;
      timerRef.current = { id: setTimeout(() => {
        // Trigger a subtle haptic cue when available.
        if (navigator.vibrate) navigator.vibrate(12);
        handler({ clientX: x, clientY: y });
        timerRef.current = { id: null, fired: true };
      }, 500), startX: x, startY: y, fired: false };
    },
    onTouchMove: (e) => {
      const info = timerRef.current;
      if (!info || info.fired) return;
      const t = e.touches[0];
      if (!t) return;
      if (Math.hypot(t.clientX - info.startX, t.clientY - info.startY) > 8) {
        clearTimeout(info.id); timerRef.current = null;
      }
    },
    onTouchEnd: (e) => {
      const info = timerRef.current;
      if (!info) return;
      if (info.fired) { e.preventDefault(); }
      else { clearTimeout(info.id); }
      timerRef.current = null;
    },
    onTouchCancel: () => {
      if (timerRef.current) { clearTimeout(timerRef.current.id); timerRef.current = null; }
    },
  };
}

// Tag input with autocomplete: suggests existing tags as you type, Enter or
// comma commits, arrows navigate, Backspace on an empty field removes the
// last tag.
function TagInput({ allTags, existing, onAdd, onRemoveLast }) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [hi, setHi] = useState(0);

  const existingSet = new Set((existing || []).map(t => t.toLowerCase()));
  const q = value.trim().toLowerCase();
  const suggestions = allTags.filter(t => !existingSet.has(t) && (!q || t.includes(q))).slice(0, 6);
  const showCreate = !!q && !existingSet.has(q) && !allTags.includes(q);
  const optionCount = suggestions.length + (showCreate ? 1 : 0);
  const open = focused && optionCount > 0;
  // Clamp instead of resetting in an effect — the option list can shrink as
  // the user types or tags get added.
  const sel = optionCount > 0 ? Math.min(hi, optionCount - 1) : 0;

  const commit = (tag) => {
    const t = (tag || '').trim().toLowerCase();
    if (t && !existingSet.has(t)) onAdd(t);
    setValue('');
    setHi(0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); setHi((sel + 1) % optionCount); }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); setHi((sel - 1 + optionCount) % optionCount); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && sel < suggestions.length) commit(suggestions[sel]);
      else commit(value);
    }
    else if (e.key === ',') { e.preventDefault(); commit(value); }
    else if (e.key === 'Escape') { e.target.blur(); }
    else if (e.key === 'Backspace' && value === '') { onRemoveLast(); }
  };

  return (
    <div className="nmd-tag-input-wrap">
      <input
        className="nmd-tag-input"
        placeholder="+ Add tag"
        value={value}
        onChange={e => { setValue(e.target.value); setHi(0); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div className="nmd-tag-suggest" role="listbox">
          {suggestions.map((t, i) => (
            <button
              key={t}
              className={'nmd-tag-suggest-item' + (i === sel ? ' hi' : '')}
              onMouseDown={e => { e.preventDefault(); commit(t); }}
              onMouseEnter={() => setHi(i)}
            >
              <span className="nmd-tag-dot" style={tagStyle(t)} />
              {t}
            </button>
          ))}
          {showCreate && (
            <button
              className={'nmd-tag-suggest-item create' + (sel === suggestions.length ? ' hi' : '')}
              onMouseDown={e => { e.preventDefault(); commit(q); }}
              onMouseEnter={() => setHi(suggestions.length)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
              Create &ldquo;{q}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

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

export default function NotebooksPane({ notebooks, setNotebooks, activeSel, setActiveSel, saving, syncError, tasksByDate, meetingsByDate, onOpenTracker, showToast }) {
  const [openIds, setOpenIds] = useState(() => new Set(notebooks.map(n => n.id).slice(0, 3)));
  const [query, setQuery] = useState('');
  const [tagFilters, setTagFilters] = useState([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [creatingNb, setCreatingNb] = useState(false);
  const [newNbName, setNewNbName] = useState('');
  const [menuState, setMenuState] = useState(null);
  const [renamingNbId, setRenamingNbId] = useState(null);
  const [view, setView] = useState(() => localStorage.getItem('nmd_view') || 'rendered');
  const [boardOpen, setBoardOpen] = useState(() => localStorage.getItem('nmd_nb_board') === 'on');
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

  useEffect(() => { localStorage.setItem('nmd_view', view); }, [view]);
  useEffect(() => { localStorage.setItem('nmd_nb_board', boardOpen ? 'on' : 'off'); }, [boardOpen]);
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

  const openPage = (nbId, pageId) => { setActiveSel({ nbId, pageId }); setBoardOpen(false); setMobileTree(false); };

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
    ? `${window.location.origin}${window.location.pathname}?p=${activePage.publicToken}`
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

  // pageId -> { tasks, meetings, openTasks } for "linked to tracker" badges
  // on storyboard cards.
  const pageLinks = useMemo(() => {
    const map = {};
    const entry = (pid) => map[pid] || (map[pid] = { tasks: 0, openTasks: 0, meetings: 0, taskRefs: [], meetingRefs: [] });
    Object.entries(tasksByDate || {}).forEach(([dateKey, list]) => (list || []).forEach(t => {
      if (!t.linkedPageId) return;
      const e = entry(t.linkedPageId);
      e.tasks += 1;
      if (!t.done) e.openTasks += 1;
      e.taskRefs.push({ dateKey, id: t.id, done: !!t.done, title: t.title });
    }));
    Object.entries(meetingsByDate || {}).forEach(([dateKey, list]) => (list || []).forEach(m => {
      if (!m.linkedPageId) return;
      const e = entry(m.linkedPageId);
      e.meetings += 1;
      e.meetingRefs.push({ dateKey, id: m.id, title: m.title, time: m.time });
    }));
    return map;
  }, [tasksByDate, meetingsByDate]);

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
      {/* Sidebar */}
      <aside className={'nmd-sidebar ' + (mobileTree ? 'm-on' : 'm-off')}>
        <div className="nmd-sidebar-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 16,
              color: 'var(--fg1)', letterSpacing: '-0.01em'
            }}>Notebooks</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              className={'nmd-iconbtn nmd-board-toggle' + (boardOpen ? ' active' : '')}
              onClick={() => { setBoardOpen(v => !v); setMobileTree(false); }}
              aria-label="Storyboard view" title="Storyboard view"
              aria-pressed={boardOpen}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <rect x="3" y="4" width="5" height="16" rx="1.2" />
                <rect x="10" y="4" width="5" height="11" rx="1.2" />
                <rect x="17" y="4" width="4" height="8" rx="1.2" />
              </svg>
            </button>
            <button
              className="nmd-iconbtn"
              onClick={() => setCreatingNb(true)}
              aria-label="New notebook" title="New notebook"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        </div>
        <div className="nmd-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            placeholder="Find in notes"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {allTags.length > 0 && (
            <div className="nmd-tag-dropdown-wrap">
              <button
                className={'nmd-tag-dropdown-btn' + (tagFilters.length > 0 ? ' has-filter' : '')}
                onClick={() => setTagDropdownOpen(v => !v)}
                aria-label="Filter by tags"
                title="Filter by tags"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                  <circle cx="7" cy="7" r="1.5" fill="currentColor" />
                </svg>
                {tagFilters.length > 0 && <span className="nmd-tag-badge">{tagFilters.length}</span>}
              </button>
              {tagDropdownOpen && (
                <>
                  <div className="nmd-tag-dropdown-backdrop" onClick={() => setTagDropdownOpen(false)} />
                  <div className="nmd-tag-dropdown">
                    <div className="nmd-tag-dropdown-header">
                      <span>Filter by tags</span>
                      {tagFilters.length > 0 && (
                        <button onClick={() => setTagFilters([])}>Clear all</button>
                      )}
                    </div>
                    <div className="nmd-tag-dropdown-list">
                      {allTags.map(tag => (
                        <label key={tag} className="nmd-tag-dropdown-item">
                          <input
                            type="checkbox"
                            checked={tagFilters.includes(tag)}
                            onChange={() => toggleTagFilter(tag)}
                          />
                          <span className="nmd-tag-dot" style={tagStyle(tag)} />
                          <span className="nmd-tag-dropdown-name">{tag}</span>
                          <span className="nmd-tag-count">{tagCounts[tag]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {tagFilters.length > 0 && (
          <div className="nmd-tag-filter-bar">
            <span className="nmd-tag-filter-label">Tags:</span>
            {tagFilters.map(tag => (
              <span key={tag} className="nmd-tag-filter-tag" style={tagStyle(tag)} onClick={() => toggleTagFilter(tag)}>
                {tag}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </span>
            ))}
            <button onClick={() => setTagFilters([])} className="nmd-tag-filter-clear">Clear</button>
          </div>
        )}
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
            const hasTagFilter = tagFilters.length > 0;
            const hasFilter = q || hasTagFilter;

            // Filter pages by tags (must have ALL selected tags)
            const filterByTags = (pages) => {
              if (!hasTagFilter) return pages;
              return pages.filter(p => p.tags && tagFilters.every(tf => p.tags.some(t => t.toLowerCase() === tf)));
            };

            const visibleNotebooks = hasFilter
              ? notebooks.filter(nb => {
                  if (hasTagFilter) {
                    const tagPages = filterByTags(nb.pages);
                    if (tagPages.length > 0) return true;
                  }
                  if (q) {
                    return nb.name.toLowerCase().includes(q) ||
                      nb.pages.some(p => (p.title + ' ' + p.body).toLowerCase().includes(q));
                  }
                  return hasTagFilter ? false : true;
                })
              : notebooks;
            if (visibleNotebooks.length === 0) {
              if (hasFilter) {
                return <EmptyState type="search" />;
              }
              return <EmptyState type="notebooks" onAction={() => setCreatingNb(true)} />;
            }
            return visibleNotebooks.map(nb => {
            const open = hasFilter ? true : openIds.has(nb.id);
            const nbNameMatches = q && nb.name.toLowerCase().includes(q);
            let pages = nb.pages;
            if (hasTagFilter) pages = filterByTags(pages);
            if (q && !nbNameMatches) pages = pages.filter(p => (p.title + ' ' + p.body).toLowerCase().includes(q));
            return (
              <div key={nb.id}>
                <button
                  className="nmd-nb-row"
                  onClick={() => {
                    if (longPressRef.current?.fired) { longPressRef.current = null; return; }
                    toggleNb(nb.id);
                  }}
                  onContextMenu={e => {
                    e.preventDefault();
                    setMenuState({ x: e.clientX, y: e.clientY, nbId: nb.id });
                  }}
                  {...makeLongPressProps(
                    ({ clientX, clientY }) => setMenuState({ x: clientX, y: clientY, nbId: nb.id }),
                    longPressRef,
                  )}
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
                          onClick={() => {
                            if (longPressRef.current?.fired) { longPressRef.current = null; return; }
                            openPage(nb.id, p.id);
                          }}
                          onContextMenu={e => {
                            e.preventDefault(); e.stopPropagation();
                            setMenuState({ x: e.clientX, y: e.clientY, nbId: nb.id, pageId: p.id });
                          }}
                          {...makeLongPressProps(
                            ({ clientX, clientY }) => setMenuState({ x: clientX, y: clientY, nbId: nb.id, pageId: p.id }),
                            longPressRef,
                          )}
                        >
                          <div className="nmd-page-row-main">
                            <span className="nmd-page-title">{p.title || 'Untitled'}</span>
                            <span className="nmd-page-meta">{relTime(p.updated)}</span>
                          </div>
                          {p.tags && p.tags.length > 0 && (
                            <div className="nmd-page-tags">
                              {p.tags.slice(0, 3).map(t => (
                                <span
                                  key={t}
                                  className={'nmd-page-tag clickable' + (tagFilters.includes(t.toLowerCase()) ? ' active' : '')}
                                  style={tagStyle(t)}
                                  onClick={e => { e.stopPropagation(); toggleTagFilter(t.toLowerCase()); }}
                                >
                                  {t}
                                </span>
                              ))}
                              {p.tags.length > 3 && <span className="nmd-page-tag-more">+{p.tags.length - 3}</span>}
                            </div>
                          )}
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
        {boardOpen ? (
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
              <span className="nmd-nb-context"><b>Storyboard</b></span>
              <span className="nmd-board-hint">Drag cards to reorder pages · drag column headers to reorder notebooks</span>
              <span style={{ flex: 1 }} />
              <span
                className={'nmd-saved' + (syncError ? ' error' : '')}
                title={syncError || 'Synced to your account'}
              >
                {syncError ? 'Sync error' : saving ? 'Saving…' : 'Saved'}
              </span>
              <button className="nmd-btn" onClick={() => setBoardOpen(false)}>Close</button>
            </header>
            {notebooks.length > 0 ? (
              <NotebookBoard
                notebooks={notebooks}
                setNotebooks={setNotebooks}
                onOpenPage={openPage}
                onNewPage={newPage}
                pageLinks={pageLinks}
                onOpenTracker={onOpenTracker}
              />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <EmptyState type="notebooks" onAction={() => { setBoardOpen(false); setCreatingNb(true); setMobileTree(true); }} />
              </div>
            )}
          </>
        ) : activeNb && activePage ? (
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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--fg3)' }}>
            <div style={{ fontSize: 14 }}>No page selected.</div>
            <div style={{ fontSize: 12, color: 'var(--fg4)', fontFamily: 'var(--font-mono)' }}>Open a notebook and pick a page, or create a new one.</div>
          </div>
        )}
      </main>

      {/* Share dialog */}
      {shareOpen && activePage && (
        <div className="nmd-modal-backdrop" onClick={() => setShareOpen(false)}>
          <div className="nmd-modal nmd-share-modal" onClick={e => e.stopPropagation()}>
            <div className="nmd-modal-header">
              <h2>Share page</h2>
              <button className="nmd-iconbtn" onClick={() => setShareOpen(false)} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="nmd-modal-body">
              <div className="nmd-modal-row">
                <div className="nmd-modal-row-text">
                  <div className="nmd-modal-row-title">Public link</div>
                  <div className="nmd-modal-row-desc">
                    {activePage.isPublic
                      ? 'Anyone with the link can read this page (no sign-in needed).'
                      : 'Turn on to create a read-only link you can share with anyone.'}
                  </div>
                </div>
                <button
                  className={'nmd-toggle' + (activePage.isPublic ? ' on' : '')}
                  disabled={shareBusy}
                  onClick={() => applyShare({ makePublic: !activePage.isPublic })}
                  aria-pressed={activePage.isPublic}
                  aria-label="Toggle public sharing"
                >
                  <span className="nmd-toggle-knob" />
                </button>
              </div>
              {activePage.isPublic && shareUrl && (
                <div className="nmd-share-link">
                  <input readOnly value={shareUrl} onFocus={e => e.target.select()} />
                  <button className="nmd-btn primary" onClick={copyShareLink}>
                    {shareCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
              {activePage.isPublic && (
                <>
                  <div className="nmd-modal-row">
                    <div className="nmd-modal-row-text">
                      <div className="nmd-modal-row-title">Link expiry</div>
                      <div className="nmd-modal-row-desc">
                        {activePage.publicExpiresAt
                          ? `Stops working ${fmtDate(activePage.publicExpiresAt)}.`
                          : 'Link works until you turn sharing off.'}
                      </div>
                    </div>
                    <select
                      className="nmd-modal-input"
                      value={shareExpiry}
                      disabled={shareBusy}
                      onChange={e => { setShareExpiry(e.target.value); applyShare({ expiry: e.target.value }); }}
                    >
                      {activePage.publicExpiresAt && <option value="keep">Keep current</option>}
                      <option value="never">No expiry</option>
                      <option value="1">1 day</option>
                      <option value="7">7 days</option>
                      <option value="30">30 days</option>
                    </select>
                  </div>
                  <div className="nmd-modal-row">
                    <div className="nmd-modal-row-text">
                      <div className="nmd-modal-row-title">Hide tags</div>
                      <div className="nmd-modal-row-desc">Keep this page's tags private from public readers.</div>
                    </div>
                    <button
                      className={'nmd-toggle' + (shareHideTags ? ' on' : '')}
                      disabled={shareBusy}
                      onClick={() => { const v = !shareHideTags; setShareHideTags(v); applyShare({ hideTags: v }); }}
                      aria-pressed={shareHideTags}
                      aria-label="Toggle hide tags"
                    >
                      <span className="nmd-toggle-knob" />
                    </button>
                  </div>
                  <p className="nmd-share-note">
                    Edits you make sync to the public page automatically. Turn sharing off to revoke access — the same link works again if you re-share.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
