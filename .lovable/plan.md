# Desktop Mode: Pro Workspace Polish

Desktop mode keeps the same bottom bar and the same app behaviour — it just looks and works like a proper desktop tool.

## 1. Stats side panel (desktop only)
- On the right side of the wide frame, a fixed panel showing:
  - Level and XP progress
  - Current streak and best streak
  - Today's accuracy and questions answered
  - Quick shortcuts: jump to Tables, Squares, Roots, Percentage practice
- Panel appears only in desktop mode on wide screens; mobile layout is untouched.
- Main content sits in the centre column, width-capped for comfortable reading.

## 2. Denser pro spacing
- Tighter padding and slightly sharper corners in desktop mode.
- Numbers use tabular/monospace figures so stats and scores stay aligned.
- Thinner hairline separators, calmer glass, sharper headings.
- Bottom bar becomes a slimmer, centred pill floating above the content.

## 3. Keyboard shortcuts
- `1` / `2` / `3` — switch to Learn / Practice / Progress
- `Enter` — submit the current answer
- `Esc` — go back / close overlays
- `?` — shortcut cheat-sheet overlay
- Shortcuts ignored while typing in a text field; enabled in desktop mode.

## 4. Command palette (Ctrl+K / Cmd+K)
- Search box listing every topic, practice mode and page.
- Type to filter, arrow keys to move, Enter to jump there.
- Also includes actions: toggle theme, toggle Pro tables mode, open settings.

## Technical notes
- New components: `DesktopStatsPanel.tsx`, `CommandPalette.tsx` (built on the existing shadcn `command` dialog), `ShortcutsHelp.tsx`.
- New hook `useDesktopMode()` reading the existing `desktop-mode` class/localStorage so components react to the toggle.
- Desktop layout handled in `src/index.css` under `html.desktop-mode` plus a grid wrapper in `Index.tsx`; the 16:9 frame rules stay as they are.
- Shortcuts registered in one `useKeyboardShortcuts` hook in `Index.tsx`; Enter-to-submit reuses the existing submit handler in `PracticePage`.
- Data comes from existing `progress`, `streak`, `xp` and `analytics` libs — no schema or business-logic changes.
