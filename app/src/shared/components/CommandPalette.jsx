import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, fmtDate } from '../utils/time';

const META = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

function matches(item, q) {
  return (item.label + ' ' + (item.hint || '')).toLowerCase().includes(q);
}

function buildItems(notebooks, calendars, query) {
  const q = query.trim().toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = fmtDate(today);
  const items = [];
  const keep = (item) => { if (!q || matches(item, q)) items.push(item); };

  keep({ id: 'new-task', group: 'Do', label: 'New task', hint: 'Today', run: { type: 'tracker', focus: { dateKey: todayKey, create: 'task' } } });
  keep({ id: 'new-meeting', group: 'Do', label: 'New meeting', hint: 'Today', run: { type: 'tracker', focus: { dateKey: todayKey, create: 'meeting' } } });
  keep({ id: 'new-page', group: 'Do', label: 'New page', hint: 'Notebooks', run: { type: 'new-page' } });
  keep({ id: 'go-home', group: 'Go', label: 'Home', run: { type: 'tab', tab: 'home' } });
  keep({ id: 'go-notebooks', group: 'Go', label: 'Notebooks', run: { type: 'tab', tab: 'notebooks' } });
  keep({ id: 'go-tracker', group: 'Go', label: 'Weekly tracker', run: { type: 'tab', tab: 'tracker' } });
  keep({ id: 'go-radio', group: 'Go', label: 'Lofi radio', run: { type: 'tab', tab: 'radio' } });

  for (let i = 0; i < 7; i++) {
    if (!q && i > 1) continue;
    const d = addDays(today, i);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long' });
    keep({
      id: 'day-' + i,
      group: 'Days',
      label,
      hint: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      run: { type: 'tracker', focus: { dateKey: fmtDate(d), view: 'day' } },
    });
  }

  if (calendars?.multiple) {
    keep({ id: 'cal-all', group: 'Calendars', label: 'All calendars', run: { type: 'calendar', id: 'all' } });
    for (const c of calendars.list) {
      keep({ id: 'cal-' + (c.id || 'default'), group: 'Calendars', label: c.name, hint: 'Calendar', run: { type: 'calendar', id: c.id } });
    }
  }

  const pages = [];
  for (const nb of notebooks || []) {
    for (const p of nb.pages || []) {
      pages.push({
        id: 'page-' + p.id,
        group: 'Pages',
        label: p.title || 'Untitled',
        hint: nb.name,
        updated: p.updated || 0,
        run: { type: 'page', nbId: nb.id, pageId: p.id },
      });
    }
  }
  pages.sort((a, b) => b.updated - a.updated);
  const shown = (q ? pages.filter(p => matches(p, q)) : pages).slice(0, q ? 12 : 5);
  items.push(...shown);
  return items;
}

/* ⌘K from anywhere: jump to a page, a day or a calendar, or start something new. */
export default function CommandPalette({ notebooks, calendars, onOpenPage, onGoToTab, onOpenTracker, onNewPage, onShowCalendar }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
        setCursor(0);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const items = useMemo(
    () => (open ? buildItems(notebooks, calendars, query) : []),
    [open, notebooks, calendars, query]
  );

  useEffect(() => {
    setCursor(c => Math.min(c, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const close = () => setOpen(false);

  const run = (item) => {
    const { run: action } = item;
    close();
    if (action.type === 'tab') onGoToTab(action.tab);
    else if (action.type === 'tracker') onOpenTracker(action.focus);
    else if (action.type === 'page') onOpenPage(action.nbId, action.pageId);
    else if (action.type === 'new-page') onNewPage();
    else if (action.type === 'calendar') onShowCalendar(action.id);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(items.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
    else if (e.key === 'Enter' && items[cursor]) { e.preventDefault(); run(items[cursor]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };

  return (
    <div className="nmd-palette-backdrop" onMouseDown={close}>
      <div
        className="nmd-palette"
        role="dialog"
        aria-label="Command palette"
        onMouseDown={e => e.stopPropagation()}
      >
        <input
          autoFocus
          className="nmd-palette-input"
          placeholder="Jump to a page, a day, a calendar…"
          value={query}
          aria-label="Search"
          aria-controls="nmd-palette-list"
          onChange={e => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={onKeyDown}
        />
        <div className="nmd-palette-list" id="nmd-palette-list" role="listbox" ref={listRef}>
          {items.length === 0 && <div className="nmd-palette-empty">Nothing matches.</div>}
          {items.map((item, i) => (
            <React.Fragment key={item.id}>
              {(i === 0 || items[i - 1].group !== item.group) && (
                <div className="nmd-menu-label">{item.group}</div>
              )}
              <button
                type="button"
                role="option"
                aria-selected={i === cursor}
                className={'nmd-palette-item' + (i === cursor ? ' sel' : '')}
                onMouseEnter={() => setCursor(i)}
                onClick={() => run(item)}
              >
                <span className="nmd-palette-label">{item.label}</span>
                {item.hint && <span className="nmd-palette-hint">{item.hint}</span>}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="nmd-palette-foot">
          <span className="kbd">↑↓</span> move
          <span className="kbd">↵</span> open
          <span className="kbd">esc</span> close
          <span className="kbd">{META}K</span>
        </div>
      </div>
    </div>
  );
}
