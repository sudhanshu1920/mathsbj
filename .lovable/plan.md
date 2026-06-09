## Goal

Replace the current 7-theme system with **4 curated themes**, each with full Light + Dark palettes. Add a horizontal scrollable "Themes" row inside Settings, mark Theme 4 as Premium with a crown symbol (no emoji). Selection persists in localStorage and applies instantly across the app via CSS variables.

## The 4 themes

| # | Name | Light bg / primary | Dark bg / primary | Notes |
|---|---|---|---|---|
| 1 | Dark Gaming (default) | #f0f4ff / #0099cc | #0a0a0f / #00d4ff | Neon cyan + magenta accent |
| 2 | Light Minimal | #f5f5f5 / #2563eb | #1a1a2e / #3b82f6 | Soft shadows, no glow |
| 3 | Midnight Blue | #e8edf5 / #4f46e5 | #0f172a / #6366f1 | Indigo + cyan accent |
| 4 | Golden Premium | #fffbeb / #d97706 | #0d0a00 / #f5c518 | Gold border on cards, gold->amber accuracy ring, Premium badge |

Each theme writes the full token set (background, foreground, card, primary, accent, border, ring, muted, gradients, glows) so buttons, rings, cards, charts, and gradients all retheme together.

## CSS architecture (`src/index.css`)

For each theme, two scoped blocks:

```css
html.theme-dark-gaming.light { --background: ...; --primary: ...; ... }
html.theme-dark-gaming.dark  { --background: ...; --primary: ...; ... }
```

Same pattern for `.theme-light-minimal`, `.theme-midnight-blue`, `.theme-golden-premium`. The existing `.light` / `.dark` toggle on `<html>` (already managed by `setMode`) combines with the theme class — no logic change needed there.

Theme 4 additions:
- `html.theme-golden-premium .glass-panel, .bg-card { border-color: rgba(217,119,6,0.3); }` (light) and `rgba(245,197,24,0.3)` (dark)
- `--ring-gradient-from / --ring-gradient-to` overridden to gold/amber; ProgressPage SVG `<linearGradient id="ringGrad">` reads these vars (small tweak so theme 4 ring looks gold).

Remove the 7 legacy theme blocks (duo-purple, neon-core, royal-obsidian, emerald-elite, crimson-velocity, golden-prime, glass-matte) from `index.css`.

## Theme registry (`src/lib/theme.ts`)

- `ThemeId = 'dark-gaming' | 'light-minimal' | 'midnight-blue' | 'golden-premium'`
- `DEFAULT_THEME = 'dark-gaming'`
- Bump storage key to `math-app-theme-v4` (old v3 reads still fall back to default).
- `THEMES` array entries get a new `premium?: boolean` flag (true for golden-premium) and a `swatch` of 3 colors used for the dot preview (bg, primary, accent — dark variant by default for visual punch).
- `applyTheme(id)` unchanged in shape (adds `theme-<id>` class on `<html>`).

## Settings UI (`src/components/SettingsPanel.tsx`)

Replace the current vertical theme list with:

```text
[ Themes ]                                   Dark | Light
+-----------------------------------------------------+
| (o o o)   (o o o)   (o o o)   (o o o)[crown]       |  <- horizontal scroll
|  Dark      Light     Midnight   Golden              |
|  Gaming    Minimal   Blue       Premium             |
|   v                                                 |
+-----------------------------------------------------+
```

- Container: `flex gap-3 overflow-x-auto snap-x` with hidden scrollbar.
- Each card: ~104px wide, rounded glass tile, tap to call `setTheme(id)`.
- Color preview: 3 overlapping circular dots (bg / primary / accent) using the theme's current-mode palette.
- Selected card: primary ring + checkmark (lucide `Check`) top-right.
- Theme 4: small "Premium" pill with lucide `Crown` symbol top-right (replaces check when selected -> show both stacked).
- Heading row: "Themes" label on the left, existing Dark/Light mode toggle stays above or beside it (kept as-is).

No emoji anywhere — only lucide icons (Check, Crown, Palette, Sun, Moon).

## ProgressPage accuracy ring

Add CSS vars `--ring-from` / `--ring-to` (default = primary/accent). Theme 4 sets them to `#f5c518` / `#ff9500` (dark) and `#d97706` / `#b45309` (light). `<linearGradient id="ringGrad">` stops switch to `stop-color: hsl(var(--ring-from))` etc., so the gold ring appears automatically when Golden Premium is active.

## Out of scope

- No changes to math/quiz logic, auth, sync, or backend.
- BottomNav, LearningPage, PracticePage code untouched — they re-skin automatically via tokens.
- Mode toggle mechanism (`setMode`) unchanged.

## Files to edit

- `src/lib/theme.ts` — new ThemeId union, 4 entries, premium flag, v4 key.
- `src/index.css` — remove old theme blocks, add 4 themes x 2 modes, gold border + ring vars.
- `src/components/SettingsPanel.tsx` — horizontal scrollable theme row, Crown badge on Premium.
- `src/pages/ProgressPage.tsx` — use `--ring-from` / `--ring-to` in `<linearGradient>`.

## Success criteria

- Settings shows 4 themes in a single horizontal scroll row with circular previews.
- Tapping a theme retints the entire app instantly; selection persists across reloads.
- Toggling Dark/Light swaps the active theme's light/dark palette without losing the theme choice.
- Golden Premium shows a Crown "Premium" badge and renders a gold->amber accuracy ring.
- No emoji used; all iconography is lucide symbols.
