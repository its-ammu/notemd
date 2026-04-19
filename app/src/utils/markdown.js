export function slugify(text) {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'heading';
}

export function makeUniqueSlugger() {
  const counts = {};
  return (text) => {
    const base = slugify(text);
    const n = counts[base] || 0;
    counts[base] = n + 1;
    return n === 0 ? base : `${base}-${n}`;
  };
}

export function parseHeadings(source) {
  if (!source) return [];
  const lines = source.split('\n');
  const slug = makeUniqueSlugger();
  const out = [];
  let inCode = false;
  for (const line of lines) {
    if (line.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    const m = /^(#{1,4}) (.+)$/.exec(line);
    if (!m) continue;
    const text = m[2].trim();
    out.push({ level: m[1].length, text, id: slug(text) });
  }
  return out;
}
