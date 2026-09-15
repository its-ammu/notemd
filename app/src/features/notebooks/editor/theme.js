import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/* Custom highlight style matching NoteMD's design tokens. */
export const mdHighlight = HighlightStyle.define([
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

export const mdTheme = EditorView.theme({
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

export const mdSyntaxHighlight = syntaxHighlighting(mdHighlight);
