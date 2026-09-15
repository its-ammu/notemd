import React from 'react';
import EmptyState from '../../shared/components/EmptyState';
import { tagStyle } from '../../shared/utils/tags';
import { relTime } from '../../shared/utils/time';
import { makeLongPressProps, makeSnippet } from './helpers';

export default function NotebookSidebar({
  mobileTree,
  sidebarOpen,
  dragW,
  closeSidebar,
  onSidebarResizeStart,
  onSidebarResizeMove,
  onSidebarResizeEnd,
  query,
  setQuery,
  allTags,
  tagCounts,
  tagFilters,
  setTagFilters,
  tagDropdownOpen,
  setTagDropdownOpen,
  toggleTagFilter,
  notebooks,
  creatingNb,
  setCreatingNb,
  newNbName,
  setNewNbName,
  createNotebook,
  openIds,
  toggleNb,
  renamingNbId,
  setRenamingNbId,
  updateNb,
  dragItem,
  dragOverId,
  setDragOverId,
  dragItemRef,
  startDrag,
  clearDrag,
  moveNotebook,
  movePage,
  openPage,
  newPage,
  activePage,
  longPressRef,
  setMenuState,
}) {
  return (
      <aside className={'nmd-sidebar ' + (mobileTree ? 'm-on' : 'm-off') + ((sidebarOpen || dragW != null) ? '' : ' is-collapsed')}>
        <div className="nmd-sidebar-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 16,
              color: 'var(--fg1)', letterSpacing: '-0.01em'
            }}>Notebooks</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              className="nmd-iconbtn"
              onClick={() => setCreatingNb(true)}
              aria-label="New notebook" title="New notebook"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <button
              className="nmd-iconbtn nmd-sidebar-close"
              onClick={closeSidebar}
              aria-label="Close notebooks pane"
              title="Close notebooks pane"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 4v16" />
                <path d="m15 9-3 3 3 3" />
              </svg>
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
                <svg width="14" height="14" viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" overflow="visible">
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
                  className={'nmd-nb-row'
                    + (dragItem?.type === 'nb' && dragOverId === nb.id && dragItem.id !== nb.id ? ' nmd-drag-over' : '')
                    + (dragItem?.type === 'page' && dragOverId === nb.id ? ' nmd-drag-over' : '')
                    + (dragItem?.type === 'nb' && dragItem.id === nb.id ? ' nmd-dragging' : '')}
                  draggable={!hasFilter && renamingNbId !== nb.id}
                  onDragStart={e => startDrag(e, { type: 'nb', id: nb.id })}
                  onDragOver={e => {
                    const d = dragItemRef.current;
                    if (!d) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverId(nb.id);
                  }}
                  onDragLeave={e => {
                    if (e.currentTarget.contains(e.relatedTarget)) return;
                    setDragOverId(id => (id === nb.id ? null : id));
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    const d = dragItemRef.current;
                    if (d?.type === 'nb') {
                      const rect = e.currentTarget.getBoundingClientRect();
                      moveNotebook(d.id, nb.id, e.clientY > rect.top + rect.height / 2);
                    } else if (d?.type === 'page') {
                      movePage(d.nbId, d.id, nb.id);
                    }
                    clearDrag();
                  }}
                  onDragEnd={clearDrag}
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
                  <div
                    className="nmd-nb-pages"
                    onDragOver={e => {
                      const d = dragItemRef.current;
                      if (d?.type !== 'page') return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={e => {
                      const d = dragItemRef.current;
                      if (d?.type !== 'page') return;
                      if (e.target.closest('.nmd-page-row, .nmd-nb-newpage')) return;
                      e.preventDefault();
                      movePage(d.nbId, d.id, nb.id);
                      clearDrag();
                    }}
                  >
                    {pages.map(p => {
                      const snippet = q && !(p.title || '').toLowerCase().includes(q)
                        ? makeSnippet(p.body, q)
                        : null;
                      return (
                        <button
                          key={p.id}
                          className={'nmd-page-row' + (p.id === activePage?.id ? ' sel' : '') + (snippet ? ' with-snippet' : '')
                            + (dragItem?.type === 'page' && dragOverId === p.id && dragItem.id !== p.id ? ' nmd-drag-over' : '')
                            + (dragItem?.type === 'page' && dragItem.id === p.id ? ' nmd-dragging' : '')}
                          draggable={!hasFilter}
                          onDragStart={e => { e.stopPropagation(); startDrag(e, { type: 'page', nbId: nb.id, id: p.id }); }}
                          onDragOver={e => {
                            const d = dragItemRef.current;
                            if (d?.type !== 'page') return;
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = 'move';
                            setDragOverId(p.id);
                          }}
                          onDragLeave={e => {
                            if (e.currentTarget.contains(e.relatedTarget)) return;
                            setDragOverId(id => (id === p.id ? null : id));
                          }}
                          onDrop={e => {
                            const d = dragItemRef.current;
                            if (d?.type !== 'page') return;
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            movePage(d.nbId, d.id, nb.id, p.id, e.clientY > rect.top + rect.height / 2);
                            clearDrag();
                          }}
                          onDragEnd={clearDrag}
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
                    <button
                      className={'nmd-nb-newpage' + (dragItem?.type === 'page' && dragOverId === `end:${nb.id}` ? ' nmd-drag-over' : '')}
                      onClick={() => newPage(nb.id)}
                      onDragOver={e => {
                        const d = dragItemRef.current;
                        if (d?.type !== 'page') return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverId(`end:${nb.id}`);
                      }}
                      onDrop={e => {
                        const d = dragItemRef.current;
                        if (d?.type !== 'page') return;
                        e.preventDefault();
                        e.stopPropagation();
                        movePage(d.nbId, d.id, nb.id);
                        clearDrag();
                      }}
                    >
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
        <div
          className="nmd-sidebar-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize notebooks pane"
          onPointerDown={onSidebarResizeStart}
          onPointerMove={onSidebarResizeMove}
          onPointerUp={onSidebarResizeEnd}
          onPointerCancel={onSidebarResizeEnd}
          onLostPointerCapture={onSidebarResizeEnd}
        />
      </aside>

  );
}
