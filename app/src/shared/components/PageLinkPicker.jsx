import React, { useState, useRef, useEffect, useMemo } from 'react';

export default function PageLinkPicker({ notebooks, value, onChange, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Find linked page info
  const linkedPage = useMemo(() => {
    if (!value) return null;
    for (const nb of notebooks) {
      const page = nb.pages.find(p => p.id === value);
      if (page) return { notebook: nb, page };
    }
    return null;
  }, [notebooks, value]);

  // Filter pages by query
  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    const results = [];
    notebooks.forEach(nb => {
      nb.pages.forEach(p => {
        const title = p.title || 'Untitled';
        if (!q || title.toLowerCase().includes(q) || nb.name.toLowerCase().includes(q)) {
          results.push({ notebook: nb, page: p });
        }
      });
    });
    return results.slice(0, 10);
  }, [notebooks, query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSelect = (pageId) => {
    onChange(pageId);
    setOpen(false);
    setQuery('');
  };

  const handleUnlink = (e) => {
    e.stopPropagation();
    onChange(null);
  };

  const closeDropdown = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="nmd-page-link-picker">
      {linkedPage ? (
        <div className="nmd-linked-page">
          <span
            className="nmd-linked-page-chip"
            style={{ '--nb-color': linkedPage.notebook.color }}
            onClick={() => onNavigate?.(linkedPage.notebook.id, linkedPage.page.id)}
            title={`Open ${linkedPage.page.title || 'Untitled'}`}
          >
            <span className="nmd-linked-page-dot" />
            <span className="nmd-linked-page-title">{linkedPage.page.title || 'Untitled'}</span>
          </span>
          <button
            className="nmd-linked-page-unlink"
            onClick={handleUnlink}
            title="Unlink page"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <button
            className="nmd-linked-page-change"
            onClick={() => setOpen(true)}
            title="Change linked page"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          className="nmd-link-page-btn"
          onClick={() => setOpen(true)}
          title="Link to a page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>Link page</span>
        </button>
      )}

      {open && (
        <>
          <div className="nmd-page-link-backdrop" onClick={closeDropdown} />
          <div ref={dropdownRef} className="nmd-page-link-dropdown">
            <input
              ref={inputRef}
              type="text"
              className="nmd-page-link-search"
              placeholder="Search pages..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <div className="nmd-page-link-list">
              {filteredPages.length === 0 ? (
                <div className="nmd-page-link-empty">No pages found</div>
              ) : (
                filteredPages.map(({ notebook, page }) => (
                  <button
                    key={page.id}
                    className={'nmd-page-link-item' + (value === page.id ? ' selected' : '')}
                    onClick={() => handleSelect(page.id)}
                  >
                    <span className="nmd-page-link-dot" style={{ background: notebook.color }} />
                    <span className="nmd-page-link-nb">{notebook.name}</span>
                    <span className="nmd-page-link-sep">/</span>
                    <span className="nmd-page-link-title">{page.title || 'Untitled'}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
