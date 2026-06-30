import React, { useRef, useEffect, useState } from 'react';
import { EditorState, RangeSetBuilder } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine, Decoration, ViewPlugin, WidgetType } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentMore, indentLess } from '@codemirror/commands';
import { search, openSearchPanel, closeSearchPanel, findNext, findPrevious, highlightSelectionMatches, SearchQuery, setSearchQuery, getSearchQuery } from '@codemirror/search';
import { markdown, markdownLanguage, insertNewlineContinueMarkup, deleteMarkupBackward, pasteURLAsLink } from '@codemirror/lang-markdown';
import { autocompletion, startCompletion, completionKeymap } from '@codemirror/autocomplete';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, HighlightStyle, indentUnit, foldGutter, foldService, codeFolding, foldKeymap } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { uploadImage, resolveImageSrc } from '../lib/uploadImage';

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


/* Languages offered by the code-block toolbar button. Labels are shown in the
   menu; `id` is the fence info-string used for syntax highlighting. */
const CODE_LANGUAGES = [
  { id: '', label: 'Plain text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'jsx', label: 'JSX' },
  { id: 'python', label: 'Python' },
  { id: 'json', label: 'JSON' },
  { id: 'bash', label: 'Bash' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'sql', label: 'SQL' },
  { id: 'rust', label: 'Rust' },
  { id: 'go', label: 'Go' },
  { id: 'java', label: 'Java' },
  { id: 'markdown', label: 'Markdown' },
];

/* Shared toolbar icon wrapper — matches the app's stroke-icon style. */
const TbIcon = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

/* Insert text at the current selection, replacing it. */
function insertAtCursor(view, text) {
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
}

/* Replace the first occurrence of `token` in the doc with `text`. */
function replaceToken(view, token, text) {
  const doc = view.state.doc.toString();
  const at = doc.indexOf(token);
  if (at === -1) return; // user deleted the placeholder — nothing to do
  view.dispatch({ changes: { from: at, to: at + token.length, insert: text } });
}

/* Upload an image file and swap a placeholder for the final markdown. */
let uploadSeq = 0;
async function handleImageFile(view, file) {
  const token = `![uploading ${file.name || 'image'}…](uploading-${++uploadSeq})`;
  insertAtCursor(view, token);
  try {
    const url = await uploadImage(file);
    const alt = (file.name || 'image').replace(/\.[^.]+$/, '');
    replaceToken(view, token, `![${alt}](${url})`);
  } catch (err) {
    replaceToken(view, token, '');
    window.alert(err?.message || 'Image upload failed.');
  }
}

function imageFilesFrom(items) {
  const files = [];
  for (const item of items) {
    const file = item.getAsFile ? item.getAsFile() : item;
    if (file && file.type && file.type.startsWith('image/')) files.push(file);
  }
  return files;
}

/* Wrap the selection in `before`/`after` markers (bold, italic, code).
   With an empty selection, drops the markers and places the cursor between. */
function wrapSelection(before, after = before) {
  return (view) => {
    const { state } = view;
    const range = state.selection.main;
    const selected = state.sliceDoc(range.from, range.to);
    const insert = before + selected + after;
    const anchor = range.empty ? range.from + before.length : range.from + insert.length;
    view.dispatch({ changes: { from: range.from, to: range.to, insert }, selection: { anchor } });
    view.focus();
    return true;
  };
}

/* Insert a markdown link, selecting the placeholder URL for quick typing. */
function insertLink(view) {
  const { state } = view;
  const range = state.selection.main;
  const text = state.sliceDoc(range.from, range.to) || 'text';
  const insert = `[${text}](url)`;
  const urlStart = range.from + text.length + 3; // past "[text]("
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: urlStart, head: urlStart + 3 }, // selects "url"
  });
  view.focus();
  return true;
}

