# Fix: Submit Button Drifts Right During Quiz (Input Mode)

## Root cause

The fixed Submit bar in `PracticePage.tsx` (line 1064-1085) is rendered **inside** the `SwipeBack` wrapper. `SwipeBack.tsx` uses a framer-motion `motion.div` with `drag="x"` and `dragElastic={{ right: 0.3 }}`.

Two problems come from this:

1. A CSS rule: `position: fixed` inside any ancestor that has a `transform` is no longer fixed to the viewport — it becomes fixed to that transformed ancestor. As soon as framer applies even a tiny `translateX` to the SwipeBack container, the Submit bar moves with it.
2. Every tap/drag on the keypad that has a slight horizontal component gets picked up by the container's `drag="x"` (with right-elastic 0.3), nudging the container — and the Submit button — rightward, little by little while solving questions.

So the button is not broken itself; its parent container is being dragged.

## Fix

In `src/pages/PracticePage.tsx`:

- Move the fixed Submit bar (`config.mode === 'input' && !finished` block) **outside** the `SwipeBack` component, so it is never inside a transformed/draggable ancestor:
  ```text
  <>
    <SwipeBack onBack={handleExitRequest}>
      <div className="pb-[...]"> ...question content... </div>
    </SwipeBack>
    {fixed Submit bar}
  </>
  ```
- Harden `SwipeBack` so casual horizontal micro-drags from keypad taps cannot shift the content:
  - Only start the drag when the touch begins within 40px of the left edge (record `startX` in `onDragStart`; if not from the edge, treat the drag as inactive / cancel it via `dragControls` or by checking in `onDragEnd` plus zeroing elastic for non-edge starts).
  - Simplest robust approach: keep the drag listener but reset `x` to 0 immediately on any drag that did not start from the edge, so content (and nothing inside it) ever stays offset.

## Result

- Submit button stays perfectly fixed at bottom-center the entire quiz, no sideways drift, no jumping.
- Edge-swipe back gesture still works exactly as before (left-edge swipe exits the quiz).

## Files touched

- `src/pages/PracticePage.tsx` — move fixed Submit bar outside `SwipeBack`
- `src/components/SwipeBack.tsx` — ignore/reset non-edge drags
