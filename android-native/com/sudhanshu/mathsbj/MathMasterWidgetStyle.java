package com.sudhanshu.mathsbj;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;

/**
 * Math Master native-widget visual system.
 *
 * Keeps palette resolution, contrast protection, surface opacity, and font mapping
 * in one place so every RemoteViews composition renders the same design language.
 */
public final class MathMasterWidgetStyle {
    public static final String DEFAULT_THEME = "deep_navy";
    public static final String DEFAULT_SURFACE = "translucent";
    public static final String DEFAULT_FONT = "medium";
    public static final int DEFAULT_OPACITY = 84;

    private MathMasterWidgetStyle() {}

    public static final class Palette {
        public final int background;
        public final int primary;
        public final int secondary;
        public final int highlight;
        public final int accent;
        public final int outline;

        private Palette(int background, int primary, int secondary, int highlight, int accent, int outline) {
            this.background = background;
            this.primary = primary;
            this.secondary = secondary;
            this.highlight = highlight;
            this.accent = accent;
            this.outline = outline;
        }
    }

    public static String normalizeTheme(String theme) {
        if (theme == null) return DEFAULT_THEME;
        switch (theme) {
            case "app":
            case "system":
            case "dynamic":
                return "system";
            case "random":
                return DEFAULT_THEME;
            // Preserve old per-widget selections while moving them to the unified palette.
            case "emerald": return "cockpit";
            case "ocean": return "snowfall";
            case "graphite": return "monochrome";
            case "rose": return "sunset";
            case "violet": return "deep_navy";
            case "sapphire": return "neon";
            case "aurora": return "cockpit";
            case "minimal":
            case "neon":
            case "cockpit":
            case "sunset":
            case "monochrome":
            case "snowfall":
            case "deep_navy":
            case "custom":
                return theme;
            default:
                return DEFAULT_THEME;
        }
    }

    public static int defaultOpacity(String theme) {
        switch (normalizeTheme(theme)) {
            case "minimal": return 0;
            case "neon": return 95;
            case "cockpit": return 90;
            case "sunset": return 70;
            case "monochrome": return 50;
            case "snowfall": return 60;
            case "system": return 76;
            case "custom": return 82;
            default: return DEFAULT_OPACITY;
        }
    }

    public static int resolveOpacity(String surfaceStyle, int opacity, String theme) {
        if ("transparent".equals(surfaceStyle)) return 0;
        if ("solid".equals(surfaceStyle)) return 100;
        int fallback = defaultOpacity(theme);
        return Math.max(0, Math.min(100, opacity < 0 ? fallback : opacity));
    }

    public static Palette resolvePalette(
        Context context,
        String themeValue,
        boolean lightMode,
        String customPrimary,
        String customSecondary,
        String customAccent,
        String customBackground,
        String customOutline
    ) {
        String theme = normalizeTheme(themeValue);
        int background;
        int primary;
        int secondary;
        int highlight;
        int accent;
        int outline;

        switch (theme) {
            case "minimal":
                background = Color.parseColor("#111B30");
                primary = Color.parseColor("#FFFFFF");
                secondary = Color.parseColor("#C8C8C8");
                highlight = Color.parseColor("#B4B4BE");
                accent = Color.parseColor("#FFFFFF");
                outline = Color.parseColor("#AEBBD2");
                break;
            case "neon":
                background = Color.parseColor("#0A0A14");
                primary = Color.parseColor("#00FFFF");
                secondary = Color.parseColor("#00C8C8");
                highlight = Color.parseColor("#FF00B4");
                accent = Color.parseColor("#00FFFF");
                outline = Color.parseColor("#00C8FF");
                break;
            case "cockpit":
                background = Color.parseColor("#050F05");
                primary = Color.parseColor("#00FF41");
                secondary = Color.parseColor("#00B432");
                highlight = Color.parseColor("#00C850");
                accent = Color.parseColor("#00FF41");
                outline = Color.parseColor("#007828");
                break;
            case "sunset":
                background = Color.parseColor("#1E0F08");
                primary = Color.parseColor("#FFB432");
                secondary = Color.parseColor("#E68C3C");
                highlight = Color.parseColor("#FF7832");
                accent = Color.parseColor("#FFB432");
                outline = Color.parseColor("#C86A2F");
                break;
            case "monochrome":
                background = Color.parseColor("#191919");
                primary = Color.parseColor("#F0F0F0");
                secondary = Color.parseColor("#AAAAAA");
                highlight = Color.parseColor("#C8C8C8");
                accent = Color.parseColor("#F0F0F0");
                outline = Color.parseColor("#646464");
                break;
            case "snowfall":
                background = Color.parseColor("#0A1428");
                primary = Color.parseColor("#B4DCFF");
                secondary = Color.parseColor("#82B4E6");
                highlight = Color.parseColor("#A8CFFF");
                accent = Color.parseColor("#64AAFF");
                outline = Color.parseColor("#527DA8");
                break;
            case "custom":
                background = parseHex(customBackground, Color.parseColor("#111B30"));
                primary = parseHex(customPrimary, Color.parseColor("#F5F7FF"));
                secondary = parseHex(customSecondary, Color.parseColor("#AEBBD2"));
                highlight = secondary;
                accent = parseHex(customAccent, Color.parseColor("#8FAEFF"));
                outline = parseHex(customOutline, Color.parseColor("#60749D"));
                break;
            case "system":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    background = context.getColor(lightMode ? android.R.color.system_neutral1_50 : android.R.color.system_neutral1_900);
                    primary = context.getColor(lightMode ? android.R.color.system_neutral1_900 : android.R.color.system_neutral1_50);
                    secondary = context.getColor(lightMode ? android.R.color.system_neutral2_700 : android.R.color.system_neutral2_200);
                    highlight = context.getColor(lightMode ? android.R.color.system_accent2_800 : android.R.color.system_accent2_200);
                    accent = context.getColor(lightMode ? android.R.color.system_accent1_700 : android.R.color.system_accent1_200);
                    outline = context.getColor(lightMode ? android.R.color.system_accent1_400 : android.R.color.system_accent1_300);
                } else {
                    background = lightMode ? Color.parseColor("#F1F4FA") : Color.parseColor("#20283A");
                    primary = lightMode ? Color.parseColor("#1C2434") : Color.parseColor("#F4F7FF");
                    secondary = lightMode ? Color.parseColor("#526078") : Color.parseColor("#B7C2D8");
                    highlight = Color.parseColor("#93A8D8");
                    accent = Color.parseColor("#8FAEFF");
                    outline = Color.parseColor("#7186B4");
                }
                break;
            case "deep_navy":
            default:
                background = Color.parseColor("#111B30");
                primary = Color.parseColor("#F5F7FF");
                secondary = Color.parseColor("#AEBBD2");
                highlight = Color.parseColor("#FFC15A");
                accent = Color.parseColor("#8FAEFF");
                outline = Color.parseColor("#60749D");
                break;
        }