/* ATX heading level of a line (1-6), or 0 if it isn't a heading. */
const headingLevel = (text) => {
  const m = /^(#{1,6})\s/.exec(text);
  return m ? m[1].length : 0;
};

/* Fold a heading's section: from the end of the heading line down to just
   before the next heading of the same or higher level (or end of doc). */
const headingFold = foldService.of((state, lineStart) => {
  const line = state.doc.lineAt(lineStart);
  const level = headingLevel(line.text);
  if (!level) return null;
  let endLineNo = state.doc.lines;
  for (let n = line.number + 1; n <= state.doc.lines; n++) {
    const lv = headingLevel(state.doc.line(n).text);
    if (lv && lv <= level) { endLineNo = n - 1; break; }
  }
  if (endLineNo <= line.number) return null;
  const to = state.doc.line(endLineNo).to;
  return to > line.to ? { from: line.to, to } : null;
});

/* Set (or toggle off) the heading level on every line the selection touches,
   replacing any existing heading marker. */
function setHeadingLevel(level) {
  return (view) => {
    const { state } = view;
    const range = state.selection.main;
    const first = state.doc.lineAt(range.from);
    const last = state.doc.lineAt(range.to);
    const target = `${'#'.repeat(level)} `;
    const changes = [];
    for (let n = first.number; n <= last.number; n++) {
      const l = state.doc.line(n);
      const m = /^(#{1,6})\s+/.exec(l.text);
      if (m && m[1].length === level) {
        changes.push({ from: l.from, to: l.from + m[0].length, insert: '' }); // toggle off
      } else if (m) {
        changes.push({ from: l.from, to: l.from + m[0].length, insert: target }); // change level
      } else {
        changes.push({ from: l.from, insert: target });
      }
    }
    view.dispatch({ changes });
    view.focus();
    return true;
  };
}

/* Insert a horizontal-rule divider on its own line. */
function insertDivider(view) {
  const { state } = view;
  const range = state.selection.main;
  const line = state.doc.lineAt(range.from);
  const lead = line.text.slice(0, range.from - line.from).trim() ? '\n\n' : (range.from === 0 ? '' : '\n');
  const insert = `${lead}---\n`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: range.from + insert.length },
  });
  view.focus();
  return true;
}

/* Insert a fenced code block for the given language, wrapping any selection. */
function insertCodeBlock(view, lang) {
  const { state } = view;
  const range = state.selection.main;
  const body = state.sliceDoc(range.from, range.to);
  const insert = `\`\`\`${lang}\n${body}\n\`\`\`\n`;
  const anchor = range.from + 3 + lang.length + 1; // cursor at start of body line
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: body ? range.from + insert.length : anchor },
  });
  view.focus();
  return true;
}

/* Toggle a line prefix (heading, quote, bullet) on every line the selection
   touches. If all touched lines already have it, remove it. */
function toggleLinePrefix(prefix) {
  return (view) => {
    const { state } = view;
    const range = state.selection.main;
    const first = state.doc.lineAt(range.from);
    const last = state.doc.lineAt(range.to);
    const lines = [];
    for (let n = first.number; n <= last.number; n++) lines.push(state.doc.line(n));
    const allHave = lines.every((l) => l.text.startsWith(prefix));
    const changes = lines.map((l) =>
      allHave
        ? { from: l.from, to: l.from + prefix.length, insert: '' }
        : { from: l.from, insert: prefix }
    );
    view.dispatch({ changes });
    view.focus();
    return true;
  };
}

/* Insert "@" and open the page-mention completer immediately. */
function insertPageMention(view) {
  insertAtCursor(view, '@');
  startCompletion(view);
  view.focus();
  return true;
}

/* Autocomplete source for "@page" mentions. Reads the latest notebooks from a
   ref and inserts a standard markdown link with a `page:` scheme that
   MarkdownView turns into an in-app navigation. */
function makePageCompletions(notebooksRef) {
  return (context) => {
    const match = context.matchBefore(/@[^\s@]*/);
    if (!match || match.from === match.to) return null;
    const q = match.text.slice(1).toLowerCase();
    const options = [];
    for (const nb of notebooksRef.current || []) {
      for (const p of nb.pages || []) {
        const title = p.title || 'Untitled';
        if (!q || title.toLowerCase().includes(q) || nb.name.toLowerCase().includes(q)) {
          options.push({ label: title, detail: nb.name, type: 'text', apply: `[${title}](page:${p.id})` });
        }
      }
    }
    return { from: match.from, to: match.to, options: options.slice(0, 12), filter: false };
  };
}

const ORDERED_LINE = /^(\s*)(\d+)([.)])(\s)/;
const ANY_LIST_LINE = /^(\s*)([-*+]|\d+[.)])(\s)/;

