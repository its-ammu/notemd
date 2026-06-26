import React, { useState, useEffect } from 'react';
import FixedContextMenu from './FixedContextMenu';
import { relTime } from '../utils/time';
import { tagStyle } from '../utils/tags';

/* Rough markdown -> plain text for card snippets. */
function snippet(body, max = 140) {
  if (!body) return '';
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * NotebookBoard — storyboard view of all notebooks.
 * Each notebook is a column of page cards. Cards drag to reorder within a
 * notebook or move across notebooks; columns drag (by their header) to
 * reorder notebooks. Order persists through the normal sync diff because
 * `position` is derived from array order when pushing.
 */
function fmtDay(dateKey) {
  return new Date(dateKey + 'T00:00:00')
    .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function linkTip(links) {
  const parts = [];
  if (links.tasks) {
    parts.push(`${links.tasks} linked ${links.tasks === 1 ? 'task' : 'tasks'}` +
      (links.openTasks ? ` (${links.openTasks} open)` : ' (all done)'));
  }
  if (links.meetings) parts.push(`${links.meetings} linked ${links.meetings === 1 ? 'meeting' : 'meetings'}`);
  return parts.join(' · ');
}

export default function NotebookBoard({ notebooks, setNotebooks, onOpenPage, onNewPage, pageLinks = {}, onOpenTracker }) {
  // Live drag payload. dataTransfer can't be read during dragover, so the
  // payload lives in state for the duration of the drag.
  const [drag, setDrag] = useState(null);        // { type: 'page', pageId, nbId } | { type: 'nb', nbId }
  const [pageOver, setPageOver] = useState(null); // { nbId, index } — insertion slot for a card
  const [nbOver, setNbOver] = useState(null);     // index — insertion slot for a column
  // Picker shown when a badge has more than one linked item:
  // { x, y, kind: 'task'|'meeting', refs }
  const [linkMenu, setLinkMenu] = useState(null);

  useEffect(() => {
    if (!linkMenu) return;
    const close = () => setLinkMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [linkMenu]);

  const clearDrag = () => { setDrag(null); setPageOver(null); setNbOver(null); };

  // Badge click: jump straight to a lone linked item, otherwise let the
  // user pick from a list.
  const openLinks = (e, kind, refs) => {
    e.stopPropagation();
    if (!onOpenTracker || !refs.length) return;
    if (refs.length === 1) {
      const r = refs[0];
      onOpenTracker({ dateKey: r.dateKey, [kind === 'task' ? 'taskId' : 'meetingId']: r.id });
      return;
    }
    const sorted = [...refs].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    setLinkMenu({ x: e.clientX, y: e.clientY, kind, refs: sorted });
  };

  const movePage = (pageId, fromNbId, toNbId, toIndex) => {
    setNotebooks(nbs => {
      const fromNb = nbs.find(n => n.id === fromNbId);
      const page = fromNb?.pages.find(p => p.id === pageId);
      if (!page) return nbs;
      return nbs.map(nb => {
        if (nb.id === fromNbId && nb.id === toNbId) {
          const fromIdx = nb.pages.findIndex(p => p.id === pageId);
          const rest = nb.pages.filter(p => p.id !== pageId);
          const idx = toIndex > fromIdx ? toIndex - 1 : toIndex;
          return { ...nb, pages: [...rest.slice(0, idx), page, ...rest.slice(idx)] };
        }
        if (nb.id === fromNbId) return { ...nb, pages: nb.pages.filter(p => p.id !== pageId) };
        if (nb.id === toNbId) {
          return { ...nb, pages: [...nb.pages.slice(0, toIndex), page, ...nb.pages.slice(toIndex)] };
        }
        return nb;
      });
    });
  };

  const moveNotebook = (nbId, toIndex) => {
    setNotebooks(nbs => {
      const fromIdx = nbs.findIndex(n => n.id === nbId);
      if (fromIdx === -1) return nbs;
      const nb = nbs[fromIdx];
      const rest = nbs.filter(n => n.id !== nbId);
      const idx = toIndex > fromIdx ? toIndex - 1 : toIndex;
      return [...rest.slice(0, idx), nb, ...rest.slice(idx)];
    });
  };

  const dropPage = (nbId, index) => {
    if (drag?.type === 'page') movePage(drag.pageId, drag.nbId, nbId, index);
    clearDrag();
  };

  const dropNotebook = (index) => {
    if (drag?.type === 'nb') moveNotebook(drag.nbId, index);
    clearDrag();
  };

  // Insertion slot for a column drag, based on which half of the column
  // the pointer is over.
  const nbSlotFromEvent = (e, colIndex) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX < rect.left + rect.width / 2 ? colIndex : colIndex + 1;
  };

  return (
    <div
      className="nmd-board"
      onDragOver={e => { if (drag) e.preventDefault(); }}
      onDrop={e => {
        // Drop on empty board space: send a column to the end.
        e.preventDefault();
        if (drag?.type === 'nb') dropNotebook(notebooks.length);
        else clearDrag();
      }}
    >
      {notebooks.map((nb, colIndex) => (
        <React.Fragment key={nb.id}>
          {drag?.type === 'nb' && nbOver === colIndex && drag.nbId !== nb.id && (
            <div className="nmd-board-collane" />
          )}
          <section
            className={'nmd-board-col' + (drag?.type === 'nb' && drag.nbId === nb.id ? ' dragging' : '')}
            style={{ '--nb-color': nb.color }}
            onDragOver={e => {
              if (drag?.type !== 'nb') return;
              e.preventDefault(); e.stopPropagation();
              setNbOver(nbSlotFromEvent(e, colIndex));
            }}
            onDrop={e => {
              if (drag?.type !== 'nb') return;
              e.preventDefault(); e.stopPropagation();
              dropNotebook(nbSlotFromEvent(e, colIndex));
            }}
          >
            <header
              className="nmd-board-col-head"
              draggable
              onDragStart={e => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', nb.id);
                setDrag({ type: 'nb', nbId: nb.id });
              }}
              onDragEnd={clearDrag}
              title="Drag to reorder notebooks"
            >
              <span className="nmd-nb-dot" style={{ background: nb.color }} />
              <span className="nmd-board-col-name">{nb.name}</span>
              <span className="nmd-board-col-count">{nb.pages.length}</span>
              <svg className="nmd-board-grip" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
              </svg>
            </header>

            <div
              className="nmd-board-col-body"
              onDragOver={e => {
                if (drag?.type !== 'page') return;
                e.preventDefault();
                // Only when hovering the body's own padding (below the cards):
                if (e.target === e.currentTarget) setPageOver({ nbId: nb.id, index: nb.pages.length });
              }}
              onDrop={e => {
                if (drag?.type !== 'page') return;
                e.preventDefault(); e.stopPropagation();
                dropPage(nb.id, pageOver?.nbId === nb.id ? pageOver.index : nb.pages.length);
              }}
            >
              {nb.pages.map((p, i) => {
                const text = snippet(p.body);
                const links = pageLinks[p.id];
                const hasLinks = links && (links.tasks > 0 || links.meetings > 0);
                return (
                  <React.Fragment key={p.id}>
                    {drag?.type === 'page' && pageOver?.nbId === nb.id && pageOver.index === i && (
                      <div className="nmd-board-dropline" />
                    )}
                    <div
                      role="button"
                      tabIndex={0}
                      className={'nmd-board-card' + (drag?.type === 'page' && drag.pageId === p.id ? ' dragging' : '')}
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', p.id);
                        setDrag({ type: 'page', pageId: p.id, nbId: nb.id });
                      }}
                      onDragEnd={clearDrag}
                      onDragOver={e => {
                        if (drag?.type !== 'page') return;
                        e.preventDefault(); e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const below = e.clientY > rect.top + rect.height / 2;
                        setPageOver({ nbId: nb.id, index: below ? i + 1 : i });
                      }}
                      onClick={() => onOpenPage(nb.id, p.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenPage(nb.id, p.id); } }}
                    >
                      <span className="nmd-board-card-title">{p.title || 'Untitled'}</span>
                      {text && <span className="nmd-board-card-snippet">{text}</span>}
                      <span className="nmd-board-card-meta">
                        {hasLinks && (
                          <span className="nmd-board-card-links" title={linkTip(links)}>
                            {links.tasks > 0 && (
                              <button
                                type="button"
                                className={'nmd-board-link-chip' + (links.openTasks === 0 ? ' done' : '')}
                                title={links.tasks === 1 ? 'Open linked task in tracker' : 'Show linked tasks'}
                                onClick={e => openLinks(e, 'task', links.taskRefs)}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                                {links.tasks}
                              </button>
                            )}
                            {links.meetings > 0 && (
                              <button
                                type="button"
                                className="nmd-board-link-chip"
                                title={links.meetings === 1 ? 'Open linked meeting in tracker' : 'Show linked meetings'}
                                onClick={e => openLinks(e, 'meeting', links.meetingRefs)}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="5" width="18" height="16" rx="2" />
                                  <path d="M3 10h18M8 3v4M16 3v4" />
                                </svg>
                                {links.meetings}
                              </button>
                            )}
                          </span>
                        )}
                        {(p.tags || []).slice(0, 2).map(t => (
                          <span key={t} className="nmd-page-tag" style={tagStyle(t)}>{t}</span>
                        ))}
                        {(p.tags || []).length > 2 && (
                          <span className="nmd-page-tag-more">+{p.tags.length - 2}</span>
                        )}
                        <span className="nmd-board-card-time">{relTime(p.updated)}</span>
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
              {drag?.type === 'page' && pageOver?.nbId === nb.id && pageOver.index === nb.pages.length && (
                <div className="nmd-board-dropline" />
              )}
              {nb.pages.length === 0 && drag?.type !== 'page' && (
                <div className="nmd-board-col-empty">No pages yet</div>
              )}
              <button type="button" className="nmd-board-newpage" onClick={() => onNewPage(nb.id)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                New page
              </button>
            </div>
          </section>
        </React.Fragment>
      ))}
      {drag?.type === 'nb' && nbOver === notebooks.length && <div className="nmd-board-collane" />}

      {linkMenu && (
        <FixedContextMenu
          className="nmd-menu nmd-board-linkmenu"
          x={linkMenu.x}
          y={linkMenu.y}
          onClick={e => e.stopPropagation()}
        >
          <div className="nmd-menu-label">
            {linkMenu.kind === 'task' ? 'Linked tasks' : 'Linked meetings'}
          </div>
          {linkMenu.refs.map(r => (
            <button
              key={r.dateKey + r.id}
              onClick={() => {
                onOpenTracker({ dateKey: r.dateKey, [linkMenu.kind === 'task' ? 'taskId' : 'meetingId']: r.id });
                setLinkMenu(null);
              }}
            >
              <span className={'nmd-board-linkmenu-title' + (r.done ? ' done' : '')}>
                {r.title || (linkMenu.kind === 'task' ? 'Untitled task' : 'Untitled meeting')}
              </span>
              <span className="nmd-board-linkmenu-day">
                {fmtDay(r.dateKey)}{r.time ? ` · ${r.time}` : ''}
              </span>
            </button>
          ))}
        </FixedContextMenu>
      )}
    </div>
  );
}
