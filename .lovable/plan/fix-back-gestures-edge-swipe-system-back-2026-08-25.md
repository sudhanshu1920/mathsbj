# Fix back gestures (edge swipe + system back)

Back navigation currently has three separate problems. All three get fixed together.

## Problems

1. **Edge swipe is unreliable.** The swipe-back wrapper makes the whole screen a draggable framer-motion element. Dragging anywhere on the page starts a gesture, and the "did it start at the left edge?" check runs only at drag end, so many swipes are swallowed instead of going back.
2. **Edge swipe fights the card swiper and scrolling.** Inside Tables/Squares/Percentage detail views, the horizontal card swiper and the drag wrapper both claim the same touch, so left/right card changes and vertical scrolling get jittery.
3. **System back gets out of sync.** Going back via the in-app arrow or edge swipe changes the screen but never pops the browser history entry. The history stack keeps growing, so afterwards the phone back gesture needs several presses to move one screen, or lands on a stale screen.

## Fix

**Edge-swipe rewrite (`SwipeBack`)**
- Replace the framer-motion drag with plain touch handlers on a normal container (no drag on the whole page).
- Only begin tracking when the first touch starts within 24px of the left edge; otherwise ignore the gesture entirely so the card swiper and scrolling behave exactly as before.
- Lock the axis on first movement: horizontal continues as a back gesture, vertical cancels it and lets the page scroll.
- Trigger back on either distance (> 70px) or a fast flick, with a subtle translate-follow while dragging so the gesture feels responsive.
- Never fire while a touch started inside the horizontal card swiper.

**One shared back action**
- Route the header back arrow and the edge swipe through the same handler that the system back uses, so all three take exactly one step.
- That handler calls `history.back()` instead of mutating screen state directly; the existing popstate logic in the home shell then performs the step and keeps the history stack balanced.
- Keep the existing double-back-to-exit behaviour at the home screen, and keep the practice session's own exit confirmation intact.

**Sync guard**
- Keep depth tracking as the single source of truth so a state change caused by popstate never pushes a new history entry (fixes the "back needs several presses" symptom).

## Files touched
- `src/components/SwipeBack.tsx` — rewritten with touch-based edge detection.
- `src/pages/Index.tsx` — expose a single `goBack` (history-based) helper to children.
- `src/pages/LearningPage.tsx` — header back buttons and swipe-back use that shared helper.
- `src/components/SwipeContainer.tsx` — mark itself so edge swipes started inside it are ignored.

## Verification
- Manual pass in the preview at mobile width: tables detail, ranges, percentage group/expanded, formulas nesting, progress tab, practice setup — each back gesture moves exactly one step, and the card swiper plus vertical scroll stay smooth.
