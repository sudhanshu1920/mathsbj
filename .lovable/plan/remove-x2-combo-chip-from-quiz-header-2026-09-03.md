# Remove "x2" Combo Chip from Quiz Header

## Change

Quiz/practice header मधला **🔥 xN combo chip** (लाल बॉक्स मध्ये दाखवलेला, screenshot प्रमाणे) पूर्णपणे काढून टाकणे.

- File: `src/pages/PracticePage.tsx` (lines 859–869)
- Remove the `score.correct >= 2` conditional block that renders the Flame icon + `x{score.correct}` chip
- Clean up the now-unused `Flame` import if it is not used anywhere else in the file

## Result

- Header now shows only: Back arrow, XP bar, timer, and question counter — no combo chip.
- Streak/scoring logic stays unchanged; only the visual chip is removed.
