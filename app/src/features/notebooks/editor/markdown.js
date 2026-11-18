import GithubSlugger from 'github-slugger';
import { stripHighlightMarkers } from './highlight.js';

/* Strip inline markdown so the text we slugify is the same plain text
 * rehype-slug sees inside the rendered heading (otherwise links, bold, etc.
 * leak into the slug). */
function stripInlineMarkdown(s) {
  return stripHighlightMarkers(s)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/** One line of plain text for a list preview. Markers, code fences and
    highlight strokes come off; the note itself is unchanged. */
export function previewText(source, limit = 120) {
  if (!source) return '';
  const parts = [];
  let inCode = false;
  for (const raw of String(source).split('\n')) {
    if (raw.trim().startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    const line = stripInlineMarkdown(raw)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\d+[.)]\s+/, '')
      .replace(/^\s*>\s?/, '')
      .replace(/\|/g, ' ')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (line && !/^[-:| ]+$/.test(line)) parts.push(line);
  }
  return parts.join(' ').replace(/\s+/g, ' ').slice(0, limit);
}

export function parseHeadings(source) {
  if (!source) return [];
  const lines = source.split('\n');
  const slugger = new GithubSlugger();
  const out = [];
  let inCode = false;
  for (const line of lines) {
    if (line.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    const m = /^(#{1,4}) (.+)$/.exec(line);
    if (!m) continue;
    const text = stripInlineMarkdown(m[2].trim());
    out.push({ level: m[1].length, text, id: slugger.slug(text) });
  }
  return out;
}