/* Renumber ordered list items by indentation depth: each level counts up
   independently, so an indented sub-list restarts at 1 and the parent level
   resumes its own sequence when you outdent. Returns the (possibly) rewritten
   text; identical input is returned unchanged so callers can no-op. */
function renumberOrderedLists(text) {
  const lines = text.split('\n');
  const stack = []; // [{ indent, n }] — one counter per active indent level
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue; // blank lines don't break a list

    const om = ORDERED_LINE.exec(line);
    if (!om) {
      const any = ANY_LIST_LINE.exec(line);
      if (!any) {
        // Top-level non-list text starts a new block; indented text is treated
        // as an item continuation and leaves the counters intact.
        if (!/^\s/.test(line)) stack.length = 0;
      } else {
        // Unordered item: drop deeper levels and free this indent so a later
        // ordered item at the same depth restarts from 1.
        const indent = any[1].length;
        while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();
        if (stack.length && stack[stack.length - 1].indent === indent) stack.pop();
      }
      continue;
    }

    const indent = om[1].length;
    while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();
    let top = stack[stack.length - 1];
    if (top && top.indent === indent) {
      top.n += 1;
    } else {
      top = { indent, n: 1 };
      stack.push(top);
    }
    lines[i] = `${om[1]}${top.n}${om[3]}${om[4]}${line.slice(om[0].length)}`;
  }
  return lines.join('\n');
}

/* Renumber the whole doc, keeping the cursor on the same line/column. */
function renumberKeepingCursor(view) {
  const { doc, selection } = view.state;
  const head = selection.main.head;
  const curLine = doc.lineAt(head);
  const lineNo = curLine.number;
  const col = head - curLine.from;

  const next = renumberOrderedLists(doc.toString());
  if (next === doc.toString()) return;

  view.dispatch({ changes: { from: 0, to: doc.length, insert: next } });
  const ndoc = view.state.doc;
  const nLine = ndoc.line(Math.min(lineNo, ndoc.lines));
  view.dispatch({ selection: { anchor: Math.min(nLine.from + col, nLine.to) } });
}

/* Command wrappers: run CodeMirror's markdown-aware action, then renumber
   ordered lists so indented sub-lists restart at 1 (which the built-ins don't do). */
const listEnter = (view) => { const ok = insertNewlineContinueMarkup(view); if (ok) renumberKeepingCursor(view); return ok; };
const listBackspace = (view) => { const ok = deleteMarkupBackward(view); if (ok) renumberKeepingCursor(view); return ok; };
const listIndent = (view) => { const ok = indentMore(view); if (ok) renumberKeepingCursor(view); return ok; };
const listOutdent = (view) => { const ok = indentLess(view); if (ok) renumberKeepingCursor(view); return ok; };

/* ── Inline reference chips ──────────────────────────────────────────────
   Image markdown (`![alt](url)`) and page links (`[Title](page:id)`) are
   replaced in the editor with compact styled chips so the long Supabase URL /
   page id never clutters the source. The raw markdown is revealed again the
   moment the cursor (or selection) touches the range, so editing still works. */

class PageRefChip extends WidgetType {
  constructor(title) { super(); this.title = title; }
  eq(other) { return other.title === this.title; }
  toDOM() {
    const el = document.createElement('span');
    el.className = 'nmd-cm-chip nmd-cm-chip-page';
    el.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>';
    el.appendChild(document.createTextNode(this.title || 'Untitled'));
    return el;
  }
  ignoreEvent() { return false; }
}

class ImageRefChip extends WidgetType {
  constructor(alt, url) { super(); this.alt = alt; this.url = url; }
  eq(other) { return other.alt === this.alt && other.url === this.url; }
  toDOM() {
    const el = document.createElement('span');
    el.className = 'nmd-cm-chip nmd-cm-chip-img';
    if (this.url && !this.url.startsWith('uploading-')) {
      const thumb = document.createElement('img');
      thumb.className = 'nmd-cm-chip-thumb';
      thumb.src = resolveImageSrc(this.url);
      thumb.alt = '';
      el.appendChild(thumb);
    } else {
      el.insertAdjacentHTML('beforeend',
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>');
    }
    el.appendChild(document.createTextNode(this.alt || 'image'));
    return el;
  }
  ignoreEvent() { return false; }
}

// `![alt](url)` images and `[title](page:id)` references, on a single line.
const REF_RE = /(!?)\[([^\]]*)\]\(([^)\s]+)\)/g;

