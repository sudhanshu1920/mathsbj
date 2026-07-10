# Tables → Pro Mode Toggle (Grid + Practice)

Add a **PRO** toggle at the top of the Tables number grid (1–200). When ON:
- Table detail view shows `n×1 … n×20` (instead of `n×1 … n×10`)
- Practice for Tables generates questions up to `×20` (instead of `×10`)

## Where the toggle appears

- On the Tables entry screen (the 1–200 number grid), placed right under the header, above the "Select a number (1–200)" hint.
- Not shown on other topics.

## UI

- Small pill row: `[ PRO MODE ]` label with a `Crown` icon (lucide-react) + a `Switch` (existing shadcn component).
- Active: `gradient-primary` glow, subtle "×1–20" caption underneath.
- Inactive: `glass-panel` outline, "×1–10" caption.

## State & persistence

- `localStorage` key `tables-pro-mode` (boolean).
- Small helper in `src/lib/settings.ts`: `getTablesProMode()` / `setTablesProMode(v)` firing a `tables-pro-updated` window event so both LearningPage and PracticePage react instantly.

## File changes

1. **`src/lib/settings.ts`** — add `getTablesProMode` / `setTablesProMode`.

2. **`src/pages/LearningPage.tsx`**
   - Read `proMode` via `useState` + subscribe to `tables-pro-updated` and `storage` events.
   - In the Tables grid branch (around line 178), render the toggle row.
   - In the Table detail branch (around line 160), pass `proMode ? 20 : 10` to `getTable(n, max)`.
   - In `handlePracticeSelect`, when `activeTopic === 'tables'`, attach `ctx.to = proMode ? 20 : 10` so PracticePage knows the range.

3. **`src/pages/PracticePage.tsx`** (Tables question generation)
   - Where table questions are generated for a chosen number, use `ctx.to ?? 10` as the max multiplier (fallback preserves existing behavior).
   - If Tables practice is launched without a specific number (all-tables mode), also read `getTablesProMode()` to decide max.

## Technical notes

- `getTable(num, max=10)` already accepts the extended range — no change needed in `src/lib/mathData.ts`.
- Toggle is scoped to Tables only; Squares/Cubes/Powers/etc. are untouched.
- No backend or theme changes.

## Out of scope

- Changing the 1–200 grid size.
- Pro toggles for other topics (can be added later using the same pattern).
