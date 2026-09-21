# Fix: number key stays highlighted after tapping

## Problem

On the typing keypad, tapping a number (e.g. 5) leaves a blue outline on that key. It only clears when another key is tapped, which then keeps the highlight. On phones the "hover" look sticks after a touch instead of disappearing.

## What changes

- Keypad keys stop showing the hover/focus outline on touch devices; the highlight only appears on devices with a real mouse pointer.
- Each key releases focus right after the tap, so no key stays lit.
- Keep the existing press animation (quick shrink) so taps still feel responsive.

Nothing else changes: same layout, same keys, same answer behaviour.

## Technical notes

- `src/components/MathKeypad.tsx`: change `hover:border-primary`/`hover:border-primary/60` classes to `@media (hover: hover)` variants (Tailwind `[@media(hover:hover)]:hover:...`), add `focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60`, and blur the button (`e.currentTarget.blur()`) inside the click handler.
- No logic, scoring, or quiz changes.
