# Make the App Feel Instant

Goal: cut startup time, remove animation jank, and make every tap/screen switch feel immediate — without changing the look.

## What you'll notice

- App opens noticeably faster on first launch (smaller initial download).
- Tapping a topic, switching tabs, or opening Settings feels instant.
- Smooth 60fps scrolling on the number grids and Progress screen, especially on mid-range phones.
- Same glass-matte visual style; heavy effects only where they're visible.

## Work items

### 1. Shrink the initial bundle
- Load the animation library (`framer-motion`) through its lazy `LazyMotion` + `m` API instead of the full `motion` bundle, and load the feature set on demand. Saves ~40-60% of that library's weight on first paint.
- Split out KaTeX (formulas) so it only downloads when the Formulas topic is opened.
- Split heavy screens further: `LearningPage` sub-views (Formulas, Trigonometry, Percentage) become lazy chunks.
- Add manual Rollup chunks (react vendor / supabase / motion) so repeat visits cache better.

### 2. Reduce paint cost of the glass UI
- `backdrop-filter` is the single most expensive effect on mobile. Lower blur radius on large surfaces, drop `saturate()` where it isn't visible, and stop stacking blurred layers (nav + panel + card).
- Replace the fixed, multi-layer gradient/grid page background with a single cheap layer; `background-attachment: fixed` forces a full repaint on every scroll on mobile — remove it.
- Add `content-visibility: auto` to long lists (number grids, topic lists, analytics rows) so off-screen items skip layout and paint.
- Restrict animated glow/box-shadow effects to short, GPU-friendly transform/opacity animations.

### 3. Cut per-frame React work
- Memoize grid cells (`TopicCard`, number buttons, keypad keys) so a single state change doesn't re-render hundreds of nodes.
- Move localStorage reads (settings, XP, streak, analytics) behind a cached in-memory store instead of parsing JSON on every render/event.
- Debounce the idle/activity tracker and reduce timer frequency; use passive event listeners.
- Drop per-item entry animation staggers on lists over ~20 items.

### 4. Faster startup path
- Defer non-critical boot work (PWA registration, cloud sync bootstrap) to after first paint via `requestIdleCallback`.
- Preconnect to the backend origin, and preload the display font with `font-display: swap`.
- Keep the auth gate from blocking first render: show the shell immediately, hydrate session state in the background.

### 5. Verify
- Measure before/after with a scripted Playwright run against the preview: first-contentful-paint, main-bundle size, and a scroll/tap FPS sample on the Learning and Practice screens.
- Confirm no visual regressions on both light and dark, across all 4 themes.

## Technical notes

- `LazyMotion` with `domAnimation` features; convert `motion.*` usages to `m.*` (mechanical change across ~15 files).
- `vite.config.ts`: add `build.rollupOptions.output.manualChunks`, keep the existing PWA config intact.
- CSS changes live in `src/index.css` utilities (`.glass`, `.glass-panel`, body background layers).
- No backend, schema, or game-logic changes.
