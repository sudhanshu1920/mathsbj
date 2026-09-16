# Fix: Text-size controls after holding the Desktop button

## Problem
Holding the desktop/mobile button opens a small text-size popup (− 100% +), but it is hard to see: it is tiny, low contrast, sits half-hidden behind the app frame edge, and disappears after 3 seconds.

## Fix
1. **Show it above everything**
   - Render the popup at the top level of the page instead of inside the scrolling area, so the app frame can no longer cut it off.
   - Keep it anchored just under the button, nudged inward so it never touches the screen edge.

2. **Make it clearly visible**
   - Larger panel with solid background, stronger border and shadow.
   - Bigger − and + buttons (comfortable 44px tap size) and a larger, bolder percentage label.
   - Add a short "Text size" caption so its purpose is obvious.

3. **Better behaviour**
   - Stays open while the user keeps tapping; auto-closes after 5 seconds of no interaction.
   - Tapping anywhere outside or pressing Escape closes it.
   - Gentle fade/scale in, same as now.

Nothing else changes: the button still toggles mobile/desktop layout on a normal tap, and the saved text size keeps working as before.

## Technical notes
- Changes limited to `src/components/DesktopModeToggle.tsx`.
- Use a portal (`createPortal`) with fixed positioning computed from the button's bounding rect, so `overflow: hidden` on `.app-frame` cannot clip it.
- Reposition on scroll/resize while open; outside-click and Escape listeners added only while open.
