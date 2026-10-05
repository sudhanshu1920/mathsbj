# Periodic Table — New Learning Topic + Quiz

## What you get
1. **Learning → Periodic Table card** (atom symbol, no emoji), next to existing topics.
2. **Real textbook table**: 18 groups x 7 periods, correct positions and gaps, Lanthanides/Actinides in two separate rows below. Each cell shows atomic number, symbol, name, atomic mass, colored by category (theme-aware). Mobile: smooth horizontal pan; desktop: fits the width.
3. **Element details** on tap: big symbol, name, number, mass, group, period, block, category, electron configuration, state at room temp, electronegativity, discovery year (where known). Back button / swipe returns to the table at the same scroll position.
4. **Quiz → Periodic Table category** with setup screen:
   - Multi-select topics: Atomic Number, Symbol, Element Name, Atomic Mass (at least one required)
   - Element range: Start and End, typed or picked; ascending, descending and single (21→21) all work
   - Atomic Mass: Round / Exact (shown and required only when Atomic Mass is selected); never mixed in one quiz
   - Start Quiz disabled until valid
5. **Questions** both directions (e.g. "Atomic number of Carbon?" / "Which element has atomic number 8?", "Symbol of Iron?" / "Which element has symbol Na?", mass forward/reverse), only from chosen topics and range, using the existing MCQ 2x2 grid, sounds, vibration, XP and progress.

## Technical details
- `src/data/periodicTable.ts`: single source of truth, all 118 elements (IUPAC standard masses, xpos/ypos for grid placement, category, block, config, etc.). Round figure = nearest whole number (Cl stays 35.5 as textbook convention).
- `src/components/PeriodicTableLearning.tsx` (lazy-loaded): CSS grid 18 columns, memoized cells; `ElementDetails` overlay via history state so back/swipe works and scroll is preserved.
- `src/lib/periodicQuiz.ts`: config type + fast question generator (distractors from the same range, falls back to neighbors when range is tiny).
- `PracticePage.tsx`/`PracticeModeSelector.tsx`: add `periodic` topic + setup panel; answers rendered as MCQ (text answers like names/symbols don't fit the number keypad).
- Add `Topic` union entry + `cardTints` in `LearningPage.tsx`; add data + component to `offlineReady.ts` preload list.
- No changes to existing topics, logic, navigation or themes.
