# Duolingo-Style Redesign Plan

A full visual overhaul of every screen in the app, inspired by Duolingo's friendly, gamified UI — using a purple-led palette, a custom math mascot, chunky 3D buttons/cards, and big rounded geometry. All existing functionality (learning, quiz, practice, progress, settings, auth, themes, offline) stays intact.

## Look & Feel

- **Palette (locked):** Purple `#8B5CF6` primary, lavender `#A78BFA` secondary, green `#58CC02` for correct/success, amber `#FFC800` for streaks/XP, plus Duolingo's signature red `#FF4B4B` for wrong/lives.
- **Typography:** Heavy display font (Nunito/DIN Round-style) for headings and big numbers, friendly rounded sans for body.
- **Components:** Chunky cards with bottom shadow ("pressable 3D button" effect), 2xl rounded corners, thick borders, generous padding, playful micro-animations on press.
- **Mascot:** A friendly math character (owl-like, holding a chalkboard / abacus). Appears on home, lesson intro, correct/wrong feedback, streak screens, and empty states with speech bubbles.

## Screens to Redesign

```text
Welcome / Auth    → Mascot hero, big purple CTA, "Continue as guest" pill
Home (Index)      → Top bar: streak 🔥 | XP 💎 | hearts ❤️
                    Restyled topic grid: chunky 3D pressable cards, icon + title + progress ring
                    Mascot bubble suggesting next lesson
Learning          → Lesson card stack, chunky "CONTINUE" button, mascot reactions
Quiz Mode         → Big question card, tappable answer pills, green flash on correct,
                    red shake on wrong, mascot pop-in feedback, hearts deplete on wrong
Practice          → Restyled math keypad (chunky keys), stacked fraction kept, combo counter
Result Screens    → Big mascot, XP earned counter, streak ring, "LESSON COMPLETE!" banner
Progress          → Stat tiles (streak, XP, accuracy, time), achievement badges row,
                    weekly chart with purple/green theme
Settings          → Same sections, restyled rows (chunky toggles, themed swatches)
Bottom Nav        → Pill-shaped, big icons, active state with purple bubble + label
```

## Technical Approach

1. **Theme tokens (`src/index.css`)** — Add a new default `theme-duo-purple`:
   - `--primary 262 83% 58%`, `--accent 142 76% 47%`, `--warning 45 100% 50%`, `--destructive 0 100% 65%`.
   - New `--shadow-chunky` token (e.g. `0 4px 0 0 hsl(var(--primary) / 0.6)`) for the 3D button look.
   - Add Nunito + Inter via Google Fonts; map `font-display` → Nunito, `font-body` → Inter in `tailwind.config.ts`.
   - Make Duo Purple the default theme in `src/lib/theme.ts` (keep the other premium themes available in Settings).
2. **New shared components** under `src/components/duo/`:
   - `ChunkyCard.tsx` (3D-shadow card)
   - `ChunkyButton.tsx` (pressable button with `active:translate-y-1` and shadow collapse)
   - `Mascot.tsx` (SVG mascot, expression prop: `happy | thinking | sad | celebrating`)
   - `MascotBubble.tsx` (mascot + speech bubble)
   - `StatPill.tsx` (streak/XP/hearts pills for the top bar)
   - `ProgressRing.tsx` (used on topic cards)
3. **Mascot asset** — Generate a friendly purple owl-with-abacus SVG (kept inline so it themes via `currentColor` and works offline). 3–4 expression variants.
4. **Refactor existing components** to use the new primitives without changing logic:
   - `TopicCard.tsx`, `BottomNav.tsx`, `XPBar.tsx`, `MathKeypad.tsx`, `PracticeModeSelector.tsx`, `SettingsPanel.tsx`, `UserMenu.tsx`, `PercentageLearning.tsx`, `FormulasLearning.tsx`, `TrigonometryLearning.tsx`.
   - Pages: `Index.tsx`, `LearningPage.tsx`, `PracticePage.tsx`, `ProgressPage.tsx`, `WelcomePage.tsx`, `AuthPage.tsx`.
5. **Feedback animations** — Reuse existing keyframes (`anim-shake`, `anim-flash-success`, `anim-pulse-card`) and add a mascot bounce/`scale-in` on correct.
6. **Bottom nav** — Convert to pill style, active item shows a filled purple bubble behind the icon with the label underneath.
7. **Top status bar** — Add the streak/XP/hearts row to `Index.tsx` and key screens (reads from existing `streak.ts`, `xp.ts`, and a new in-memory `hearts` value persisted to localStorage).

## What stays the same

- All data, formulas, quiz logic, practice math, offline storage, auth, Supabase wiring.
- The premium theme switcher — Duo Purple just becomes the new default; users can still pick Glass Matte, Golden Prime, Neon Core, etc.
- Routes and component APIs (props unchanged where possible).

## Out of scope (ask if you want them later)

- Replacing the topic grid with a winding lesson path (you chose "keep grid, restyle").
- Hearts/lives gating actual gameplay (visual only unless you want enforcement).
- Sound pack changes.
