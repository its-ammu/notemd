import GithubSlugger from 'github-slugger';

/* Strip inline markdown so the text we slugify is the same plain text
 * rehype-slug sees inside the rendered heading (otherwise links, bold, etc.
 * leak into the slug). */
function stripInlineMarkdown(s) {
  return s
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
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
