import React, { useRef, useEffect } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { search, openSearchPanel, closeSearchPanel, findNext, findPrevious, highlightSelectionMatches, SearchQuery, setSearchQuery, getSearchQuery } from '@codemirror/search';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/* Custom highlight style matching NoteMD's design tokens. */
const mdHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.4em', color: 'var(--fg1)' },
  { tag: tags.heading2, fontWeight: '600', fontSize: '1.25em', color: 'var(--fg1)' },
  { tag: tags.heading3, fontWeight: '600', fontSize: '1.1em', color: 'var(--fg1)' },
  { tag: tags.heading4, fontWeight: '600', color: 'var(--fg1)' },
  { tag: tags.strong, fontWeight: '600', color: 'var(--fg1)' },
  { tag: tags.emphasis, fontStyle: 'italic', color: 'var(--fg2)' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--fg4)' },
  { tag: tags.link, color: 'var(--link)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--fg3)', fontSize: '0.9em' },
  { tag: tags.monospace, fontFamily: 'var(--font-mono)', background: 'var(--bg-hover)', color: 'var(--fg1)' },
  { tag: tags.quote, color: 'var(--fg3)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--fg2)' },
  { tag: tags.meta, color: 'var(--fg4)' },
  { tag: tags.processingInstruction, color: 'var(--fg4)' },
  // Code block content
  { tag: tags.comment, color: 'var(--fg4)', fontStyle: 'italic' },
  { tag: tags.keyword, color: 'var(--accent-purple)' },
  { tag: tags.string, color: 'var(--accent-green, #50a14f)' },
  { tag: tags.number, color: 'var(--accent-orange, #c18401)' },
  { tag: tags.operator, color: 'var(--fg2)' },
  { tag: tags.variableName, color: 'var(--fg1)' },
  { tag: tags.function(tags.variableName), color: 'var(--link)' },
  { tag: tags.typeName, color: 'var(--accent-orange, #c18401)' },
  { tag: tags.className, color: 'var(--accent-orange, #c18401)' },
  { tag: tags.propertyName, color: 'var(--fg1)' },
  { tag: tags.bool, color: 'var(--accent-purple)' },
  { tag: tags.null, color: 'var(--accent-purple)' },
]);

/* Editor theme matching NoteMD's look. */
const mdTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.7',
    padding: '40px 64px 80px',
    caretColor: 'var(--fg1)',
  },
  '.cm-line': {
    padding: '0',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--fg1)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    background: 'var(--bg-hover)',
  },
  '.cm-activeLine': {
    background: 'var(--bg-hover)',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-panels': {
    background: 'var(--bg-raised)',
  },
  '.cm-panels-bottom': {
    borderTop: '1px solid var(--border)',
  },
  '.cm-searchMatch': {
    background: 'rgba(255, 200, 0, 0.3)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    background: 'rgba(255, 200, 0, 0.6)',
  },
});

/* Minimal custom search panel */
function createSearchPanel(view) {
  const dom = document.createElement('div');
  dom.className = 'nmd-search-panel';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Find...';
  input.className = 'nmd-search-input';

  const query = getSearchQuery(view.state);
  input.value = query.search || '';

  const updateSearch = () => {
    const newQuery = new SearchQuery({ search: input.value, caseSensitive: false });
    view.dispatch({ effects: setSearchQuery.of(newQuery) });
  };

  input.addEventListener('input', updateSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      findNext(view);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchPanel(view);
      view.focus();
    }
  });

  const prevBtn = document.createElement('button');
  prevBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>';
  prevBtn.title = 'Previous (Shift+Enter)';
  prevBtn.className = 'nmd-search-btn';
  prevBtn.onclick = () => findPrevious(view);

  const nextBtn = document.createElement('button');
  nextBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>';
  nextBtn.title = 'Next (Enter)';
  nextBtn.className = 'nmd-search-btn';
  nextBtn.onclick = () => findNext(view);

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  closeBtn.title = 'Close (Esc)';
  closeBtn.className = 'nmd-search-btn nmd-search-close';
  closeBtn.onclick = () => { closeSearchPanel(view); view.focus(); };

  dom.appendChild(input);
  dom.appendChild(prevBtn);
  dom.appendChild(nextBtn);
  dom.appendChild(closeBtn);

  return { dom, top: false };
}


export default function MarkdownEditor({ value, onChange, placeholder }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const isExternalUpdate = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isExternalUpdate.current) {
        onChange(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value || '',
      extensions: [
        highlightActiveLine(),
        history(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          { key: 'Mod-f', run: openSearchPanel, scope: 'editor' },
        ]),
        search({ createPanel: createSearchPanel }),
        highlightSelectionMatches(),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(mdHighlight),
        mdTheme,
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Sync external value changes (e.g., page switch) without losing cursor.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value || '' },
      });
      isExternalUpdate.current = false;
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="nmd-cm-editor"
      style={{ height: '100%', overflow: 'hidden' }}
    />
  );
}
