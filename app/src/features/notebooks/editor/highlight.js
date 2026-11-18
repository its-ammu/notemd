/* `==text==` highlights — the rules shared by the editor (decorations, the
   toggle command) and the rendered view (remarkHighlight), so both always
   agree on what is and isn't highlighted.

   A `==` only opens a highlight when it isn't glued to the end of an
   identifier and is followed by something to highlight; it only closes one
   when it follows text and isn't glued to the start of an identifier. That
   keeps comparisons written in prose — `a == b`, `x==y`, `count==0` — exactly
   as they were before highlights existed. Highlights never span a line break. */

export const MARKER = '==';

/* Stands in for a neighbouring inline node (bold, a link, inline code…) when a
   marker sits at the very edge of a text node: not a space, not a word. */
export const INLINE_NODE = '\uFFFC';

/* Identifier characters. ASCII on purpose: the rule exists to protect
   code-like comparisons, and scripts written without spaces between words
   (Japanese, Chinese, Thai…) must still be able to highlight mid-sentence. */
export const WORD = /[A-Za-z0-9_]/;
const SPACE = /\s/;

const gluedToWord = (ch) => ch !== undefined && (ch === '=' || WORD.test(ch));
const blank = (ch) => ch === undefined || ch === '=' || SPACE.test(ch);

/** Can a `==` open a highlight, given the characters on either side of it? */
export const canOpen = (before, after) => !gluedToWord(before) && !blank(after);

/** Can a `==` close a highlight, given the characters on either side of it? */
export const canClose = (before, after) => !blank(before) && !gluedToWord(after);

/**
 * Find the highlights on a single line of markdown source.
 * Returns `[{ from, to }]` — offsets into `line`, markers included.
 * `skip(index)` lets the caller ignore markers at certain offsets (the editor
 * uses it to step over markers that sit inside code).
 */
export function findHighlights(line, skip) {
  const out = [];
  if (!line || line.indexOf(MARKER) === -1) return out;
  let open = -1;
  let i = line.indexOf(MARKER);
  while (i !== -1) {
    const before = line[i - 1];
    const after = line[i + 2];
    let consumed = false;
    if (!skip || !skip(i)) {
      if (open === -1) {
        if (canOpen(before, after)) { open = i; consumed = true; }
      } else if (canClose(before, after)) {
        out.push({ from: open, to: i + 2 });
        open = -1;
        consumed = true;
      }
    }
    i = line.indexOf(MARKER, consumed ? i + 2 : i + 1);
  }
  return out;
}

/** Drop the `==` markers from a line, keeping the highlighted text. */
export function stripHighlightMarkers(line) {
  const ranges = findHighlights(line);
  if (!ranges.length) return line;
  let out = '';
  let last = 0;
  for (const { from, to } of ranges) {
    out += line.slice(last, from) + line.slice(from + 2, to - 2);
    last = to;
  }
  return out + line.slice(last);
}
