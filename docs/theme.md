# NoteMD theme & design patterns

A guide for anyone (human or agent) touching NoteMD's UI. The app and its
marketing site share one visual world: **a modern notebook on a tidy desk** —
quiet cool neutrals, white "sheets" floating on a soft gray canvas, refined
indigo accents, and hand-drawn doodles that keep it warm without getting cute.
If a change could be swapped into a generic SaaS dashboard unnoticed, it's
off-theme.

The marketing site (`web/`) shares this visual world but lives outside the public repo.

## 1. Core identity

- **Metaphor:** notebook, not dashboard. Cards are "sheets", the canvas is
  "paper", text is "ink". Paper personality lives in the page styles
  (ruled/dotted/squared), not a global warm tint.
- **Emotional target:** calm. No urgency, no gamification, no exclamation
  marks. Microcopy is lowercase-friendly and a little wry ("Suspiciously
  peaceful", "The calendar bows to you").
- **One working accent** (indigo `--accent-blue`) does the interactive work.
  Purple and rose are garnishes: meeting dots, candle flame, danger.

## 2. Tokens (source of truth: `app/src/shared/styles/tokens.css`)

Always use the CSS custom properties — never hardcode hex values in
components or feature sheets.

| Role | Token | Light value |
|---|---|---|
| Canvas | `--paper` / `--bg` | `#f4f4f5` |
| Sheets (cards, dialogs) | `--paper-raised` / `--bg-raised` | `#ffffff` |
| Primary ink | `--ink-strong` / `--fg1` | `#1c1e22` |
| Body ink | `--ink` / `--fg2` | `#43474e` |
| Muted / hints | `--fg3`, `--fg4` | grays |
| Accent | `--accent-blue` | `#5167F4` |
| Garnish | `--accent-purple`, `--accent-rose` | `#8B5CF6`, `#DA3158` |
| Borders | `--border`, `--border-strong` | hairlines |
| Danger | `--danger` | rose |

- **Type:** Inter for everything, Fira Code (`--font-mono`) for meta/kbd/code.
  Sizes and weights come from `--text-*` / `--fw-*`.
- **Radii:** `--radius-sm` 6px → `--radius-xl` 16px. Dialogs use `xl`,
  inputs/buttons `md`, chips/pills often full-round (999px).
- **Shadows:** ink-tinted and soft (`--shadow-sm/card/float/overlay`).
  Never harsh black drop shadows.
- **Motion:** `--dur-fast` 120ms / `--dur-med` 180ms with `--ease`. Sparse,
  functional animation only (fade-in, 6px rise). Respect
  `prefers-reduced-motion` (handled in `responsive.css`).
- **Dark theme** is `[data-theme="dark"]` overriding the same tokens
  ("paper under lamplight"). If you only use tokens, dark mode is free —
  that's the point. Test both.

## 3. Doodles & icons (`app/src/shared/components/Doodles.jsx`)

The signature device. Hand-drawn-style SVGs with deliberately wobbly bezier
paths, round caps, slight rotations (±1.5–4°), drawn with the shared `ink`
prop set and `stroke="currentColor"` so they inherit theme colors.

Rules:
- **Never** use an icon library (lucide/feather/etc.) — it breaks the world.
  Draw wobbly paths in the same style (e.g. a "circle" is a 4-segment bezier
  that doesn't quite close perfectly; see `DoodleClockMini`).
- **Every reusable SVG lives in `Doodles.jsx`**, grouped: illustrations
  (`Doodle*`) first, plain geometric mini icons (`IconPlus`, `IconCheck`,
  `IconCopy`) in their own commented section. One-off inline SVGs in
  components are tolerated but should be promoted the moment they're reused.
- Give elements breathing room inside the viewBox (e.g. `DoodleClockAdd`
  nudges the dial down-left so the plus in the corner doesn't touch it).
- Accent color pops inside doodles use tokens (`var(--accent-rose)` flame,
  `var(--accent-blue)` check), not literals.

## 4. Component conventions

- **Class prefix:** everything is `nmd-*`. Plain CSS, no Tailwind, no
  CSS-in-JS. Sheets live in `app/src/shared/styles/`, imported in `main.jsx`
  in order: tokens → shell → feature sheets → responsive. Put shared chrome
  (modals, buttons, tabs) in `shell.css`, feature styles in the feature sheet.
- **Modals:** `nmd-modal-backdrop` > `nmd-modal` (+ variant class like
  `nmd-modal-settings`). Capped at `calc(100vh - 80px)` with a scrollable
  `nmd-modal-body` — a modal must never take the full viewport height.
  Long modals get a top tab bar (`nmd-modal-tabs`, shared with the how-to
  guide) instead of growing taller.
- **Settings rows:** `nmd-modal-row` = label + hint on the left
  (`nmd-modal-row-text`), one compact control on the right. Controls:
  `nmd-modal-input` for text, `nmd-segmented nmd-segmented-compact` for
  enum choices, `nmd-btn` (`primary` / `danger`) for actions. Don't build
  full-width stacked form fields inside settings — they eat vertical space.
- **Stats/metadata:** small pill chips (`nmd-storage-stat` pattern): bordered,
  full-round, 11–12px, bold value + muted label, `flex-wrap` so they never
  overflow. Prefer chips over one long `·`-separated line.
- **User preferences** live in the `profiles.preferences` JSON column via
  `useProfile` (`DEFAULT_PREFS` holds defaults). To add one: default in
  `useProfile.js` → thread through `App.jsx` as a prop → control in
  `SettingsModal.jsx` (appropriate tab). Writes are debounced; no schema
  changes needed.
- **Danger actions** (erase, delete) always use the rose/danger styling and
  sit last in their section.

## 5. Voice & microcopy

- Short lines, sentence case, no hype verbs ("supercharge", "unleash").
- Controls name their action: "Open NoteMD", "Erase data", "Add meeting" —
  never "Get started" or "Go!".
- Hints explain consequences plainly: "Replace current data with a
  previously exported file."
- Empty states and toasts may be gently playful; settings and destructive
  flows stay matter-of-fact.

## 6. Accessibility & responsiveness floor

- Focus-visible rings on everything interactive (`--focus-ring`, already
  global in `tokens.css`).
- Segmented groups get `role="group"`/`role="tablist"` + `aria-label`;
  icon-only buttons get `title` and/or `aria-label`.
- Text contrast ≥ 4.5:1 on paper in both themes.
- `responsive.css` stacks modal rows vertically and bumps tap targets under
  720px — check new controls against it. Inputs stay ≥16px on mobile to
  avoid iOS zoom.

## 7. Quick self-check before shipping UI

1. Only tokens, no hex? Works in dark mode?
2. Icons wobbly and living in `Doodles.jsx` (or clearly one-off)?
3. Modal still fits a short viewport? Row layout, not stacked fields?
4. Copy sounds like a calm notebook, not a SaaS?
5. Focus ring, aria labels, mobile stacking verified?
