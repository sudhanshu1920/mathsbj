# Fix Submit Button — Mobile Sticky, No Shift

## Scope
Only the input-mode Submit action inside the practice quiz. MCQ tiles unchanged. Setup screen unchanged.

The current "Submit" is the OK key at the bottom of `MathKeypad` (spans 3 columns). It sits inside normal flow inside a scrollable page, so as `inputValue` grows the answer preview box height changes and the row shifts. On some devices the browser toolbar / OS gesture bar also crops it. We'll lift it out of the scroll flow into a fixed bottom bar with safe-area insets, and lock its layout.

## Changes

### 1. `src/pages/PracticePage.tsx` — input mode layout
- Wrap the practice screen's scrollable content in a container with `pb-[calc(112px+env(safe-area-inset-bottom))]` so content doesn't hide behind the fixed submit bar.
- Move the OK/Submit action out of `MathKeypad` when `config.mode === 'input'`. Render the keypad with `variant="numeric-only"` (new flag `hideOk`) — no OK key inside the grid.
- Add a new fixed submit bar directly on the page:
  - `position: fixed; left: 0; right: 0; bottom: 0;`
  - Padding: `pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 px-4`
  - Backdrop: `glass` + top border, so it reads above the keypad visually.
  - Inside: single centered `<button>` — width `min(360px, 100% - 32px)`, `min-height: 56px`, `min-width: 180px`, rounded-2xl, gradient-primary, text "Submit".
  - Uses `mx-auto`, `flex justify-center`, no width/margin animations. Only `transform: scale` on `whileTap`, plus a static box-shadow "glow". No `translateX`, no width transition.
- Wire click to the existing `handleAnswer(inputValue.trim())`.
- Trig text input path (line ~1043) also uses this same fixed submit bar (currently has no visible submit button at all — Enter key only).

### 2. Debounce + double-tap guard
- Add a `submitLockRef` (useRef). On submit tap:
  1. If locked or `feedback` truthy → ignore.
  2. Set lock true, call `handleAnswer(...)`.
  3. `setTimeout(() => submitLockRef.current = false, 300)`.
- Disabled state visual: `opacity-60 pointer-events-none` when locked or feedback shown. No layout change (same height/width).

### 3. Auto-submit when input becomes correct
- Existing effect at line ~605 already auto-submits when `isLikelyComplete(inputValue)` and value matches. Wrap the eval in a 150ms `setTimeout` so the user briefly sees their completed input before it flies away. Clear timeout on `inputValue` change / unmount to prevent stale submits.

### 4. Keypad — remove OK from grid
- `src/components/MathKeypad.tsx`: accept optional `hideOk?: boolean`. When true, drop the last row (OK button) from `rows`. Keep everything else identical.
- Grid stays `grid-cols-3` with fixed 12px gap; no reflow.

### 5. Layout-shift prevention
- The answer preview `div` currently sizes to content (`min-h-[64px]`). Change to fixed `h-[64px]` so it never grows as the user types (text truncates with `truncate`).
- Keypad container: fixed `max-w-xs mx-auto` (already), and remove `mt-4` variability by using a static `gap-3`.
- Remove any layout-affecting `whileHover`/`whileTap` from keypad keys except `scale` (already the case).

### 6. Landscape / rotation
- Fixed submit bar with `env(safe-area-inset-bottom)` handles both orientations automatically. On landscape short viewports, keep the bar height ≤ 88px so the question stays visible; scroll content area handles overflow.

### 7. Performance
- All animations restricted to `transform` + `opacity` (compositor-only). No width/margin/flex-basis transitions.
- `will-change: transform` on the Submit button only while pressed (via framer-motion default). No CLS: preview box fixed height, submit bar fixed height, content padded to match.

## Technical details

Fixed bar element (sketch):
```text
<div class="fixed inset-x-0 bottom-0 z-40 glass border-t border-primary/20
            pt-3 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
  <motion.button
    whileTap={{ scale: 0.96 }}
    disabled={locked || !!feedback || !inputValue.trim()}
    onClick={onSubmitFixed}
    class="mx-auto block w-full max-w-[360px] min-w-[180px] h-14
           rounded-2xl gradient-primary text-primary-foreground
           font-display font-extrabold tracking-wide
           shadow-[0_0_24px_hsl(var(--primary)/0.5)]
           disabled:opacity-60">
    Submit
  </motion.button>
</div>
```

Only rendered when `config.mode === 'input'` and quiz is active (not on setup/finished screens, not in MCQ mode, not in infinite-mode result summary which already has its own Submit at line 869).

## Out of scope
- No changes to MCQ option tiles.
- No changes to backend, sync, XP, or scoring.
- No changes to the setup screen or infinite-mode summary submit.
