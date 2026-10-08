# Global premium font system

## Outcome
Extend the existing font setting into a compact, persistent, locally bundled font selector that updates the whole app immediately without changing layout, quiz behavior, themes, or mathematical rendering.

## Work
1. Keep the existing whitelist, settings storage, and global CSS variable as the sole font source of truth; retain current choices and add a small set of distinct, locally bundled sans-serif options suitable for a math-learning app.
2. Add concise real-font previews and a clear selected state to Settings. Persist choices through existing settings and apply changes without reload; keep font selection independent of theme and light/dark mode.
3. Ensure global typography covers inherited text and explicit utility overrides, while preserving KaTeX’s specialized formula fonts and safe system fallbacks for symbols.
4. Verify registry/settings behavior, locally bundled assets, live font changes, persistence, and representative mathematical text; inspect available build diagnostics and address only blockers that prevent validation.

## Technical details
- Add only the locally bundled font packages required for the chosen options and import only needed weights; do not use remote font URLs or stored CSS strings.
- Keep identifiers and family mappings in `src/lib/font.ts`; use the existing `math-app-settings-v1` preference and `--app-font` token.
- Do not redesign Settings, change typography sizes, or alter themes, content, formulas, navigation, or quiz logic.
