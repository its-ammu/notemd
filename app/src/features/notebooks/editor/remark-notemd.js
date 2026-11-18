/* NoteMD's markdown extensions. Applied in MarkdownView, so they cover both the
   in-app preview and public shared pages. */

import { MARKER, INLINE_NODE, canOpen, canClose } from './highlight.js';

/* ---------------------------------------------------------------- underline */

/* Minimal unist walker — visits every node of `type`. */
function visit(node, type, fn) {
  if (node.children) for (const child of node.children) visit(child, type, fn);
  if (node.type === type) fn(node);
}

/**
 * remarkUnderline — renders `__text__` as underline instead of bold.
 *
 * NoteMD uses `**` for bold everywhere (⌘B, the toolbar), which leaves the
 * underscore form free to mean underline. mdast doesn't record which marker
 * opened a `strong` node, so we check the source offsets; `data.hName` then
 * tells mdast-util-to-hast to emit `<u>` rather than `<strong>`.
 */
export function remarkUnderline() {
  return (tree, file) => {
    const src = String(file);
    visit(tree, 'strong', (node) => {
      const start = node.position?.start?.offset;
      if (start == null) return;
      if (src.slice(start, start + 2) !== '__') return;
      node.data = { ...node.data, hName: 'u' };
    });
  };
}

/* ---------------------------------------------------------------- highlight */

/* GFM turns a bare URL into a link and lets it swallow a closing marker
   (`==https://example.com==` links to `…com==`). Hand the marker back: returns
   the link without it, or null when `node` isn't a bare-URL link ending in one. */
function unswallowMarker(node) {
  if (node.type !== 'link' || !node.url.endsWith(MARKER)) return null;
  const only = node.children.length === 1 ? node.children[0] : null;
  if (only?.type !== 'text' || !only.value.endsWith(MARKER)) return null;
  // Bare URLs have no `[…](…)` around them, so the node is exactly its text.
  const { start, end } = node.position || {};
  if (start?.offset == null || end.offset - start.offset !== only.value.length) return null;
  return {
    ...node,
    url: node.url.slice(0, -MARKER.length),
    children: [{ ...only, value: only.value.slice(0, -MARKER.length) }],
  };
}

/* Rebuild one parent's inline children, wrapping each `==…==` run in a node
   that renders as <mark>. Returns null when nothing was highlighted, so
   untouched parents keep their original nodes (and source positions). */
function markChildren(children) {
  if (!children.some((c) => c.type === 'text' && c.value.includes(MARKER))) return null;

  const out = [];
  let open = null; // nodes collected since an opening marker, or null
  let marked = false;
  const emit = (node) => (open || out).push(node);
  const emitText = (value) => { if (value) emit({ type: 'text', value }); };
  // An opener that never found its closer goes back to being literal text.
  const abandon = () => {
    out.push({ type: 'text', value: MARKER }, ...open);
    open = null;
  };
  const close = () => {
    // `emphasis` so every mdast consumer knows the shape; hName swaps the tag.
    out.push({ type: 'emphasis', children: open, data: { hName: 'mark' } });
    open = null;
    marked = true;
  };

  children.forEach((child, ci) => {
    if (child.type === 'break') { if (open) abandon(); out.push(child); return; }
    if (child.type !== 'text') {
      const freed = open && unswallowMarker(child);
      if (freed) { open.push(freed); close(); } else emit(child);
      return;
    }

    const v = child.value;
    let last = 0;
    for (let i = 0; i < v.length; i++) {
      if (v[i] === '\n') {
        // Highlights never span a line break (the editor works line by line).
        if (open) { emitText(v.slice(last, i)); abandon(); last = i; }
        continue;
      }
      if (!v.startsWith(MARKER, i)) continue;
      const before = i > 0 ? v[i - 1] : (ci > 0 ? INLINE_NODE : undefined);
      const after = i + 2 < v.length ? v[i + 2] : (ci < children.length - 1 ? INLINE_NODE : undefined);
      if (!open) {
        if (!canOpen(before, after)) continue;
        emitText(v.slice(last, i));
        open = [];
      } else {
        if (!(open.length || i > last) || !canClose(before, after)) continue;
        emitText(v.slice(last, i));
        close();
      }
      last = i + 2;
      i += 1; // step over the second `=`
    }
    emitText(v.slice(last));
  });
  if (open) abandon();
  return marked ? out : null;
}

function markTree(node) {
  if (!node.children) return;
  node.children.forEach(markTree);
  const next = markChildren(node.children);
  if (next) node.children = next;
}

/**
 * remarkHighlight — renders `==text==` as a highlighter stroke (<mark>).
 *
 * Works on the parsed tree rather than the source, so markers inside code are
 * never touched and a highlight can wrap other inline formatting
 * (`==some **bold** words==`). The open/close rules live in ./highlight so the
 * editor decorates exactly the same ranges.
 */
export function remarkHighlight() {
  return (tree) => markTree(tree);
}

/* ------------------------------------------------------------ spaced links */

/* Encode the spaces in one link destination, preserving an optional
   `"title"` / `'title'` suffix. */
function encodeDestination(dest) {
  const trimmed = dest.trim();
  const titled = /^(\S.*?)\s+("[^"]*"|'[^']*')$/.exec(trimmed);
  if (titled) return `${titled[1].replace(/\s+/g, '%20')} ${titled[2]}`;
  return trimmed.replace(/\s+/g, '%20');
}

/* Rewrite one non-code line, stepping over inline code spans and escapes so a
   `[x](a b)` sample inside backticks is left exactly as written. */
function encodeLine(line) {
  let out = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '\\') { out += line.slice(i, i + 2); i += 2; continue; }
    if (ch === '`') {
      const run = /^`+/.exec(line.slice(i))[0];
      const close = line.indexOf(run, i + run.length);
      const end = close === -1 ? line.length : close + run.length;
      out += line.slice(i, end);
      i = end;
      continue;
    }
    if (ch === ']' && line[i + 1] === '(') {
      const close = line.indexOf(')', i + 2);
      const dest = close === -1 ? null : line.slice(i + 2, close);
      if (dest && /\s/.test(dest) && !dest.startsWith('<')) {
        out += `](${encodeDestination(dest)})`;
        i = close + 1;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * encodeSpacedLinkUrls — makes `[report](my file.pdf)` an actual link.
 *
 * CommonMark forbids unescaped spaces in an inline link destination unless it's
 * wrapped in angle brackets, so micromark never builds a link node and the whole
 * construct renders as literal text. This has to run on the source rather than
 * on the mdast: by the time we'd see the tree, GFM autolink literals have
 * already carved `[docs](https://ex.com/a b.pdf)` into three unrelated nodes.
 *
 * Fenced code blocks and inline code spans are skipped. Percent-encoding never
 * changes line counts, so the preview↔source scroll mapping in
 * `rehype-source-position` is unaffected.
 *
 * Note: indented (4-space) code blocks are *not* skipped — telling them apart
 * from nested list content isn't worth it, and links inside nested lists are far
 * more common in these notes than indented code.
 */
export function encodeSpacedLinkUrls(src) {
  if (!src || !src.includes('](')) return src;

  const lines = src.split('\n');
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      continue;
    }
    if (f) { fence = f[1]; continue; }
    if (line.includes('](')) lines[i] = encodeLine(line);
  }
  return lines.join('\n');
}
