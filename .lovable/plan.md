# Premium Gaming Glass-Matte UI + Perf Fix

## Direction
Frosted-glass HUD with gaming energy: deep midnight base, translucent blurred panels, cyan + violet neon edges, subtle scanline/grain, no Duolingo chunky shadows, no mascot. All screens unified.

Palette (Glass Aurora + neon edge):
- bg `#0B1020` · panel `rgba(20,28,48,0.55)` blur 18px
- primary cyan `#22D3EE` · accent violet `#A78BFA` · success mint `#4ADE80` · warn amber `#FBBF24` · danger rose `#F87171`
- borders: 1px `rgba(255,255,255,0.08)` + outer cyan glow on active

Type: Rajdhani (display/numbers) + Inter (body).

## 1. Performance — fix slow page switching
Causes found in code:
- `AnimatePresence mode="wait"` remounts entire page on tab change
- 200-item number grids stagger-animate every render
- Global CSS transitions target `[class*="bg-"]`, `[class*="border"]`, `[class*="text-"]` — repaints thousands of nodes
- Heavy radial gradients re-rasterized per repaint

Fixes:
- Keep all tabs mounted; toggle via `hidden` class, one light fade only
- Drop per-item motion stagger on number/topic/range grids (single wrap fade)
- Narrow global transition selector to `body, button, .bg-card, .bg-popover`
- `React.lazy` + `Suspense` for PracticePage and ProgressPage
- Memoize topic/number grids; stable callbacks
- Move backdrop gradients to a fixed pseudo-element, `will-change: auto`

## 2. Glass-Matte gaming theme
Make `glass-matte` the **default** (bump key to `math-app-theme-v3`). Rework tokens in `html.theme-glass-matte` (`src/index.css`):

```
--background: 225 50% 7%;
--card: 225 35% 14%;            /* used at 55% alpha via .glass */
--popover: 225 35% 12%;
--primary: 187 92% 53%;         /* #22D3EE */
--accent:  258 90% 73%;         /* #A78BFA */
--success: 142 76% 58%;
--warning: 41 96% 56%;
--destructive: 0 86% 70%;
--border: 220 30% 90% / .10;
--ring: 187 92% 53%;
--glow-primary: 0 0 0 1px hsl(187 92% 53%/.45), 0 0 24px hsl(187 92% 53%/.35);
--glow-accent:  0 0 0 1px hsl(258 90% 73%/.45), 0 0 24px hsl(258 90% 73%/.30);
```

Add utilities:
- `.glass-panel` — `background: linear-gradient(145deg, hsl(var(--card)/.65), hsl(var(--card)/.35)); backdrop-filter: blur(18px) saturate(140%); border:1px solid hsl(var(--border));`
- `.glass-panel-active` — adds `box-shadow: var(--glow-primary)`
- `.hud-bracket` — corner ticks via pseudo-elements
- `.neon-text` — `text-shadow: 0 0 10px hsl(var(--primary)/.55)`
- Body: dark base + faint 1px grid (`linear-gradient` 40px) + 2 soft radial cyan/violet glows fixed

## 3. Component restyle (skin, no logic changes)
- **BottomNav**: glass bar with top hairline gradient; active item = glass pill + cyan ring + neon icon; remove chunky shadow + motion bounce
- **LearningPage**: HUD top bar (Level/XP/Streak as glass chips with neon counters); **remove mascot + speech bubble**; topic grid = glass tiles with neon symbol, hover/active = cyan glow, drop chunky shadow + per-item stagger
- **Number grid (1–200)**: flat glass tiles, no motion stagger, cyan ring on hover/selected
- **PracticePage**: glass quiz panel, cyan ring timer, violet lives pips; correct = cyan flash, wrong = rose flash
- **ProgressPage**: glass cards, cyan/violet chart palette, HUD brackets on headers
- **WelcomePage**: glass hero card, neon CTA, no mascot
- **SettingsPanel**: Glass-Matte shown first with "Default" badge; other premium themes stay selectable
- **Buttons**: default = glass + cyan glow, secondary = glass + violet, destructive = glass + rose. API unchanged
- Delete `src/components/duo/Mascot.tsx` and its imports

## Files to change
```
src/index.css                      tokens, .glass-panel utilities, narrow transitions, grid backdrop
src/lib/theme.ts                   default → glass-matte, key v3
tailwind.config.ts                 Rajdhani display, neon shadow tokens
src/App.tsx                        lazy PracticePage/ProgressPage + Suspense
src/pages/Index.tsx                tabs always mounted, single fade
src/pages/LearningPage.tsx         remove mascot, HUD header, glass topic grid, no stagger
src/pages/PracticePage.tsx         glass quiz panel + neon feedback
src/pages/ProgressPage.tsx         glass cards + neon charts
src/pages/WelcomePage.tsx          glass hero, no mascot
src/components/BottomNav.tsx       glass HUD bar
src/components/SettingsPanel.tsx   surface Glass-Matte as default
src/components/TopicCard.tsx       glass variant
src/components/XPBar.tsx           cyan glow fill
src/components/duo/Mascot.tsx      delete
```

## Out of scope
Backend, math/quiz logic, auth, sounds, theme-switch mechanism (already works).

## Success criteria
- Tab switch Learn ⇄ Quiz ⇄ Progress feels instant; no full remount
- Number grid (200 items) opens without stagger lag
- Every screen reads as one premium glass-matte gaming HUD — frosted panels, cyan/violet neon edges, no mascot, no chunky Duolingo shadows
- Other themes still selectable and apply instantly