        // Provide a readable light-surface variant without mutating the stored preset.
        if (lightMode && !"system".equals(theme) && !"custom".equals(theme)) {
            background = blend(background, Color.WHITE, 0.88f);
            primary = Color.parseColor("#202A3D");
            secondary = Color.parseColor("#526078");
            highlight = ensureContrast(highlight, background, 3.0);
            accent = ensureContrast(accent, background, 3.0);
            outline = blend(outline, Color.WHITE, 0.18f);
        }

        primary = ensureContrast(primary, background, 4.5);
        secondary = ensureContrast(secondary, background, 3.0);
        highlight = ensureContrast(highlight, background, 3.0);
        accent = ensureContrast(accent, background, 3.0);
        return new Palette(background, primary, secondary, highlight, accent, outline);
    }

    public static int surfaceColor(Palette palette, String surfaceStyle, int opacity, String theme) {
        int percent = resolveOpacity(surfaceStyle, opacity, theme);
        return Color.argb(
            Math.round(Color.alpha(palette.background) * (percent / 100f)),
            Color.red(palette.background),
            Color.green(palette.background),
            Color.blue(palette.background)
        );
    }

    public static int parseHex(String value, int fallback) {
        if (value == null || !value.matches("#[0-9A-Fa-f]{6}")) return fallback;
        try { return Color.parseColor(value); }
        catch (IllegalArgumentException ignored) { return fallback; }
    }

    public static String normalizeFont(String font) {
        if (font == null) return DEFAULT_FONT;
        switch (font) {
            case "default": case "serif": case "monospace": case "cursive":
            case "condensed": case "condensed_light": case "light": case "medium":
            case "black": case "thin": case "small_caps":
                return font;
            default: return DEFAULT_FONT;
        }
    }

    public static Typeface typeface(String font) {
        switch (normalizeFont(font)) {
            case "serif": return Typeface.create("serif", Typeface.NORMAL);
            case "monospace": return Typeface.create("monospace", Typeface.NORMAL);
            case "cursive": return Typeface.create("cursive", Typeface.NORMAL);
            case "condensed": return Typeface.create("sans-serif-condensed", Typeface.BOLD);
            case "condensed_light": return Typeface.create("sans-serif-condensed-light", Typeface.NORMAL);
            case "light": return Typeface.create("sans-serif-light", Typeface.NORMAL);
            case "medium": return Typeface.create("sans-serif-medium", Typeface.NORMAL);
            case "black": return Typeface.create("sans-serif-black", Typeface.NORMAL);
            case "thin": return Typeface.create("sans-serif-thin", Typeface.NORMAL);
            case "small_caps": return Typeface.create("sans-serif-medium", Typeface.NORMAL);
            default: return Typeface.create("sans-serif", Typeface.NORMAL);
        }
    }

    private static int ensureContrast(int foreground, int background, double minimumRatio) {
        if (contrastRatio(foreground, background) >= minimumRatio) return foreground;
        int black = Color.BLACK;
        int white = Color.WHITE;
        return contrastRatio(black, background) >= contrastRatio(white, background) ? black : white;
    }

    private static double contrastRatio(int first, int second) {
        double a = luminance(first);
        double b = luminance(second);
        return (Math.max(a, b) + 0.05d) / (Math.min(a, b) + 0.05d);
    }

    private static double luminance(int color) {
        double r = linear(Color.red(color) / 255d);
        double g = linear(Color.green(color) / 255d);
        double b = linear(Color.blue(color) / 255d);
        return 0.2126d * r + 0.7152d * g + 0.0722d * b;
    }

    private static double linear(double value) {
        return value <= 0.04045d ? value / 12.92d : Math.pow((value + 0.055d) / 1.055d, 2.4d);
    }

    private static int blend(int from, int to, float ratio) {
        float value = Math.max(0f, Math.min(1f, ratio));
        return Color.rgb(
            Math.round(Color.red(from) * (1f - value) + Color.red(to) * value),
            Math.round(Color.green(from) * (1f - value) + Color.green(to) * value),
            Math.round(Color.blue(from) * (1f - value) + Color.blue(to) * value)
        );
    }
}