/* Does a selection *strictly* overlap [from, to]? A collapsed cursor sitting at
   either edge does NOT count — otherwise clicking the line an image lives on
   would re-expose the URL. Only a real selection dragged across the chip (an
   intentional "I want to edit this") reveals the raw markdown. Deleting a chip
   still works via atomicRanges (backspace removes the whole range). */
function selectionTouches(state, from, to) {
  for (const r of state.selection.ranges) {
    if (r.from < to && r.to > from) return true;
  }
  return false;
}

function buildRefDecorations(view) {
  const builder = new RangeSetBuilder();
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      REF_RE.lastIndex = 0;
      let m;
      while ((m = REF_RE.exec(line.text))) {
        const isImage = m[1] === '!';
        const url = m[3];
        const isPage = url.startsWith('page:');
        if (!isImage && !isPage) continue; // leave ordinary links as plain markdown
        const start = line.from + m.index;
        const end = start + m[0].length;
        if (selectionTouches(view.state, start, end)) continue; // editing — show raw
        const widget = isImage
          ? new ImageRefChip(m[2], url)
          : new PageRefChip(m[2]);
        builder.add(start, end, Decoration.replace({ widget }));
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const refChips = ViewPlugin.fromClass(
  class {
    constructor(view) { this.decorations = buildRefDecorations(view); }
    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildRefDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations || Decoration.none),
  }
);

export default function MarkdownEditor({ value, onChange, placeholder, notebooks = [] }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const fileInputRef = useRef(null);
  const isExternalUpdate = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const notebooksRef = useRef(notebooks);
  notebooksRef.current = notebooks;

  const [toolbarOpen, setToolbarOpen] = useState(() => localStorage.getItem('nmd_md_toolbar') !== 'off');
  const [codeMenuOpen, setCodeMenuOpen] = useState(false);
  useEffect(() => { localStorage.setItem('nmd_md_toolbar', toolbarOpen ? 'on' : 'off'); }, [toolbarOpen]);

  // Run an editor command from a toolbar button, then refocus the editor.
  const run = (cmd) => { const v = viewRef.current; if (v) { cmd(v); v.focus(); } };

  // Toolbar image button → open the file picker, then upload each chosen image.
  const onPickImage = () => fileInputRef.current?.click();
  const onImageInputChange = (e) => {
    const v = viewRef.current;
    const files = imageFilesFrom(e.target.files || []);
    if (v) files.forEach((file) => handleImageFile(v, file));
    e.target.value = ''; // reset so the same file can be picked again
    v?.focus();
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isExternalUpdate.current) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value || '',
      extensions: [
        highlightActiveLine(),
        history(),
        keymap.of([
          { key: 'Enter', run: listEnter },
          { key: 'Backspace', run: listBackspace },
          { key: 'Tab', run: listIndent, shift: listOutdent },
          { key: 'Mod-b', run: wrapSelection('**'), preventDefault: true },
          { key: 'Mod-i', run: wrapSelection('*'), preventDefault: true },
          { key: 'Mod-e', run: wrapSelection('`'), preventDefault: true },
          { key: 'Mod-k', run: insertLink, preventDefault: true },
          ...completionKeymap,
          ...foldKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          { key: 'Mod-f', run: openSearchPanel, scope: 'editor' },
        ]),
        search({ createPanel: createSearchPanel }),
        highlightSelectionMatches(),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        autocompletion({ override: [makePageCompletions(notebooksRef)], icons: false }),
        pasteURLAsLink, // smart paste: a URL pasted over selected text becomes a link
        codeFolding(),
        foldGutter(),
        headingFold, // fold a heading and everything under it
        indentUnit.of('    '), // 4 spaces — enough for nested lists to render as nested
        syntaxHighlighting(mdHighlight),
        refChips, // render image/page-link markdown as compact styled chips
        mdTheme,
        updateListener,
        EditorView.lineWrapping,
        EditorView.domEventHandlers({
          paste(event, view) {
            const files = imageFilesFrom(event.clipboardData?.items || []);
            if (!files.length) return false; // let CodeMirror handle text paste
            event.preventDefault();
            files.forEach((file) => handleImageFile(view, file));
            return true;
          },
          drop(event, view) {
            const files = imageFilesFrom(event.dataTransfer?.files || []);
            if (!files.length) return false;
            event.preventDefault();
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos != null) view.dispatch({ selection: { anchor: pos } });
            files.forEach((file) => handleImageFile(view, file));
            return true;
          },
        }),
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

  const tbBtn = (icon, title, onClick, extraClass = '') => (
    <button type="button" className={'nmd-md-tb-btn ' + extraClass} title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {icon}
    </button>
  );

  return (
    <div className="nmd-md-wrap" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {toolbarOpen ? (
        <div className="nmd-md-toolbar">
          {tbBtn(<TbIcon><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" /></TbIcon>, 'Bold (⌘B)', () => run(wrapSelection('**')))}
          {tbBtn(<TbIcon><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></TbIcon>, 'Italic (⌘I)', () => run(wrapSelection('*')))}
          {tbBtn(<TbIcon><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></TbIcon>, 'Inline code (⌘E)', () => run(wrapSelection('`')))}
          <span className="nmd-md-tb-sep" />
          {tbBtn(<TbIcon><path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="m17 12 3-2v8" /></TbIcon>, 'Heading 1', () => run(setHeadingLevel(1)))}
          {tbBtn(<TbIcon><path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" /></TbIcon>, 'Heading 2', () => run(setHeadingLevel(2)))}
          {tbBtn(<TbIcon><path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2" /><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2" /></TbIcon>, 'Heading 3', () => run(setHeadingLevel(3)))}
          <span className="nmd-md-tb-sep" />
          {tbBtn(<TbIcon><path d="M17 6H3" /><path d="M21 12H8" /><path d="M21 18H8" /><path d="M3 12v6" /></TbIcon>, 'Quote', () => run(toggleLinePrefix('> ')))}
          {tbBtn(<TbIcon><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /></TbIcon>, 'Bullet list', () => run(toggleLinePrefix('- ')))}
          <span className="nmd-md-tb-codeblock">
            {tbBtn(<TbIcon><path d="m10 9-3 3 3 3" /><path d="m14 15 3-3-3-3" /><rect width="18" height="18" x="3" y="3" rx="2" /></TbIcon>, 'Code block', () => setCodeMenuOpen((o) => !o), codeMenuOpen ? 'active' : '')}
            {codeMenuOpen && (
              <>
                <div className="nmd-md-menu-backdrop" onClick={() => setCodeMenuOpen(false)} />
                <div className="nmd-md-menu">
                  {CODE_LANGUAGES.map((l) => (
                    <button
                      key={l.id || 'plain'}
                      type="button"
                      className="nmd-md-menu-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { run((v) => insertCodeBlock(v, l.id)); setCodeMenuOpen(false); }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </span>
          {tbBtn(<TbIcon><line x1="4" y1="12" x2="20" y2="12" /></TbIcon>, 'Divider', () => run(insertDivider))}
          <span className="nmd-md-tb-sep" />
          {tbBtn(<TbIcon><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></TbIcon>, 'Link (⌘K)', () => run(insertLink))}
          {tbBtn(<TbIcon><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></TbIcon>, 'Link a page (@)', () => run(insertPageMention))}
          {tbBtn(<TbIcon><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></TbIcon>, 'Insert image', onPickImage)}
          <span className="nmd-md-tb-spacer" />
          <button type="button" className="nmd-md-tb-btn nmd-md-tb-close" title="Hide toolbar" onMouseDown={(e) => e.preventDefault()} onClick={() => setToolbarOpen(false)}>
            <TbIcon><path d="M18 6 6 18M6 6l12 12" /></TbIcon>
          </button>
        </div>
      ) : (
        <button type="button" className="nmd-md-toolbar-show" title="Show formatting toolbar" onClick={() => setToolbarOpen(true)}>
          <TbIcon><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></TbIcon>
          <span>Formatting</span>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={onImageInputChange}
      />
      <div ref={containerRef} className="nmd-cm-editor" style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }} />
    </div>
  );
}
