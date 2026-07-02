# Full-Screen Settings

Currently the Settings icon on the Progress page opens `SettingsPanel` inside a small centered `Dialog` (max-width 340px). Change it so the settings open as a full-screen view that respects the current layout mode (mobile or desktop).

## Changes

**`src/pages/ProgressPage.tsx`**
- Remove the `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` imports and wrapper around `<SettingsPanel />`.
- Replace with a full-screen overlay rendered when `showSettings` is `true`:
  - `fixed inset-0 z-50 bg-background` so it covers the whole viewport (including behind the bottom nav).
  - Framer Motion fade/slide-in for a smooth open/close.
  - Top bar with a back arrow (`ArrowLeft` from lucide) and a "Settings" title. Back button sets `showSettings(false)`.
  - Scrollable content area containing `<SettingsPanel />` with comfortable padding.
- Because the overlay uses viewport units, it automatically matches the current layout:
  - Mobile layout → covers the phone frame edge-to-edge.
  - Desktop mode (`html.desktop-mode`) → covers the desktop-sized frame, and the inner content is centered with a `max-w-3xl mx-auto` wrapper so it looks like a proper desktop settings page instead of a stretched mobile panel.
- Lock body scroll while open (`document.body.style.overflow = 'hidden'` in a `useEffect` tied to `showSettings`) and restore on close.
- Also close on `Escape` key.

**No other files need changes.** `SettingsPanel` itself is unchanged — it just renders inside the new full-screen container instead of a dialog.

## Out of scope
- No changes to theme logic, settings content, or the accuracy ring.
- No routing changes (still opens in place, not a new URL).
