import React, { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownView from './MarkdownView';
import { getPublicPage } from '../lib/sync';
import { supabase } from '../lib/supabase';
import { relTime } from '../utils/time';
import { parseHeadings } from '../utils/markdown';

// Derive a 1–2 letter acronym from a name or email local-part.
function initials(s) {
  const parts = (s || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * PublicPage — standalone, auth-free read-only view of a single shared page.
 * Rendered (via main.jsx) when the URL carries a ?p=<token> share token,
 * before the app shell / auth ever mount.
 */
export default function PublicPage({ token }) {
  const [state, setState] = useState({ status: 'loading', page: null });
  const [theme, setTheme] = useState(() => localStorage.getItem('nmd_theme') || 'light');
  const [account, setAccount] = useState(null); // { name, initials } when a session exists
  const [tocOpen, setTocOpen] = useState(false);
  const bodyRef = useRef(null);

  // The Supabase client persists any existing session locally, so we can tell
  // whether this visitor is already a signed-in NoteMD user without an auth flow.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data?.session?.user;
      if (!user || cancelled) return;
      let name = user.email ? user.email.split('@')[0] : '';
      const { data: prof } = await supabase
        .from('profiles').select('display_name').eq('user_id', user.id).maybeSingle();
      if (prof?.display_name) name = prof.display_name;
      const label = name || user.email || '';
      if (!cancelled) setAccount({ name: label, initials: initials(label) });
    }).catch(() => { /* not signed in — leave account null */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nmd_theme', theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    getPublicPage(token)
      .then(page => {
        if (cancelled) return;
        setState({ status: page ? 'ok' : 'missing', page });
        if (page?.title) document.title = page.title + ' · NoteMD';
      })
      .catch(err => {
        console.error('[NoteMD] Failed to load shared page', err);
        if (!cancelled) setState({ status: 'error', page: null });
      });
    return () => { cancelled = true; };
  }, [token]);

  const { status, page } = state;
  const headings = useMemo(() => parseHeadings(page?.body || ''), [page?.body]);

  const scrollToHeading = (id) => {
    setTocOpen(false);
    requestAnimationFrame(() => {
      const root = bodyRef.current;
      if (!root) return;
      const el = root.querySelector('#' + CSS.escape(id));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const topbar = (
    <header className="nmd-public-bar">
      <a className="nmd-public-brand" href="/" aria-label="NoteMD home">
        <span className="nmd-public-logo">m</span>
        <span>NoteMD</span>
      </a>
      <div className="nmd-public-bar-actions">
        <button
          className="nmd-public-iconbtn"
          onClick={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
          )}
        </button>
        {account ? (
          <a className="nmd-public-avatar" href="/" title={account.name} aria-label={`Signed in as ${account.name}`}>
            {account.initials}
          </a>
        ) : (
          <a className="nmd-public-signin" href="/">Log in</a>
        )}
      </div>
    </header>
  );

  if (status === 'loading') {
    return <div className="nmd-public-shell">{topbar}<div className="nmd-public-msg">Loading…</div></div>;
  }

  if (status !== 'ok') {
    return (
      <div className="nmd-public-shell">
        {topbar}
        <div className="nmd-public-msg">
          <h1>Page unavailable</h1>
          <p>This link is invalid, has expired, or sharing has been turned off.</p>
          <a className="nmd-btn" href="/">Go to NoteMD</a>
        </div>
      </div>
    );
  }

  return (
    <div className="nmd-public-shell">
      {topbar}
      <article className="nmd-public-page">
        <header className="nmd-public-head">
          {page.notebookName && (
            <span className="nmd-public-nb">
              <span className="nmd-nb-dot" style={{ background: page.notebookColor || '#5167F4' }} />
              {page.notebookName}
            </span>
          )}
          <h1 className="nmd-public-title">{page.title || 'Untitled'}</h1>
          <div className="nmd-public-meta">
            {page.updated && <span>Updated {relTime(page.updated)}</span>}
            {page.tags.length > 0 && (
              <span className="nmd-public-tags">
                {page.tags.map(t => <span key={t} className="nmd-page-tag">{t}</span>)}
              </span>
            )}
          </div>
        </header>
        <div className="nmd-paper plain" ref={bodyRef}>
          {page.body.trim()
            ? <MarkdownView source={page.body} />
            : <p style={{ color: 'var(--fg4)' }}>This page is empty.</p>}
        </div>
        <footer className="nmd-public-foot">
          Shared with <a href="/">NoteMD</a>
        </footer>
      </article>

      {headings.length > 0 && (
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
    </div>
  );
}
