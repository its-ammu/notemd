// Deterministic tag colors — the same tag gets the same hue everywhere
// (editor tag bar, sidebar, storyboard, filter chips, public pages).
// Chips read the hue via the --tag-hue CSS variable; light/dark lightness
// is handled in CSS so this stays theme-agnostic.

const HUES = [215, 262, 335, 15, 152, 190, 45, 290, 120, 350];

export function tagHue(tag) {
  const s = String(tag).toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

export const tagStyle = (tag) => ({ '--tag-hue': tagHue(tag) });
