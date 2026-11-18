import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, ViewPlugin } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { MARKER, WORD, findHighlights } from './highlight.js';

/* The editor side of `==highlight==`: a decoration that paints the stroke
   while you write, and the toggle command behind ⌘⇧H / the toolbar button. */

const CODE_NODE = /^(FencedCode|CodeBlock|InlineCode|CodeText|CodeInfo|CodeMark)$/;

/* Is `pos` inside a code span or code block? Markers there are just text. */
function inCode(state, pos) {
  for (let node = syntaxTree(state).resolveInner(pos, 1); node; node = node.parent) {
    if (CODE_NODE.test(node.name)) return true;
  }
  return false;
}

/* Highlights on one editor line as document ranges (markers included). */
function lineHighlights(state, line) {
  if (line.text.indexOf(MARKER) === -1) return [];
  return findHighlights(line.text, (i) => inCode(state, line.from + i))
    .map((r) => ({ from: line.from + r.from, to: line.from + r.to }));
}

/* ── Decoration ─────────────────────────────────────────────────────────── */

const strokeMark = Decoration.mark({ class: 'nmd-cm-highlight' });
const openMark = Decoration.mark({ class: 'nmd-cm-highlight nmd-cm-highlight-mark open' });
const closeMark = Decoration.mark({ class: 'nmd-cm-highlight nmd-cm-highlight-mark close' });

function buildDecorations(view) {
  const builder = new RangeSetBuilder();
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      for (const r of lineHighlights(view.state, line)) {
        builder.add(r.from, r.from + 2, openMark);
        builder.add(r.from + 2, r.to - 2, strokeMark);
        builder.add(r.to - 2, r.to, closeMark);
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

export const highlightMarks = ViewPlugin.fromClass(
  class {
    constructor(view) { this.decorations = buildDecorations(view); }
    update(update) {
      // The syntax tree arrives incrementally, and it decides what counts as code.
      const reparsed = syntaxTree(update.startState) !== syntaxTree(update.state);
      if (update.docChanged || update.viewportChanged || reparsed) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

/* ── Toggle command ─────────────────────────────────────────────────────── */

/* Markdown that has to stay at the very start of a line: list bullets and
   numbers, task boxes, quote marks, heading hashes. A highlight goes after it. */
const BLOCK_PREFIX = /^\s*(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|>\s?|#{1,6}\s+)*/;

/* The cells of a table row, or null when `line` isn't part of a table. A
   highlight has to stay inside one cell — wrapping the pipes breaks the table. */
function tableCells(state, line) {
  let cells = null;
  syntaxTree(state).iterate({
    from: line.from,
    to: line.to,
    enter(node) {
      if (node.name === 'Table') cells = cells || [];
      else if (node.name === 'TableCell') cells.push({ from: node.from, to: node.to });
    },
  });
  return cells;
}

/* The stretches of the selection a highlighter would actually touch, one per
   line (or per table cell): past any block prefix, without surrounding
   whitespace, snapped outward to whole words — a marker glued to half a word
   wouldn't count as a highlight. */
function strokes(state, range) {
  const out = [];
  const first = state.doc.lineAt(range.from);
  const last = state.doc.lineAt(range.to);
  for (let n = first.number; n <= last.number; n++) {
    const line = state.doc.line(n);
    const at = (pos) => line.text[pos - line.from];
    const spans = tableCells(state, line)
      || [{ from: line.from + BLOCK_PREFIX.exec(line.text)[0].length, to: line.to }];
    const marks = lineHighlights(state, line);
    for (const span of spans) {
      let from = Math.max(range.from, span.from);
      let to = Math.min(range.to, span.to);
      while (from < to && /\s/.test(at(from))) from++;
      while (to > from && /\s/.test(at(to - 1))) to--;
      if (to <= from || inCode(state, from)) continue;
      while (from > span.from && WORD.test(at(from - 1))) from--;
      while (to < span.to && WORD.test(at(to))) to++;
      out.push({ from, to, marks });
    }
  }
  return out;
}

/**
 * Highlight the selection, or lift the highlight if it's already there.
 * Works line by line, so selecting a few list items highlights each one.
 * With just a cursor: lifts the highlight it sits in, or drops in an empty
 * `====` to type into.
 */
export function toggleHighlight(view) {
  const { state } = view;
  const range = state.selection.main;
  const changes = [];
  const drop = (from) => changes.push({ from, to: from + 2, insert: '' });
  const add = (from) => changes.push({ from, insert: MARKER });
  const lift = (r) => { drop(r.from); drop(r.to - 2); };

  if (range.empty) {
    const pos = range.head;
    const inside = lineHighlights(state, state.doc.lineAt(pos)).find((r) => r.from <= pos && pos <= r.to);
    if (inside) {
      lift(inside);
      const set = state.changes(changes);
      view.dispatch({ changes: set, selection: { anchor: set.mapPos(pos) }, userEvent: 'input' });
    } else if (!inCode(state, pos)) {
      view.dispatch({
        changes: { from: pos, insert: MARKER + MARKER },
        selection: { anchor: pos + 2 },
        userEvent: 'input',
      });
    }
    view.focus();
    return true;
  }

  const todo = strokes(state, range);
  if (!todo.length) return true; // nothing a highlighter could mark

  const covering = (s) => s.marks.find((r) => r.from <= s.from && s.to <= r.to);
  if (todo.every(covering)) {
    new Set(todo.map(covering)).forEach(lift);
  } else {
    for (const s of todo) {
      if (covering(s)) continue;
      // Fold any highlight this stroke touches into one continuous stroke.
      const touched = s.marks.filter((r) => r.from <= s.to && r.to >= s.from);
      const from = Math.min(s.from, ...touched.map((r) => r.from));
      const to = Math.max(s.to, ...touched.map((r) => r.to));
      // A marker already sitting at either end is reused rather than re-added.
      const opens = touched.some((r) => r.from === from);
      const closes = touched.some((r) => r.to === to);
      for (const r of touched) {
        if (r.from !== from) drop(r.from);
        if (r.to !== to) drop(r.to - 2);
      }
      if (!opens) add(from);
      if (!closes) add(to);
      s.from = opens ? from + 2 : from;
      s.to = closes ? to - 2 : to;
    }
  }

  // Leave the highlighted text selected so pressing the shortcut again undoes it.
  const set = state.changes(changes);
  view.dispatch({
    changes: set,
    selection: {
      anchor: set.mapPos(todo[0].from, 1),
      head: set.mapPos(todo[todo.length - 1].to, -1),
    },
    userEvent: 'input',
  });
  view.focus();
  return true;
}
