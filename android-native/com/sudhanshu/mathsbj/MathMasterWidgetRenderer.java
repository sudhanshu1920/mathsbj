package com.sudhanshu.mathsbj;

import android.graphics.Bitmap;
import android.graphics.BlurMaskFilter;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.SweepGradient;
import android.graphics.Typeface;

/**
 * Draws the "neon glass" Math Master home-screen widgets with plain Canvas calls.
 *
 * The launcher only receives one bitmap per size, so every composition looks the same on every
 * launcher and every Android version (RemoteViews cannot blur, glow or draw gradient rings).
 * Nothing here needs a Context: the provider and the configuration screen pass in live data.
 */
final class MathMasterWidgetRenderer {
    private MathMasterWidgetRenderer() {}

    static final String[] COMPOSITIONS = {
        "hero_wide", "compact_green", "square_math_bot", "medium_study",
        "square_cosmic", "extra_wide_weekly", "minimal_progress"
    };

    /** Typefaces used by the renderer. */
    static final class Fonts {
        final Typeface regular;
        final Typeface medium;
        final Typeface bold;

        Fonts(Typeface regular, Typeface medium, Typeface bold) {
            this.regular = regular;
            this.medium = medium;
            this.bold = bold;
        }

        static Fonts system() {
            return new Fonts(
                Typeface.create("sans-serif", Typeface.NORMAL),
                Typeface.create("sans-serif-medium", Typeface.NORMAL),
                Typeface.create("sans-serif", Typeface.BOLD));
        }
    }

    /** Live numbers shown by the widget. */
    static final class Data {
        int progress = 0;          // 0..100
        int elapsedMinutes = 0;
        int targetMinutes = 5;
        int remainingMinutes = 5;
        int streak = 0;
        boolean[] weekDone = new boolean[7];   // Sunday .. Saturday of the current week
        int todayIndex = 0;                    // 0 = Sunday .. 6 = Saturday
        String updateLabel = null;             // e.g. "UPDATE v1.2.3", null when none
        String[] dayLetters = { "S", "M", "T", "W", "T", "F", "S" };
        ScreenTimeSection studyAppsScreenTime;
        ScreenTimeSection deviceAppsScreenTime;
    }

    /** A real app usage row; package metadata and icon are resolved on a worker thread. */
    static final class ScreenTimeEntry {
        String packageName;
        String label;
        long usageMillis;
        float percent;
        Bitmap icon;
    }

    /** Status-aware data for one independent screen-time source. */
    static final class ScreenTimeSection {
        String title = "";
        String status = "loading";
        String periodLabel = "Today";
        long totalUsageMillis;
        long lastUpdatedAt;
        java.util.List<ScreenTimeEntry> entries = new java.util.ArrayList<>();
    }

    /** Which blocks to draw and how. */
    static final class Options {
        String composition = "hero_wide";
        String style = "neon";     // neon (reference look) | blur | transparent; anything else = neon
        int themeAccent = 0;
        boolean lightMode = false;
        boolean themeMatched = false;
        boolean enabled = true;
        boolean identity = true;
        boolean progress = true;
        boolean target = true;
        boolean remaining = false;
        boolean studyTime = false;
        boolean streak = true;
        boolean weekly = true;
        boolean quiz = true;
        boolean update = true;
        boolean studyAppsScreenTime = false;
        boolean deviceAppsScreenTime = false;
        String screenTimePeriod = "today";
        int screenTimeMaxEntries = 5;
        boolean screenTimeShowTotal = true;
        boolean screenTimeShowUsage = true;
        boolean screenTimeShowPercent = true;
        boolean screenTimeDetailed = true;
        float textScale = 1f;
    }

    // ---------------------------------------------------------------- palettes

    private static final class Palette {
        int bg0, bg1, bg2;          // base gradient (top-left -> bottom-right)
        int blobA, blobB, blobC;    // soft aurora colours
        int borderA, borderB;       // neon outline, left -> right
        int master;                 // "MASTER" word
        int soft;                   // % sign, chevrons, small highlights
        int ring0, ring1, ring2;    // progress arc, start -> end
        int track;                  // empty part of the ring
        int bar0, bar1;             // progress bar
        int glow;                   // glow behind ring / border
    }

    private static int argb(int a, int r, int g, int b) { return Color.argb(a, r, g, b); }

    private static int withAlpha(int c, float a) {
        return Color.argb(Math.max(0, Math.min(255, Math.round(a * 255f))), Color.red(c), Color.green(c), Color.blue(c));
    }

    private static int mix(int c0, int c1, float t) {
        t = Math.max(0f, Math.min(1f, t));
        return Color.argb(
            Math.round(Color.alpha(c0) + (Color.alpha(c1) - Color.alpha(c0)) * t),
            Math.round(Color.red(c0) + (Color.red(c1) - Color.red(c0)) * t),
            Math.round(Color.green(c0) + (Color.green(c1) - Color.green(c0)) * t),
            Math.round(Color.blue(c0) + (Color.blue(c1) - Color.blue(c0)) * t));
    }

    private static int hex(String s) { return Color.parseColor(s); }

    private static Palette paletteFor(String composition, int themeAccent, boolean lightMode, boolean themeMatched) {
        Palette p = new Palette();
        // Shared arc / bar colours: bright green start, cyan middle, bright blue-cyan end.
        p.ring0 = hex("#4FF27C");
        p.ring1 = hex("#17EBCB");
        p.ring2 = hex("#1AC4F6");
        p.bar0 = hex("#3DF08A");
        p.bar1 = hex("#12E5F0");
        p.master = hex("#2FE6F5");
        p.soft = hex("#6DF0E2");
        p.track = withAlpha(hex("#2A7BFF"), 0.30f);
        p.glow = hex("#18C8FF");
        switch (composition) {
            case "compact_green":
                p.bg0 = hex("#021E18"); p.bg1 = hex("#04291F"); p.bg2 = hex("#021710");
                p.blobA = withAlpha(hex("#14C79A"), 0.20f); p.blobB = withAlpha(hex("#2FE08B"), 0.16f); p.blobC = withAlpha(hex("#13A9B8"), 0.12f);
                p.borderA = hex("#14D6A4"); p.borderB = hex("#5EDDB2");
                p.track = withAlpha(hex("#1AD7B0"), 0.26f);
                p.glow = hex("#16E0A8");
                break;
            case "square_math_bot":
                p.bg0 = hex("#0B0D3E"); p.bg1 = hex("#110F55"); p.bg2 = hex("#190C45");
                p.blobA = withAlpha(hex("#3F66FF"), 0.26f); p.blobB = withAlpha(hex("#C73DD0"), 0.34f); p.blobC = withAlpha(hex("#7C4DFF"), 0.22f);
                p.borderA = hex("#6F6CFF"); p.borderB = hex("#F473E8");
                p.glow = hex("#B060FF");
                p.track = withAlpha(hex("#3C6CFF"), 0.34f);
                break;
            case "medium_study":
                p.bg0 = hex("#180A44"); p.bg1 = hex("#220A4A"); p.bg2 = hex("#320A40");
                p.blobA = withAlpha(hex("#7B3DFF"), 0.28f); p.blobB = withAlpha(hex("#EC3AA8"), 0.38f); p.blobC = withAlpha(hex("#FF8A5C"), 0.10f);
                p.borderA = hex("#9D58E8"); p.borderB = hex("#FF6AD5");
                p.master = hex("#FFA6E6"); p.soft = hex("#FFC2EE");
                p.glow = hex("#FF5CD0");
                p.track = withAlpha(hex("#5B7BFF"), 0.30f);
                break;
            case "square_cosmic":
                p.bg0 = hex("#031B47"); p.bg1 = hex("#042760"); p.bg2 = hex("#04173F");
                p.blobA = withAlpha(hex("#1CA0FF"), 0.22f); p.blobB = withAlpha(hex("#4C7CFF"), 0.20f); p.blobC = withAlpha(hex("#12D6E0"), 0.10f);
                p.borderA = hex("#1F9BF2"); p.borderB = hex("#5683F6");
                p.track = withAlpha(hex("#2A7BFF"), 0.30f);
                break;
            case "extra_wide_weekly":
                p.bg0 = hex("#032A55"); p.bg1 = hex("#044680"); p.bg2 = hex("#032647");
                p.blobA = withAlpha(hex("#18B8E8"), 0.26f); p.blobB = withAlpha(hex("#1E8CFF"), 0.22f); p.blobC = withAlpha(hex("#37D6B4"), 0.12f);
                p.borderA = hex("#1FC4EA"); p.borderB = hex("#7FDDF6");
                break;
            case "minimal_progress":
                p.bg0 = hex("#032A21"); p.bg1 = hex("#04423A"); p.bg2 = hex("#032720");
                p.blobA = withAlpha(hex("#14C690"), 0.20f); p.blobB = withAlpha(hex("#28E088"), 0.14f); p.blobC = withAlpha(hex("#0E9F8A"), 0.12f);
                p.borderA = hex("#16C490"); p.borderB = hex("#3FD8A6");
                p.master = Color.WHITE;
                p.track = withAlpha(hex("#1AD7B0"), 0.26f);
                p.glow = hex("#16E0A8");
                break;
            case "hero_wide":
            default:
                p.bg0 = hex("#03163A"); p.bg1 = hex("#042358"); p.bg2 = hex("#091242");
                p.blobA = withAlpha(hex("#2C7DFF"), 0.22f); p.blobB = withAlpha(hex("#8D5CF2"), 0.34f); p.blobC = withAlpha(hex("#FF9E52"), 0.10f);
                p.borderA = hex("#1A9CF0"); p.borderB = hex("#C58EFB");
                break;
        }
        if (themeMatched) applyAccent(p, themeAccent, lightMode);
        return p;
    }

    /** Re-tints a palette from one accent colour (the Settings colour themes). */
    private static void applyAccent(Palette p, int accent, boolean lightMode) {
        if (lightMode) {
            p.bg0 = mix(Color.WHITE, accent, 0.075f);
            p.bg1 = mix(Color.WHITE, accent, 0.025f);
            p.bg2 = mix(Color.WHITE, accent, 0.12f);
            p.blobA = withAlpha(accent, 0.10f);
            p.blobB = withAlpha(mix(accent, Color.WHITE, 0.35f), 0.14f);
            p.blobC = withAlpha(mix(accent, hex("#64748B"), 0.35f), 0.09f);
            p.borderA = mix(accent, Color.WHITE, 0.18f);
            p.borderB = mix(accent, Color.BLACK, 0.15f);
            p.master = mix(accent, Color.BLACK, 0.12f);
            p.soft = mix(accent, Color.BLACK, 0.28f);
            p.ring0 = mix(accent, Color.WHITE, 0.24f);
            p.ring1 = accent;
            p.ring2 = mix(accent, hex("#2563EB"), 0.36f);
            p.track = withAlpha(accent, 0.15f);
            p.bar0 = p.ring0;
            p.bar1 = accent;
            p.glow = withAlpha(accent, 0.46f);
            return;
        }
        int ink = hex("#05070F");
        p.bg0 = mix(ink, accent, 0.13f);
        p.bg1 = mix(ink, accent, 0.24f);
        p.bg2 = mix(ink, accent, 0.10f);
        p.blobA = withAlpha(accent, 0.24f);
        p.blobB = withAlpha(mix(accent, Color.WHITE, 0.25f), 0.22f);
        p.blobC = withAlpha(mix(accent, hex("#6A5CFF"), 0.5f), 0.22f);
        p.borderA = mix(accent, Color.WHITE, 0.05f);
        p.borderB = mix(accent, Color.WHITE, 0.55f);
        p.master = mix(accent, Color.WHITE, 0.25f);
        p.soft = mix(accent, Color.WHITE, 0.45f);
        p.ring0 = mix(accent, Color.WHITE, 0.45f);
        p.ring1 = accent;
        p.ring2 = mix(accent, hex("#2C5CFF"), 0.45f);
        p.track = withAlpha(accent, 0.26f);
        p.bar0 = p.ring0;
        p.bar1 = accent;
        p.glow = accent;
    }

    private static void applyScreenTimePalette(Palette p, int themeAccent, boolean themeMatched, boolean lightMode) {
        if (themeMatched && lightMode) {
            applyAccent(p, themeAccent, true);
            return;
        }
        p.bg0 = hex("#031B16");
        p.bg1 = hex("#042720");
        p.bg2 = hex("#01120F");
        p.blobA = withAlpha(hex("#16D99E"), 0.20f);
        p.blobB = withAlpha(hex("#25E9B0"), 0.15f);
        p.blobC = withAlpha(themeMatched ? themeAccent : hex("#20C9D8"), 0.10f);
        p.borderA = hex("#30E9AA");
        p.borderB = hex("#4BEBD7");
        p.master = mix(hex("#A9FFE2"), themeMatched ? themeAccent : hex("#A9FFE2"), 0.08f);
        p.soft = hex("#79F3D0");
        p.ring0 = hex("#41F397");
        p.ring1 = hex("#19E7B5");
        p.ring2 = hex("#20D6E4");
        p.track = withAlpha(hex("#20CFA8"), 0.25f);
        p.bar0 = hex("#39EEA0");
        p.bar1 = hex("#1AD6DF");
        p.glow = hex("#1EE9B1");
    }

    // ------------------------------------------------------------------ entry

    /** Renders one widget bitmap. widthPx/heightPx are device pixels, density is dp -> px. */
    static Bitmap render(Fonts fonts, Data data, Options options, int widthPx, int heightPx, float density) {
        int w = Math.max(48, widthPx);
        int h = Math.max(32, heightPx);
        Bitmap bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        new Scene(canvas, w, h, fonts == null ? Fonts.system() : fonts, data, options, density > 0f ? density : 2.75f).draw();
        return bitmap;
    }

    /** Picks the composition that fits a launcher size best when the user chose "auto". */
    static String autoComposition(int widthDp, int heightDp) {
        if (widthDp <= 0 || heightDp <= 0) return "hero_wide";
        float aspect = widthDp / (float) heightDp;
        if (aspect >= 3.4f) return heightDp >= 120 && aspect < 4.2f ? "hero_wide" : "extra_wide_weekly";
        if (heightDp < 100) return "minimal_progress";
        if (aspect >= 1.8f) return "hero_wide";
        if (aspect >= 1.3f) return "compact_green";
        return "square_math_bot";
    }

    // ------------------------------------------------------------------ scene

    private static final class Scene {
        final Canvas c;
        final float W, H, density;
        final Fonts f;
        final Data d;
        final Options o;
        final Palette pal;
        final boolean minimalStyle, compactStyle;   // legacy glass/compact/minimal styles now all mean neon
        final boolean translucent, clear;
        final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        final Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
        final Paint txt = new Paint(Paint.ANTI_ALIAS_FLAG);
        RectF card;
        float cardRadius;
        float tracking = 0f;
        boolean shortStreak, twoLineTarget;
        float labelRef = 20f, valueRef = 26f, numRef = 32f;   // reference text sizes (px at the reference frame)

        Scene(Canvas c, int w, int h, Fonts f, Data d, Options o, float density) {
            this.c = c; this.W = w; this.H = h; this.f = f; this.d = d; this.o = o; this.density = density;
            this.pal = paletteFor(o.composition, o.themeAccent, o.lightMode, o.themeMatched);
            if (o.studyAppsScreenTime || o.deviceAppsScreenTime) {
                applyScreenTimePalette(this.pal, o.themeAccent, o.themeMatched, o.lightMode);
            }
            this.minimalStyle = false;
            this.compactStyle = false;
            this.translucent = "blur".equals(o.style);
            this.clear = "transparent".equals(o.style);
            this.shortStreak = "square_math_bot".equals(o.composition) || "medium_study".equals(o.composition) || "minimal_progress".equals(o.composition);
            this.twoLineTarget = "square_math_bot".equals(o.composition) || "medium_study".equals(o.composition) || "extra_wide_weekly".equals(o.composition);
        }

        // ---- small helpers
        float clamp(float v, float lo, float hi) { return Math.max(lo, Math.min(hi, v)); }

        void resetPaints() {
            fill.setShader(null); fill.setMaskFilter(null); fill.setStyle(Paint.Style.FILL); fill.setColor(Color.WHITE); fill.clearShadowLayer();
            line.setShader(null); line.setMaskFilter(null); line.setStyle(Paint.Style.STROKE); line.setStrokeCap(Paint.Cap.ROUND);
            line.setStrokeJoin(Paint.Join.ROUND); line.setColor(Color.WHITE); line.setStrokeWidth(1f);
        }

        /** Draws text; shrinks it to fit maxWidth (when > 0). Returns the drawn width. */
        float text(String s, float x, float baseline, float size, Typeface tf, int color, Paint.Align align, float maxWidth) {
            if (s == null || s.length() == 0) return 0f;
            txt.setShader(null); txt.setMaskFilter(null); txt.clearShadowLayer(); txt.setStyle(Paint.Style.FILL);
            txt.setColor(ensureTextContrast(color)); txt.setTypeface(tf); txt.setTextAlign(align); txt.setLetterSpacing(tracking);
            txt.setTextSize(size);
            float w = txt.measureText(s);
            if (maxWidth > 0f && w > maxWidth) { txt.setTextSize(size * maxWidth / w); w = maxWidth; }
            c.drawText(s, x, baseline, txt);
            return w;
        }

        int ensureTextContrast(int color) {
            if (!o.themeMatched || !o.lightMode) return color;
            float luminance = (Color.red(color) * 0.299f + Color.green(color) * 0.587f + Color.blue(color) * 0.114f) / 255f;
            return luminance >= 0.82f
                ? Color.argb(Color.alpha(color), 20, 27, 44)
                : color;
        }

        float measure(String s, float size, Typeface tf) {
            txt.setTypeface(tf); txt.setTextSize(size); txt.setLetterSpacing(tracking);
            return txt.measureText(s);
        }

        RectF rect(float l, float t, float r, float b) { return new RectF(l, t, r, b); }

        Path roundPath(RectF r, float rad) {
            Path p = new Path();
            p.addRoundRect(r, rad, rad, Path.Direction.CW);
            return p;
        }

        // ---- card
        void draw() {
            resetPaints();
            float inset = Math.max(1.5f, 1.6f * density);
            card = new RectF(inset, inset, W - inset, H - inset);
            cardRadius = clamp(0.105f * card.height(), 14f * density, 30f * density);
            cardRadius = Math.min(cardRadius, card.height() * 0.5f);
            drawCard();
            if (!o.enabled) { drawDisabled(); return; }
            switch (o.composition) {
                case "compact_green": layoutGreen(); break;
                case "square_math_bot": layoutMathBot(); break;
                case "medium_study": layoutStudy(); break;
                case "square_cosmic": layoutCosmic(); break;
                case "extra_wide_weekly": layoutWeekly(); break;
                case "minimal_progress": layoutMinimal(); break;
                case "hero_wide":
                default: layoutHero(); break;
            }
            drawUpdatePill();
        }

        void blob(float cx, float cy, float r, int color) {
            if (r <= 0.5f) return;
            int[] cols = { color, withAlpha(color, Color.alpha(color) / 255f * 0.45f), withAlpha(color, 0f) };
            fill.setShader(new RadialGradient(cx, cy, r, cols, new float[] { 0f, 0.5f, 1f }, Shader.TileMode.CLAMP));
            c.drawCircle(cx, cy, r, fill);
            fill.setShader(null);
        }

        void drawCard() {
            if (clear) return;   // "Full Transparent": the wallpaper is the only background
            if (translucent) {   // "Transparent Blur": frosted slate card with a hairline edge
                fill.setColor(o.themeMatched && o.lightMode
                    ? Color.argb(174, 246, 249, 255)
                    : Color.argb(102, 57, 67, 77));
                c.drawRoundRect(card, cardRadius, cardRadius, fill);
                RectF hairline = new RectF(card);
                hairline.inset(0.5f * density, 0.5f * density);
                line.setColor(o.themeMatched && o.lightMode
                    ? Color.argb(95, 29, 42, 64)
                    : Color.argb(40, 255, 255, 255));
                line.setStrokeWidth(Math.max(1f, density));
                c.drawRoundRect(hairline, cardRadius, cardRadius, line);
                resetPaints();
                return;
            }
            Path clip = roundPath(card, cardRadius);
            fill.setShader(new LinearGradient(card.left, card.top, card.right, card.bottom,
                new int[] { pal.bg0, pal.bg1, pal.bg2 }, new float[] { 0f, 0.5f, 1f }, Shader.TileMode.CLAMP));
            c.drawRoundRect(card, cardRadius, cardRadius, fill);
            fill.setShader(null);

            LinearGradient border = new LinearGradient(card.left, card.top, card.right, card.bottom, pal.borderA, pal.borderB, Shader.TileMode.CLAMP);
            c.save();
            c.clipPath(clip);
            if (!minimalStyle) {
                float r = clamp(0.62f * (float) Math.sqrt(card.width() * card.height()), 0.7f * card.height(), 1.1f * card.width());
                blob(card.left + 0.20f * card.width(), card.top + 0.22f * card.height(), r, pal.blobA);
                blob(card.left + 0.92f * card.width(), card.top + 0.88f * card.height(), r * 0.92f, pal.blobB);
                blob(card.left + 0.86f * card.width(), card.top + 0.06f * card.height(), r * 0.70f, pal.blobC);
            }
            fill.setShader(new LinearGradient(0f, card.top, 0f, card.top + card.height() * 0.5f,
                withAlpha(Color.WHITE, 0.06f), withAlpha(Color.WHITE, 0f), Shader.TileMode.CLAMP));
            c.drawRect(card, fill);
            fill.setShader(null);
            // neon light bleeding in from the edge
            float depth = clamp(0.05f * card.height(), 4.5f * density, 10f * density);
            line.setShader(border); line.setStrokeWidth(depth * 1.4f); line.setAlpha(minimalStyle ? 110 : 215);
            line.setMaskFilter(blur(depth * 0.9f));
            c.drawRoundRect(card, cardRadius, cardRadius, line);
            line.setMaskFilter(null);
            c.restore();
            resetPaints();

            // crisp outline, then a faint inner highlight
            RectF crisp = new RectF(card);
            crisp.inset(0.7f * density, 0.7f * density);
            line.setShader(border); line.setStrokeWidth(1.5f * density); line.setAlpha(255);
            c.drawRoundRect(crisp, cardRadius, cardRadius, line);
            line.setShader(null);
            RectF inner = new RectF(card);
            inner.inset(2.6f * density, 2.6f * density);
            line.setColor(withAlpha(Color.WHITE, 0.10f)); line.setStrokeWidth(1f * density);
            c.drawRoundRect(inner, Math.max(2f, cardRadius - 2.6f * density), Math.max(2f, cardRadius - 2.6f * density), line);
            resetPaints();
        }

        void drawDisabled() {
            float cx = card.centerX();
            float size = clamp(card.height() * 0.17f, 11f * density, 17f * density);
            text("Math Master widgets are off", cx, card.centerY() - size * 0.1f, size, f.bold, Color.WHITE, Paint.Align.CENTER, card.width() * 0.9f);
            text("Turn them on in app Settings", cx, card.centerY() + size * 1.25f, size * 0.78f, f.regular, withAlpha(Color.WHITE, 0.75f), Paint.Align.CENTER, card.width() * 0.9f);
        }


        // ---- native UsageStats widget content ---------------------------------
        // This uses the same card, palette, typefaces, glass panel and accent logic as
        // the seven existing compositions. Screen-time content is a dedicated layout
        // because the launcher supplies a single bitmap rather than independent slots.
        boolean hasScreenTime() { return o.studyAppsScreenTime || o.deviceAppsScreenTime; }

        /** Reflow Screen Time inside each composition's original reference frame. */
        void layoutScreenTimeReflow(float rw, float rh) {
            // Resize behavior is driven by the launcher's actual cell geometry, not the
            // selected composition's nominal reference size. The composition still owns
            // its palette, but a resized 4x1/2x1 instance gets the correct compact reflow.
            float aspect = W / Math.max(1f, H);
            boolean wideStrip = aspect >= 3.2f;
            boolean compactStrip = !wideStrip && H / density < 100f;
            boolean hero = !wideStrip && !compactStrip && aspect >= 1.8f;
            if (wideStrip) { rw = 1073f; rh = 156f; }
            else if (compactStrip) { rw = 341f; rh = 158f; }
            else if (hero) { rw = 858f; rh = 384f; }
            else if (aspect >= 1.3f) { rw = 548f; rh = 371f; }
            else { rw = 428f; rh = 371f; }
            frame(rw, rh);
            body(0f, rh, 0f, 0f);
            float pad = wideStrip ? 18f : (compactStrip ? 10f : 16f);
            float gap = wideStrip ? 12f : 8f;
            capH = Math.max(34f * su, Math.min(110f * su, rh * 0.24f * su));

            ScreenTimeSection study = o.studyAppsScreenTime ? d.studyAppsScreenTime : null;
            ScreenTimeSection device = o.deviceAppsScreenTime ? d.deviceAppsScreenTime : null;
            boolean both = study != null && device != null;
            if (!wideStrip && !compactStrip && !both && aspect >= 1.3f) {
                ScreenTimeSection section = study != null ? study : device;
                drawScreenTimeDashboard(section, study != null, Math.max(1, o.screenTimeMaxEntries));
                return;
            }

            // Keep each selected composition's own logo, icon and wordmark. The very
            // short 2x1 cell is data-first, so its two Screen Time panels never collide
            // with the normal-height composition header.
            if (o.identity && !compactStrip) {
                if (wideStrip) {
                    // The 4x1 header keeps each composition's logo mark but constrains
                    // the wordmark to the reserved left strip before the usage panels.
                    switch (o.composition) {
                        case "compact_green":
                            header(RU(38f, 22f, 83f, 76f), XU(137f), YU(60f), 22f * su, YU(90f), 0f, X(272f));
                            break;
                        case "square_math_bot":
                            header(RU(42f, 22f, 71f, 66f), XU(132f), YU(53f), 22f * su, YU(80f), 0f, X(272f));
                            break;
                        case "medium_study":
                            header(RU(36f, 24f, 72f, 68f), XU(124f), YU(56f), 22f * su, YU(82f), 0f, X(272f));
                            break;
                        case "square_cosmic":
                            header(RU(39f, 20f, 75f, 68f), XU(139f), YU(50f), 22f * su, YU(79f), 0f, X(272f));
                            break;
                        case "extra_wide_weekly":
                            header(RU(40f, 20f, 54f, 54f), XU(115f), YU(46f), 22f * su, YU(70f), 0f, X(272f));
                            break;
                        case "minimal_progress":
                            header(RU(29f, 19f, 65f, 58f), XU(111f), YU(44f), 22f * su, YU(0f), 0f, X(272f));
                            break;
                        case "hero_wide":
                        default:
                            header(RU(38f, 25f, 97f, 87f), XU(157f), YU(72f), 22f * su, YU(105f), 0f, X(272f));
                            break;
                    }
                } else {
                    switch (o.composition) {
                    case "compact_green":
                        header(RU(38f, 22f, 83f, 76f), XU(137f), YU(60f), 32f * su, YU(90f), 21f * su, X(478f));
                        break;
                    case "square_math_bot":
                        header(RU(42f, 22f, 71f, 66f), XU(132f), YU(53f), 28.5f * su, YU(80f), 16.5f * su, X(412f));
                        break;
                    case "medium_study":
                        header(RU(36f, 24f, 72f, 68f), XU(124f), YU(56f), 26.5f * su, YU(82f), 14.5f * su, X(354f));
                        break;
                    case "square_cosmic":
                        header(RU(39f, 20f, 75f, 68f), XU(139f), YU(50f), 31f * su, YU(79f), 17f * su, X(530f));
                        break;
                    case "extra_wide_weekly":
                        header(RU(40f, 20f, 54f, 54f), XU(115f), YU(46f), 25f * su, YU(70f), 12f * su, X(272f));
                        break;
                    case "minimal_progress":
                        header(RU(29f, 19f, 65f, 58f), XU(111f), YU(44f), 22f * su, YU(0f), 0f, X(332f));
                        break;
                    case "hero_wide":
                    default:
                        header(RU(38f, 25f, 97f, 87f), XU(157f), YU(72f), 42.5f * su, YU(105f), 23f * su, X(836f));
                        break;
                }
                }
            }

            if (wideStrip) {
                float panelLeft = o.identity ? 286f : pad;
                float panelTop = 18f;
                float panelBottom = rh - 14f;
                if (both) {
                    RectF[] panels = rowRects(panelLeft, rw - pad, panelTop, panelBottom, gap,
                        new float[] { 1f, 1f }, new boolean[] { true, true });
                    studyAppsPanel(panels[0], 1, true);
                    deviceAppsPanel(panels[1], 1, true);
                } else {
                    RectF panel = RB(panelLeft, panelTop, rw - pad, panelBottom);
                    if (study != null)                         studyAppsPanel(panel, 1, true);
                    else if (device != null) deviceAppsPanel(panel, 1, true);
                }
                return;
            }

            if (compactStrip) {
                float panelTop = 14f;
                float panelBottom = rh - 10f;
                float panelLeft = pad;
                if (both) {
                    RectF[] panels = rowRects(panelLeft, rw - pad, panelTop, panelBottom, gap,
                        new float[] { 1f, 1f }, new boolean[] { true, true });
                    studyAppsPanel(panels[0], 1, true);
                    deviceAppsPanel(panels[1], 1, true);
                } else {
                    RectF panel = RB(panelLeft, panelTop, rw - pad, panelBottom);
                    if (study != null) studyAppsPanel(panel, 1, true);
                    else if (device != null) deviceAppsPanel(panel, 1, true);
                }
                return;
            }

            if (hero) {
                float panelLeft = o.progress ? 248f : pad;
                float panelTop = o.identity ? 126f : 30f;
                float panelBottom = (o.target || o.streak || o.weekly || o.quiz) ? rh - 82f : rh - 18f;
                if (o.progress) {
                    float radius = Math.min(78f * su, Math.max(34f * su, (panelBottom - panelTop) * sy * 0.40f));
                    ring(X(132f), Y(220f), radius, radius * 0.18f, d.progress, true);
                }
                if (both) {
                    RectF[] panels = rowRects(panelLeft, rw - pad, panelTop, panelBottom, gap,
                        new float[] { 1f, 1f }, new boolean[] { true, true });
                    studyAppsPanel(panels[0], Math.min(5, o.screenTimeMaxEntries), false);
                    deviceAppsPanel(panels[1], Math.min(5, o.screenTimeMaxEntries), false);
                } else {
                    RectF panel = RB(panelLeft, panelTop, rw - pad, panelBottom);
                    if (study != null) studyAppsPanel(panel, Math.min(5, o.screenTimeMaxEntries), false);
                    else if (device != null) deviceAppsPanel(panel, Math.min(5, o.screenTimeMaxEntries), false);
                }
                if (o.target || o.streak || o.weekly || o.quiz) {
                    drawLegacyMiniBlocks(24f, rh - 72f, rw - 18f, rh - 16f, false);
                }
                return;
            }

            float headerBottom = o.identity ? 82f : 18f;
            float chipsTop = o.identity ? 88f : 22f;
            float chipsBottom = o.identity ? 132f : 72f;
            boolean hasLegacy = o.progress || hasTarget() || o.streak || o.weekly || o.quiz;
            float panelTop = hasLegacy ? chipsBottom + 5f : headerBottom + 8f;
            if (both) {
                RectF[] panels = colRects(pad, rw - pad, panelTop, rh - 14f, gap,
                    new float[] { 1f, 1f }, new boolean[] { true, true });
                studyAppsPanel(panels[0], 1, false);
                deviceAppsPanel(panels[1], 1, false);
            } else {
                RectF panel = RB(pad, panelTop, rw - pad, rh - 14f);
                if (study != null) studyAppsPanel(panel, Math.min(3, o.screenTimeMaxEntries), false);
                else if (device != null) deviceAppsPanel(panel, Math.min(3, o.screenTimeMaxEntries), false);
            }
            if (hasLegacy) drawLegacyMiniBlocks(16f, chipsTop, rw - 16f, chipsBottom, true);
        }

        void drawScreenTimeDashboard(ScreenTimeSection section, boolean studyApps, int requestedRows) {
            float headerPad = 30f;
            float titleSize = clamp(35f * su, 17f * density, 34f * density);
            float tile = clamp(56f * su, 26f * density, 58f * density);
            drawHeaderTile(X(headerPad + 28f), Y(58f), tile, studyApps);
            text(section.title == null || section.title.isEmpty()
                    ? (studyApps ? "Study Apps" : "Device Apps") : section.title,
                X(headerPad + 56f + 18f), Y(70f), titleSize, f.bold,
                Color.rgb(228, 255, 246), Paint.Align.LEFT, X(560f));
            drawPeriodPill(section.periodLabel, headerPad);

            boolean hasLegacyContent = o.progress || hasTarget() || o.streak || o.weekly || o.quiz;
            float footerTop = hasLegacyContent ? refH - 74f : refH - 58f;
            float contentTop = 99f;
            float contentBottom = footerTop - 10f;
            float ringX = X(refW * 0.22f);
            float ringY = Y((contentTop + contentBottom) * 0.5f);
            float ringRadius = Math.min(114f * ringScale(), (contentBottom - contentTop) * sy * 0.45f);
            ringRadius = Math.max(28f * density, ringRadius);
            float stroke = Math.max(4f * density, ringRadius * 0.125f);

            if ("ok".equals(section.status)) {
                drawScreenTimeRing(ringX, ringY, ringRadius, stroke, screenTimeRingProgress(section));
                drawScreenTimeRingCenter(section, ringX, ringY, ringRadius);
            } else {
                drawScreenTimeRing(ringX, ringY, ringRadius, stroke, 0f);
                String headline, detail;
                if ("permission_required".equals(section.status)) {
                    headline = "Usage Access Required";
                    detail = "Open Usage Access settings";
                } else if ("no_study_apps".equals(section.status)) {
                    headline = "No Study Apps Selected";
                    detail = "Choose apps to see study time";
                } else if ("error".equals(section.status)) {
                    headline = "Unable to load usage";
                    detail = "Open Math Master to retry";
                } else if ("loading".equals(section.status)) {
                    headline = "Loading usage";
                    detail = "Reading on-device data";
                } else {
                    headline = "No usage recorded yet";
                    detail = "No app time for this period";
                }
                float textSize = clamp(19f * su, 10f * density, 18f * density);
                text(headline, ringX, ringY - 2f * su, textSize, f.medium, Color.WHITE,
                    Paint.Align.CENTER, ringRadius * 1.62f);
                text(detail, ringX, ringY + 25f * su, textSize * 0.70f, f.regular,
                    withAlpha(Color.WHITE, 0.72f), Paint.Align.CENTER, ringRadius * 1.62f);
            }

            float rowsLeft = X(refW * 0.405f);
            float rowsRight = X(refW - 25f);
            float rowsTop = Y(contentTop + 1f);
            float rowsBottom = Y(contentBottom);
            if ("ok".equals(section.status) && section.entries != null && !section.entries.isEmpty()) {
                float gap = Math.max(4f * density, 9f * su);
                float minRow = Math.max(20f * density, 0.145f * refH * sy);
                int count = Math.min(Math.min(requestedRows, 5), section.entries.size());
                count = Math.min(count, Math.max(1, (int) ((rowsBottom - rowsTop + gap) / (minRow + gap))));
                float rowHeight = (rowsBottom - rowsTop - gap * (count - 1)) / count;
                for (int index = 0; index < count; index++) {
                    drawScreenTimeEntry(section.entries.get(index),
                        new RectF(rowsLeft, rowsTop + index * (rowHeight + gap), rowsRight,
                            rowsTop + index * (rowHeight + gap) + rowHeight), index);
                }
            } else if ("permission_required".equals(section.status)) {
                text("Tap the widget to grant Usage Access", (rowsLeft + rowsRight) * 0.5f,
                    (rowsTop + rowsBottom) * 0.5f, 17f * su, f.medium,
                    withAlpha(Color.WHITE, 0.82f), Paint.Align.CENTER, rowsRight - rowsLeft);
            }

            if (hasLegacyContent) {
                drawLegacyMiniBlocks(24f, refH - 70f, refW - 18f, refH - 14f, true);
            } else {
                RectF footer = RB(24f, footerTop, refW - 24f, refH - 14f);
                glass(footer, footer.height() * 0.5f);
                drawTrophy(footer.left + footer.height() * 0.60f, footer.centerY(), footer.height() * 0.62f);
                float messageLeft = footer.left + footer.height() * 1.10f;
                float messageSize = 18f * su;
                float drawn = text(studyApps ? "Keep going! You're doing great!" : "Stay mindful, every minute counts", messageLeft,
                    footer.centerY() + 6f * su, messageSize, f.regular,
                    withAlpha(Color.WHITE, 0.92f), Paint.Align.LEFT, footer.width() * 0.62f);
                drawSparkle(messageLeft + drawn + messageSize * 0.75f, footer.centerY() - messageSize * 0.12f,
                    messageSize * 0.52f);
                drawSparkle(messageLeft + drawn + messageSize * 1.35f, footer.centerY() - messageSize * 0.42f,
                    messageSize * 0.26f);
                drawTrendArrow(footer.right - footer.height() * 0.62f, footer.centerY(),
                    footer.height() * 0.52f);
            }
            drawGlassSwoosh();
            drawGlassBubble(X(refW * 0.785f), Y(17f), Math.max(7f * density, 16f * su));
        }

        /** The ring is a visual gauge against a 9-hour reference day (63 hours for Last 7 Days). */
        float screenTimeRingProgress(ScreenTimeSection section) {
            double budget = 9d * 3_600_000d * ("last_7_days".equals(o.screenTimePeriod) ? 7d : 1d);
            return (float) Math.min(1d, Math.max(0d, section.totalUsageMillis / budget));
        }

        void drawScreenTimeRing(float cx, float cy, float r, float stroke, float progress) {
            float half = stroke * 0.5f;
            fill.setShader(new RadialGradient(cx, cy, r,
                new int[]{withAlpha(hex("#06352D"), 0.50f), withAlpha(hex("#02150F"), 0.82f)},
                new float[]{0f, 1f}, Shader.TileMode.CLAMP));
            c.drawCircle(cx, cy, r - stroke * 0.15f, fill);
            resetPaints();
            line.setStrokeWidth(stroke);
            line.setColor(withAlpha(hex("#7FF0CC"), 0.13f));
            c.drawCircle(cx, cy, r - half, line);
            resetPaints();
            if (progress <= 0f) return;
            float p = clamp(progress, 0.05f, 1f);
            RectF oval = new RectF(cx - r + half, cy - r + half, cx + r - half, cy + r - half);
            c.save();
            c.rotate(-90f, cx, cy);
            line.setStrokeCap(Paint.Cap.ROUND);
            line.setShader(new SweepGradient(cx, cy,
                new int[]{hex("#5CFFB8"), hex("#21F5A6"), hex("#22D3EE"), hex("#1DA1F2"), hex("#1DA1F2")},
                new float[]{0f, 0.33f * p, 0.70f * p, p, 1f}));
            line.setStrokeWidth(stroke * 1.9f);
            line.setAlpha(44);
            c.drawArc(oval, 0f, 360f * p, false, line);
            line.setStrokeWidth(stroke);
            line.setAlpha(255);
            c.drawArc(oval, 0f, 360f * p, false, line);
            c.restore();
            resetPaints();
            fill.setColor(withAlpha(Color.WHITE, 0.30f));
            c.drawCircle(cx, cy - r + half, stroke * 0.62f, fill);
            fill.setColor(withAlpha(hex("#D6FEED"), 0.95f));
            c.drawCircle(cx, cy - r + half, stroke * 0.32f, fill);
            resetPaints();
        }

        void drawScreenTimeRingCenter(ScreenTimeSection section, float cx, float cy, float radius) {
            float clockR = radius * 0.155f;
            float clockY = cy - radius * 0.42f;
            line.setColor(withAlpha(Color.WHITE, 0.96f));
            line.setStrokeWidth(Math.max(2f * density, radius * 0.036f));
            c.drawCircle(cx, clockY, clockR, line);
            c.drawLine(cx, clockY, cx, clockY - clockR * 0.58f, line);
            c.drawLine(cx, clockY, cx + clockR * 0.46f, clockY + clockR * 0.30f, line);
            resetPaints();
            if (o.screenTimeShowTotal) {
                drawRichDuration(section.totalUsageMillis, cx, cy + radius * 0.17f,
                    clamp(radius * 0.29f, 14f * density, 34f * density), radius * 1.62f);
            } else {
                text("Screen Time", cx, cy + radius * 0.17f, clamp(radius * 0.22f, 12f * density, 26f * density),
                    f.bold, Color.WHITE, Paint.Align.CENTER, radius * 1.55f);
            }
            text("Total Screen Time", cx, cy + radius * 0.38f, radius * 0.14f,
                f.regular, withAlpha(Color.WHITE, 0.82f), Paint.Align.CENTER, radius * 1.55f);
            barsIcon(cx, cy + radius * 0.64f, radius * 0.26f);
        }

        /** Numbers in bold, units in a lighter, smaller weight: "5 hr 54 min". */
        void drawRichDuration(long millis, float cx, float baseline, float size, float maxWidth) {
            String[] parts = formatUsageDuration(millis).split(" ");
            float gap = size * 0.20f;
            float total = 0f;
            for (int i = 0; i < parts.length; i++) {
                boolean number = isNumberToken(parts[i]);
                total += measure(parts[i], number ? size : size * 0.80f, number ? f.bold : f.medium);
                if (i < parts.length - 1) total += gap;
            }
            float scale = total > maxWidth && maxWidth > 0f ? maxWidth / total : 1f;
            float x = cx - total * scale * 0.5f;
            for (int i = 0; i < parts.length; i++) {
                boolean number = isNumberToken(parts[i]);
                float partSize = (number ? size : size * 0.80f) * scale;
                float drawn = text(parts[i], x, baseline, partSize, number ? f.bold : f.medium,
                    number ? Color.WHITE : withAlpha(Color.WHITE, 0.92f), Paint.Align.LEFT, 0f);
                x += drawn + gap * scale;
            }
        }

        boolean isNumberToken(String token) {
            return token.length() > 0 && (Character.isDigit(token.charAt(0)) || token.charAt(0) == '<');
        }

        int[] rankBar(int rank) {
            if (o.themeMatched) return new int[]{pal.bar0, pal.bar1};
            switch (rank % 5) {
                case 0: return new int[]{hex("#3BFDA4"), hex("#12D68A")};
                case 1: return new int[]{hex("#31EBF4"), hex("#18B5F0")};
                case 2: return new int[]{hex("#C4A6FF"), hex("#8F6BF3")};
                case 3: return new int[]{hex("#FFD479"), hex("#F59E0B")};
                default: return new int[]{hex("#FF9DBA"), hex("#F43F8E")};
            }
        }

        void drawScreenTimeEntry(ScreenTimeEntry entry, RectF row, int rank) {
            float h = row.height();
            float radius = Math.min(h * 0.27f, 24f * density);
            glass(row, radius);
            float pad = Math.max(6f * density, h * 0.10f);
            float iconSize = Math.min(h * 0.80f, 64f * density);
            RectF icon = new RectF(row.left + pad, row.centerY() - iconSize * 0.5f,
                row.left + pad + iconSize, row.centerY() + iconSize * 0.5f);
            fill.setColor(withAlpha(pal.master, 0.20f));
            c.drawRoundRect(icon, iconSize * 0.24f, iconSize * 0.24f, fill);
            if (entry.icon != null && !entry.icon.isRecycled()) {
                c.save();
                c.clipPath(roundPath(icon, iconSize * 0.24f));
                c.drawBitmap(entry.icon, null, icon, fill);
                c.restore();
            }
            resetPaints();
            float chevronSpace = h * 0.34f;
            float valueRight = row.right - pad - chevronSpace;
            float columnWidth = Math.min(150f * density, row.width() * 0.27f);
            float labelLeft = icon.right + pad * 0.9f;
            boolean showBar = o.screenTimeShowPercent;
            float nameSize = Math.min(22f * su, h * 0.27f);
            float valueSize = Math.min(20f * su, h * 0.25f);
            float topBaseline = showBar ? row.top + h * 0.45f : row.centerY() + valueSize * 0.34f;
            text(entry.label == null ? entry.packageName : entry.label, labelLeft, topBaseline, nameSize,
                f.medium, Color.WHITE, Paint.Align.LEFT,
                Math.max(1f, valueRight - columnWidth - labelLeft - pad * 0.5f));
            if (o.screenTimeShowUsage) {
                text(formatUsageDuration(entry.usageMillis), valueRight, topBaseline, valueSize, f.medium,
                    Color.WHITE, Paint.Align.RIGHT, columnWidth);
            }
            if (o.screenTimeShowPercent && o.screenTimeDetailed) {
                text(Math.round(entry.percent) + "%", valueRight, row.top + h * 0.82f, valueSize * 1.06f,
                    f.bold, o.themeMatched ? pal.ring0 : hex("#2FF5A3"), Paint.Align.RIGHT, columnWidth);
            }
            if (showBar) {
                float barHeight = Math.max(3f * density, h * 0.13f);
                float barTop = row.top + h * 0.60f;
                RectF track = new RectF(labelLeft, barTop, valueRight - columnWidth - pad * 0.7f, barTop + barHeight);
                if (track.width() > 8f * density) {
                    fill.setColor(withAlpha(hex("#113E46"), 0.90f));
                    c.drawRoundRect(track, barHeight, barHeight, fill);
                    float ratio = clamp(entry.percent / 100f, 0f, 1f);
                    if (ratio > 0f) {
                        int[] colors = rankBar(rank);
                        RectF progress = new RectF(track.left, track.top,
                            track.left + Math.max(barHeight, track.width() * ratio), track.bottom);
                        fill.setShader(new LinearGradient(progress.left, progress.top, progress.right,
                            progress.top, colors[0], colors[1], Shader.TileMode.CLAMP));
                        c.drawRoundRect(progress, barHeight, barHeight, fill);
                    }
                    resetPaints();
                }
            }
            chevronRight(row.right - pad - chevronSpace * 0.40f, row.centerY(), h * 0.12f);
        }

        void chevronRight(float cx, float cy, float size) {
            line.setColor(withAlpha(Color.WHITE, 0.62f));
            line.setStrokeWidth(Math.max(1.4f * density, size * 0.34f));
            c.drawLine(cx - size * 0.45f, cy - size, cx + size * 0.45f, cy, line);
            c.drawLine(cx + size * 0.45f, cy, cx - size * 0.45f, cy + size, line);
            resetPaints();
        }

        /** Rounded gradient tile with a gloss and a filled glyph: green book for Study Apps, blue phone for Device Apps. */
        void drawHeaderTile(float cx, float cy, float size, boolean studyApps) {
            float r = size * 0.27f;
            RectF tile = new RectF(cx - size * 0.5f, cy - size * 0.5f, cx + size * 0.5f, cy + size * 0.5f);
            int top = studyApps ? hex("#46F29C") : hex("#4CC3FF");
            int bottom = studyApps ? hex("#12A85E") : hex("#2F5BEA");
            fill.setShader(new LinearGradient(tile.left, tile.top, tile.left, tile.bottom, top, bottom,
                Shader.TileMode.CLAMP));
            c.drawRoundRect(tile, r, r, fill);
            resetPaints();
            RectF gloss = new RectF(tile.left + size * 0.05f, tile.top + size * 0.04f,
                tile.right - size * 0.05f, tile.centerY());
            fill.setShader(new LinearGradient(gloss.left, gloss.top, gloss.left, gloss.bottom,
                withAlpha(Color.WHITE, 0.34f), withAlpha(Color.WHITE, 0f), Shader.TileMode.CLAMP));
            c.drawRoundRect(gloss, r * 0.8f, r * 0.8f, fill);
            resetPaints();
            line.setColor(withAlpha(Color.WHITE, 0.34f));
            line.setStrokeWidth(Math.max(1f, 0.9f * density));
            c.drawRoundRect(tile, r, r, line);
            resetPaints();
            int ink = hex("#E9FFF4");
            if (studyApps) {
                float s = size * 0.62f;
                Path left = new Path();
                left.moveTo(cx - s * 0.04f, cy - s * 0.26f);
                left.lineTo(cx - s * 0.48f, cy - s * 0.20f);
                left.lineTo(cx - s * 0.48f, cy + s * 0.30f);
                left.lineTo(cx - s * 0.04f, cy + s * 0.36f);
                left.close();
                Path right = new Path();
                right.moveTo(cx + s * 0.04f, cy - s * 0.26f);
                right.lineTo(cx + s * 0.48f, cy - s * 0.20f);
                right.lineTo(cx + s * 0.48f, cy + s * 0.30f);
                right.lineTo(cx + s * 0.04f, cy + s * 0.36f);
                right.close();
                fill.setColor(withAlpha(ink, 0.96f));
                c.drawPath(left, fill);
                c.drawPath(right, fill);
                line.setColor(withAlpha(bottom, 0.55f));
                line.setStrokeWidth(Math.max(1f, s * 0.045f));
                for (int i = 0; i < 2; i++) {
                    float y = cy - s * 0.06f + i * s * 0.17f;
                    c.drawLine(cx - s * 0.36f, y - s * 0.02f, cx - s * 0.14f, y + s * 0.01f, line);
                    c.drawLine(cx + s * 0.14f, y + s * 0.01f, cx + s * 0.36f, y - s * 0.02f, line);
                }
                resetPaints();
            } else {
                float s = size * 0.62f;
                RectF phone = new RectF(cx - s * 0.20f, cy - s * 0.36f, cx + s * 0.20f, cy + s * 0.36f);
                fill.setColor(withAlpha(ink, 0.96f));
                c.drawRoundRect(phone, s * 0.09f, s * 0.09f, fill);
                fill.setColor(withAlpha(bottom, 0.50f));
                c.drawRoundRect(new RectF(phone.left + s * 0.05f, phone.top + s * 0.10f, phone.right - s * 0.05f,
                    phone.bottom - s * 0.10f), s * 0.04f, s * 0.04f, fill);
                fill.setColor(withAlpha(bottom, 0.75f));
                c.drawCircle(cx, phone.top + s * 0.05f, s * 0.02f, fill);
                resetPaints();
            }
        }

        /** Glass period pill with a dark chevron button, as in the approved Study Apps reference. */
        void drawPeriodPill(String label, float rightPad) {
            String value = label == null || label.isEmpty() ? "Today" : label;
            float textSize = 18f * su;
            float widthRef = Math.max(118f, measure(value, textSize, f.medium) / sx + 74f);
            RectF pill = RB(refW - rightPad - widthRef, 34f, refW - rightPad, 80f);
            float rad = pill.height() * 0.5f;
            fill.setColor(withAlpha(Color.rgb(14, 90, 71), 0.52f));
            c.drawRoundRect(pill, rad, rad, fill);
            fill.setShader(new LinearGradient(pill.left, pill.top, pill.left, pill.bottom,
                withAlpha(Color.WHITE, 0.16f), withAlpha(Color.WHITE, 0f), Shader.TileMode.CLAMP));
            c.drawRoundRect(pill, rad, rad, fill);
            resetPaints();
            line.setColor(withAlpha(Color.rgb(127, 240, 204), 0.58f));
            line.setStrokeWidth(Math.max(1f, 1.1f * density));
            c.drawRoundRect(pill, rad, rad, line);
            resetPaints();
            float chevR = pill.height() * 0.36f;
            float chevCx = pill.right - pill.height() * 0.5f;
            fill.setColor(withAlpha(Color.rgb(8, 52, 47), 0.92f));
            c.drawCircle(chevCx, pill.centerY(), chevR, fill);
            resetPaints();
            line.setColor(withAlpha(Color.WHITE, 0.95f));
            line.setStrokeWidth(Math.max(1.6f, 1.9f * density * su));
            float cw = chevR * 0.46f;
            c.drawLine(chevCx - cw, pill.centerY() - cw * 0.35f, chevCx, pill.centerY() + cw * 0.45f, line);
            c.drawLine(chevCx, pill.centerY() + cw * 0.45f, chevCx + cw, pill.centerY() - cw * 0.35f, line);
            resetPaints();
            float areaRight = chevCx - chevR - 4f * density;
            text(value, (pill.left + areaRight) * 0.5f, pill.centerY() + textSize * 0.34f, textSize, f.medium,
                Color.WHITE, Paint.Align.CENTER, Math.max(8f * density, areaRight - pill.left - 8f * density));
        }

        /** Translucent glass droplet that sits on the card's top edge. */
        void drawGlassBubble(float cx, float cy, float radius) {
            fill.setShader(new RadialGradient(cx - radius * 0.35f, cy - radius * 0.40f, radius * 1.5f,
                new int[]{withAlpha(hex("#D6FFF2"), 0.55f), withAlpha(hex("#3CEEB6"), 0.22f), withAlpha(hex("#0AA084"), 0.40f)},
                new float[]{0f, 0.5f, 1f}, Shader.TileMode.CLAMP));
            c.drawCircle(cx, cy, radius, fill);
            resetPaints();
            line.setColor(withAlpha(hex("#D6FFF2"), 0.55f));
            line.setStrokeWidth(Math.max(1f, 0.9f * density));
            c.drawCircle(cx, cy, radius, line);
            resetPaints();
        }

        /** Two faint reflection curves along the lower-left of the glass card. */
        void drawGlassSwoosh() {
            for (int i = 0; i < 2; i++) {
                Path swoosh = new Path();
                float inset = i * 9f;
                swoosh.moveTo(X(6f + inset), Y(refH * 0.52f));
                swoosh.cubicTo(X(8f + inset), Y(refH * 0.90f), X(refW * 0.16f), Y(refH - 5f - inset),
                    X(refW * 0.36f), Y(refH - 5f - inset));
                line.setColor(withAlpha(hex("#BFFFE8"), i == 0 ? 0.20f : 0.11f));
                line.setStrokeWidth(Math.max(1f, (i == 0 ? 1.3f : 1f) * density));
                c.drawPath(swoosh, line);
            }
            resetPaints();
        }

        void drawSparkle(float cx, float cy, float size) {
            Path star = new Path();
            star.moveTo(cx, cy - size);
            star.quadTo(cx + size * 0.12f, cy - size * 0.12f, cx + size, cy);
            star.quadTo(cx + size * 0.12f, cy + size * 0.12f, cx, cy + size);
            star.quadTo(cx - size * 0.12f, cy + size * 0.12f, cx - size, cy);
            star.quadTo(cx - size * 0.12f, cy - size * 0.12f, cx, cy - size);
            star.close();
            fill.setColor(hex("#FFD54A"));
            c.drawPath(star, fill);
            resetPaints();
        }

        void drawTrophy(float cx, float cy, float size) {
            float w = size * 0.80f;
            float h = size * 0.80f;
            Path cup = new Path();
            cup.moveTo(cx - w * 0.34f, cy - h * 0.44f);
            cup.lineTo(cx + w * 0.34f, cy - h * 0.44f);
            cup.lineTo(cx + w * 0.30f, cy + h * 0.02f);
            cup.quadTo(cx + w * 0.26f, cy + h * 0.26f, cx, cy + h * 0.28f);
            cup.quadTo(cx - w * 0.26f, cy + h * 0.26f, cx - w * 0.30f, cy + h * 0.02f);
            cup.close();
            fill.setColor(pal.ring0);
            c.drawPath(cup, fill);
            resetPaints();
            line.setColor(pal.ring0);
            line.setStrokeWidth(Math.max(1.3f * density, size * 0.075f));
            c.drawArc(new RectF(cx - w * 0.62f, cy - h * 0.38f, cx - w * 0.22f, cy - h * 0.02f), 90f, 180f, false, line);
            c.drawArc(new RectF(cx + w * 0.22f, cy - h * 0.38f, cx + w * 0.62f, cy - h * 0.02f), 270f, 180f, false, line);
            c.drawLine(cx, cy + h * 0.28f, cx, cy + h * 0.42f, line);
            c.drawLine(cx - w * 0.22f, cy + h * 0.46f, cx + w * 0.22f, cy + h * 0.46f, line);
            resetPaints();
        }

        void drawTrendArrow(float cx, float cy, float size) {
            Path trend = new Path();
            trend.moveTo(cx - size * 0.55f, cy + size * 0.32f);
            trend.lineTo(cx - size * 0.12f, cy - size * 0.08f);
            trend.lineTo(cx + size * 0.12f, cy + size * 0.10f);
            trend.lineTo(cx + size * 0.55f, cy - size * 0.40f);
            line.setColor(pal.ring0);
            line.setStrokeWidth(Math.max(1.8f * density, size * 0.11f));
            c.drawPath(trend, line);
            c.drawLine(cx + size * 0.26f, cy - size * 0.40f,
                cx + size * 0.55f, cy - size * 0.40f, line);
            c.drawLine(cx + size * 0.55f, cy - size * 0.40f,
                cx + size * 0.55f, cy - size * 0.12f, line);
            resetPaints();
        }

        /** Preserve selected legacy blocks with their original glass/icon helpers and drop
         * quiz, week, streak, target, then progress only when the strip cannot fit them. */
        void drawLegacyMiniBlocks(float left, float top, float right, float bottom, boolean includeRing) {
            if (right <= left || bottom <= top) return;
            boolean ringOn = includeRing && o.progress;
            boolean targetOn = hasTarget(), streakOn = o.streak, weekOn = o.weekly, quizOn = o.quiz;
            float h = Math.max(1f, bottom - top);
            float gap = Math.max(3f, h * 0.12f);
            float[] widths = { h * 1.1f, h * 2.55f, h * 1.55f, h * 2.55f, h * 2.40f };
            float total = (ringOn ? widths[0] : 0f) + (targetOn ? widths[1] : 0f)
                + (streakOn ? widths[2] : 0f) + (weekOn ? widths[3] : 0f) + (quizOn ? widths[4] : 0f);
            int count = (ringOn ? 1 : 0) + (targetOn ? 1 : 0) + (streakOn ? 1 : 0)
                + (weekOn ? 1 : 0) + (quizOn ? 1 : 0);
            while (total + Math.max(0, count - 1) * gap > right - left) {
                if (quizOn) { quizOn = false; total -= widths[4]; count--; }
                else if (weekOn) { weekOn = false; total -= widths[3]; count--; }
                else if (streakOn) { streakOn = false; total -= widths[2]; count--; }
                else if (targetOn) { targetOn = false; total -= widths[1]; count--; }
                else if (ringOn) { ringOn = false; total -= widths[0]; count--; }
                else break;
            }
            if (count == 0) return;
            boolean[] present = { ringOn, targetOn, streakOn, weekOn, quizOn };
            RectF[] slots = rowRects(left, right, top, bottom, gap / Math.max(0.01f, sx),
                widths, present);
            capH = h;
            if (slots[0] != null) {
                float radius = Math.min(slots[0].width() * 0.42f, slots[0].height() * 0.44f);
                ring(slots[0].centerX(), slots[0].centerY(), radius, radius * 0.20f, d.progress, true);
            }
            if (slots[1] != null) targetPanel(slots[1], false);
            if (slots[2] != null) streakPanel(slots[2]);
            if (slots[3] != null) weekStrip(slots[3], 16f, 11f, 0.36f, 0.70f);
            if (slots[4] != null) quizTile(slots[4], 14f);
        }

        void studyAppsPanel(RectF panel, int requestedRows, boolean inline) {
            drawAppsPanel(d.studyAppsScreenTime, panel, true, requestedRows, inline);
        }

        void deviceAppsPanel(RectF panel, int requestedRows, boolean inline) {
            drawAppsPanel(d.deviceAppsScreenTime, panel, false, requestedRows, inline);
        }

        /** The same glass surface and neon ink are used for both independent data sources. */
        void drawAppsPanel(ScreenTimeSection section, RectF panel, boolean studyApps,
                           int requestedRows, boolean inline) {
            if (section == null || panel == null || panel.width() < 2f || panel.height() < 2f) return;
            float w = panel.width(), h = panel.height();
            float pad = clamp(Math.min(w, h) * 0.045f, 3f * density, 9f * density);
            glass(panel, Math.min(panelRadius(panel), Math.max(5f * density, h * 0.14f)));

            float iconSize = clamp(h * (inline ? 0.20f : 0.16f), 8f * density, 20f * density);
            float titleSize = clamp(Math.min(labelRef * su, h * 0.105f), 8f * density, 15f * density);
            float metaSize = clamp(titleSize * 0.64f, 6.5f * density, 9f * density);
            float titleLeft = panel.left + pad;
            float titleBaseline = panel.top + pad + titleSize;
            float iconCx = titleLeft + iconSize * 0.52f;
            float iconCy = panel.top + pad + iconSize * 0.50f;
            drawHeaderTile(iconCx, iconCy, iconSize * 1.12f, studyApps);
            float textLeft = titleLeft + iconSize * 1.12f + pad * 0.55f;
            float periodWidth = Math.min(w * 0.38f,
                Math.max(34f * density, measure(section.periodLabel, metaSize, f.medium) + pad));
            float titleRight = panel.right - pad - periodWidth - pad * 0.45f;
            text(section.title == null || section.title.isEmpty()
                    ? (studyApps ? "Study Apps" : "Device Apps") : section.title,
                textLeft, titleBaseline, titleSize, f.bold, Color.WHITE, Paint.Align.LEFT,
                Math.max(12f * density, titleRight - textLeft));
            RectF periodChip = new RectF(panel.right - pad - periodWidth, panel.top + pad * 0.72f,
                panel.right - pad, panel.top + pad * 0.72f + metaSize * 1.55f);
            fill.setColor(withAlpha(Color.rgb(14, 90, 71), 0.52f));
            c.drawRoundRect(periodChip, periodChip.height() * 0.5f, periodChip.height() * 0.5f, fill);
            resetPaints();
            line.setColor(withAlpha(Color.rgb(127, 240, 204), 0.55f));
            line.setStrokeWidth(Math.max(1f, 0.9f * density));
            c.drawRoundRect(periodChip, periodChip.height() * 0.5f, periodChip.height() * 0.5f, line);
            resetPaints();
            text(section.periodLabel, periodChip.centerX(), periodChip.bottom - metaSize * 0.28f,
                metaSize, f.medium, Color.WHITE, Paint.Align.CENTER, periodWidth - pad * 0.5f);

            if (!"ok".equals(section.status)) {
                String headline, detail;
                if ("permission_required".equals(section.status)) {
                    headline = "Usage Access Required"; detail = "Tap to open Usage Access settings";
                } else if ("no_study_apps".equals(section.status)) {
                    headline = "No Study Apps Selected"; detail = "Select study apps to view their usage";
                } else if ("no_usage".equals(section.status) || "no_visible_apps".equals(section.status)) {
                    headline = "No usage recorded yet."; detail = "No app time for this period";
                } else if ("error".equals(section.status)) {
                    headline = "Error"; detail = "Open Math Master to retry";
                } else {
                    headline = "Loading"; detail = "Reading on-device usage";
                }
                float statusSize = clamp(h * 0.105f, 8f * density, 13f * density);
                float statusY = Math.min(panel.bottom - pad, titleBaseline + statusSize * 1.65f);
                text(headline, titleLeft, statusY, statusSize, f.medium, Color.WHITE, Paint.Align.LEFT, w - pad * 2f);
                if (h > 52f * density) text(detail, titleLeft, statusY + metaSize * 1.55f,
                    metaSize, f.regular, withAlpha(Color.WHITE, 0.70f), Paint.Align.LEFT, w - pad * 2f);
                return;
            }

            float totalBaseline = titleBaseline + metaSize * 1.30f + (inline ? 1.5f : pad * 0.25f);
            float rowStart = totalBaseline + metaSize * 0.75f;
            if (o.screenTimeShowTotal) {
                String total = formatUsageDuration(section.totalUsageMillis);
                float valueSize = clamp(Math.min(valueRef * su, h * (inline ? 0.18f : 0.13f)), 8f * density, 18f * density);
                text(total, titleLeft, totalBaseline + valueSize * 0.65f, valueSize,
                    f.bold, Color.WHITE, Paint.Align.LEFT, inline ? w * 0.45f : w - pad * 2f);
                rowStart = totalBaseline + valueSize + pad * 0.60f;
            }

            if (inline) {
                // 4x1 gets one top app beside its total; 2x1 is intentionally total-only.
                if (requestedRows > 0 && section.entries != null && !section.entries.isEmpty()) {
                    drawInlineUsageEntry(section.entries.get(0), panel, rowStart, titleSize, metaSize, pad);
                }
                return;
            }

            int entryCount = section.entries == null ? 0 : section.entries.size();
            if (entryCount == 0) return;
            float footer = 0f;
            float available = panel.bottom - pad - footer - rowStart;
            float minRow = (o.screenTimeDetailed ? 10.0f : 9.0f) * density;
            int fitRows = Math.max(0, (int) Math.floor(available / minRow));
            int rows = Math.min(Math.min(Math.max(0, requestedRows), entryCount), fitRows);
            if (rows == 0 && available >= 10f * density) rows = 1;
            if (rows == 0) return;
            float rowHeight = available / rows;
            for (int index = 0; index < rows; index++) {
                ScreenTimeEntry entry = section.entries.get(index);
                float rowTop = rowStart + rowHeight * index;
                float icon = Math.min(rowHeight * 0.68f, 21f * density);
                float iconLeft = titleLeft;
                float iconTop = rowTop + (rowHeight - icon) * 0.30f;
                RectF iconTile = new RectF(iconLeft, iconTop, iconLeft + icon, iconTop + icon);
                fill.setColor(withAlpha(pal.master, 0.16f));
                c.drawRoundRect(iconTile, icon * 0.24f, icon * 0.24f, fill);
                if (entry.icon != null && !entry.icon.isRecycled()) {
                    c.save();
                    c.clipPath(roundPath(iconTile, icon * 0.24f));
                    c.drawBitmap(entry.icon, null, iconTile, fill);
                    c.restore();
                }
                float labelLeft = iconTile.right + pad * 0.58f;
                float valueRight = panel.right - pad;
                float valueWidth = o.screenTimeShowUsage
                    ? Math.min(w * 0.34f, Math.max(42f * density, metaSize * 4.4f)) : 0f;
                float labelMax = Math.max(6f * density, valueRight - valueWidth - pad * 0.35f - labelLeft);
                float labelBaseline = rowTop + rowHeight * 0.58f;
                text(entry.label == null ? entry.packageName : entry.label,
                    labelLeft, labelBaseline, Math.min(labelRef * su * 0.68f, rowHeight * 0.42f),
                    f.medium, Color.WHITE, Paint.Align.LEFT, labelMax);
                if (o.screenTimeShowUsage) {
                    String duration = formatUsageDuration(entry.usageMillis);
                    if (o.screenTimeShowPercent && o.screenTimeDetailed) duration += " · " + Math.round(entry.percent) + "%";
                    text(duration, valueRight, labelBaseline, Math.min(numRef * su * 0.28f, rowHeight * 0.40f),
                        f.bold, Color.WHITE, Paint.Align.RIGHT, valueWidth);
                }
                if (o.screenTimeShowPercent) {
                    float barTop = rowTop + rowHeight * 0.82f;
                    float barHeight = Math.max(1.3f * density, rowHeight * 0.055f);
                    float barLeft = labelLeft;
                    RectF track = new RectF(barLeft, barTop, valueRight, barTop + barHeight);
                    fill.setColor(withAlpha(pal.track, 0.88f));
                    c.drawRoundRect(track, barHeight, barHeight, fill);
                    float ratio = Math.max(0f, Math.min(1f, entry.percent / 100f));
                    if (ratio > 0f) {
                        RectF progress = new RectF(track.left, track.top,
                            track.left + track.width() * ratio, track.bottom);
                        int[] barColors = rankBar(index);
                        fill.setShader(new LinearGradient(progress.left, progress.top, progress.right, progress.top,
                            barColors[0], barColors[1], Shader.TileMode.CLAMP));
                        c.drawRoundRect(progress, barHeight, barHeight, fill);
                        fill.setShader(null);
                    }
                    resetPaints();
                }
                if (index < rows - 1) {
                    line.setColor(withAlpha(Color.WHITE, 0.11f));
                    line.setStrokeWidth(Math.max(0.7f, density * 0.42f));
                    c.drawLine(labelLeft, rowTop + rowHeight, valueRight, rowTop + rowHeight, line);
                    resetPaints();
                }
            }
        }

        void drawInlineUsageEntry(ScreenTimeEntry entry, RectF panel, float y,
                                  float titleSize, float metaSize, float pad) {
            if (entry == null) return;
            float left = panel.left + pad + 2f;
            float right = panel.right - pad;
            float valueWidth = o.screenTimeShowUsage ? Math.min(panel.width() * 0.30f, 70f * density) : 0f;
            float labelWidth = Math.max(8f * density, right - left - valueWidth - pad * 0.5f);
            text(entry.label == null ? entry.packageName : entry.label,
                left, Math.min(panel.bottom - pad, y + metaSize), metaSize,
                f.medium, Color.WHITE, Paint.Align.LEFT, labelWidth);
            if (o.screenTimeShowUsage) {
                text(formatUsageDuration(entry.usageMillis), right, Math.min(panel.bottom - pad, y + metaSize),
                    metaSize, f.bold, Color.WHITE, Paint.Align.RIGHT, valueWidth);
            }
        }

        void studyBookIcon(float cx, float cy, float size) {
            float w = size * 0.88f, h = size * 0.72f, sw = Math.max(1f, size * 0.075f);
            int tint = pal.master;
            if (!minimalStyle) iconGlow(cx, cy, size * 0.78f, tint);
            Path book = new Path();
            book.moveTo(cx, cy - h * 0.40f);
            book.cubicTo(cx - w * 0.36f, cy - h * 0.54f, cx - w * 0.48f, cy - h * 0.46f, cx - w * 0.48f, cy - h * 0.30f);
            book.lineTo(cx - w * 0.48f, cy + h * 0.42f);
            book.cubicTo(cx - w * 0.26f, cy + h * 0.28f, cx - w * 0.10f, cy + h * 0.34f, cx, cy + h * 0.48f);
            book.cubicTo(cx + w * 0.10f, cy + h * 0.34f, cx + w * 0.26f, cy + h * 0.28f, cx + w * 0.48f, cy + h * 0.42f);
            book.lineTo(cx + w * 0.48f, cy - h * 0.30f);
            book.cubicTo(cx + w * 0.48f, cy - h * 0.46f, cx + w * 0.36f, cy - h * 0.54f, cx, cy - h * 0.40f);
            book.close();
            fill.setColor(withAlpha(tint, 0.20f)); c.drawPath(book, fill);
            line.setColor(withAlpha(tint, 0.98f)); line.setStrokeWidth(sw); c.drawPath(book, line);
            line.setColor(withAlpha(Color.WHITE, 0.90f)); line.setStrokeWidth(sw * 0.62f);
            c.drawLine(cx, cy - h * 0.37f, cx, cy + h * 0.40f, line);
            c.drawLine(cx - w * 0.35f, cy - h * 0.08f, cx - w * 0.10f, cy - h * 0.04f, line);
            c.drawLine(cx + w * 0.10f, cy - h * 0.04f, cx + w * 0.35f, cy - h * 0.08f, line);
            resetPaints();
        }

        void devicePhoneIcon(float cx, float cy, float size) {
            float w = size * 0.62f, h = size * 0.92f, sw = Math.max(1f, size * 0.075f);
            int tint = pal.master;
            if (!minimalStyle) iconGlow(cx, cy, size * 0.78f, tint);
            RectF phone = new RectF(cx - w * 0.5f, cy - h * 0.5f, cx + w * 0.5f, cy + h * 0.5f);
            fill.setColor(withAlpha(tint, 0.20f)); c.drawRoundRect(phone, size * 0.13f, size * 0.13f, fill);
            line.setColor(withAlpha(tint, 0.96f)); line.setStrokeWidth(sw);
            RectF outline = new RectF(phone); outline.inset(sw * 0.5f, sw * 0.5f);
            c.drawRoundRect(outline, size * 0.12f, size * 0.12f, line);
            line.setColor(withAlpha(Color.WHITE, 0.92f)); line.setStrokeWidth(sw * 0.65f);
            c.drawLine(cx - w * 0.24f, cy - h * 0.30f, cx + w * 0.24f, cy - h * 0.30f, line);
            c.drawCircle(cx, cy + h * 0.34f, sw * 0.58f, fill);
            resetPaints();
        }

        void drawScreenTimeUpdated(ScreenTimeSection section, float right, float baseline, float size) {
            if (section == null || section.lastUpdatedAt <= 0L) return;
            java.text.SimpleDateFormat format = new java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault());
            String label = "Updated " + format.format(new java.util.Date(section.lastUpdatedAt));
            text(label, right, baseline, size * 0.82f, f.regular,
                withAlpha(Color.WHITE, 0.58f), Paint.Align.RIGHT,
                Math.max(42f * density, W * 0.55f));
        }

        String formatUsageDuration(long millis) {
            long minutes = Math.max(0L, millis) / 60000L;
            long hours = minutes / 60L;
            long remainder = minutes % 60L;
            if (hours > 0L) return hours + " hr " + remainder + " min";
            return minutes + " min";
        }

        void drawUpdatePill() {
            if (!o.update || d.updateLabel == null || d.updateLabel.length() == 0) return;
            float h = clamp(card.height() * 0.13f, 12f * density, 20f * density);
            float size = h * 0.52f;
            float w = measure(d.updateLabel, size, f.bold) + h * 0.9f;
            RectF r = rect(card.right - w - h * 0.55f, card.top + h * 0.5f, card.right - h * 0.55f, card.top + h * 1.5f);
            fill.setColor(withAlpha(pal.master, 0.22f));
            c.drawRoundRect(r, h * 0.5f, h * 0.5f, fill);
            line.setColor(withAlpha(pal.master, 0.85f)); line.setStrokeWidth(Math.max(1f, density * 0.9f));
            c.drawRoundRect(r, h * 0.5f, h * 0.5f, line);
            resetPaints();
            text(d.updateLabel, r.centerX(), r.centerY() + size * 0.36f, size, f.bold,
                Color.WHITE, Paint.Align.CENTER, r.width() - h * 0.4f);
        }

        // ---- glass surfaces
        void glass(RectF r, float radius) {
            fill.setColor(withAlpha(o.themeMatched && o.lightMode ? Color.WHITE : Color.BLACK,
                o.themeMatched && o.lightMode ? 0.42f : 0.12f));
            c.drawRoundRect(r, radius, radius, fill);
            fill.setShader(new LinearGradient(r.left, r.top, r.left, r.bottom,
                withAlpha(Color.WHITE, o.themeMatched && o.lightMode ? 0.58f : 0.12f),
                withAlpha(Color.WHITE, o.themeMatched && o.lightMode ? 0.32f : 0.035f), Shader.TileMode.CLAMP));
            c.drawRoundRect(r, radius, radius, fill);
            fill.setShader(null);
            RectF in = new RectF(r);
            float sw = Math.max(1f, 1.05f * density);
            in.inset(sw * 0.5f, sw * 0.5f);
            int edge = hasScreenTime() || (o.themeMatched && o.lightMode) ? pal.borderA : Color.WHITE;
            line.setShader(new LinearGradient(r.left, r.top, r.right, r.bottom,
                new int[] { withAlpha(edge, 0.80f), withAlpha(edge, 0.25f), withAlpha(edge, 0.48f) },
                new float[] { 0f, 0.55f, 1f }, Shader.TileMode.CLAMP));
            line.setStrokeWidth(sw);
            c.drawRoundRect(in, radius, radius, line);
            resetPaints();
        }

        float panelRadius(RectF r) { return Math.min(0.22f * r.height(), 0.5f * r.height()); }

        BlurMaskFilter blur(float radius) { return new BlurMaskFilter(Math.max(0.5f, radius), BlurMaskFilter.Blur.NORMAL); }

        // ---- progress ring
        void ring(float cx, float cy, float outerR, float sw, int progress, boolean label) {
            float r = outerR - sw * 0.5f;
            float frac = clamp(progress / 100f, 0f, 1f);
            RectF oval = new RectF(cx - r, cy - r, cx + r, cy + r);

            if (!minimalStyle) {
                line.setStrokeWidth(sw * 1.15f); line.setColor(withAlpha(pal.glow, 0.42f)); line.setMaskFilter(blur(sw * 0.95f));
                c.drawCircle(cx, cy, r, line);
                resetPaints();
            }
            fill.setColor(withAlpha(Color.BLACK, 0.20f));
            c.drawCircle(cx, cy, r - sw * 0.35f, fill);
            resetPaints();

            // empty track + faint rim lights
            line.setStrokeWidth(sw); line.setColor(withAlpha(pal.track, Math.min(1f, Color.alpha(pal.track) / 255f * 1.25f)));
            c.drawCircle(cx, cy, r, line);
            line.setStrokeWidth(Math.max(1f, density * 0.8f)); line.setColor(withAlpha(Color.WHITE, 0.16f));
            c.drawCircle(cx, cy, r + sw * 0.5f - line.getStrokeWidth() * 0.5f, line);
            resetPaints();

            if (frac > 0f) {
                float s = Math.max(frac, 0.02f);
                SweepGradient sweep = new SweepGradient(cx, cy, new int[] { pal.ring0, pal.ring1, pal.ring2 }, new float[] { 0f, s * 0.5f, s });
                c.save();
                c.rotate(-90f, cx, cy);
                if (!minimalStyle) {
                    line.setShader(sweep); line.setStrokeWidth(sw * 1.1f); line.setAlpha(235); line.setMaskFilter(blur(sw * 0.7f));
                    c.drawArc(oval, 0f, frac * 360f, false, line);
                    line.setMaskFilter(null);
                }
                line.setShader(sweep); line.setStrokeWidth(sw); line.setAlpha(255);
                c.drawArc(oval, 0f, frac * 360f, false, line);
                c.restore();
                resetPaints();
                // bright dot on the start cap, like the reference
                fill.setColor(withAlpha(Color.WHITE, 0.85f));
                c.drawCircle(cx + sw * 0.10f, cy - r, sw * 0.13f, fill);
                resetPaints();
            }

            if (!label) return;
            float diameter = outerR * 2f;
            float numSize = diameter * 0.305f;
            float pctSize = numSize * 0.62f;
            float capH = numSize * 0.70f;
            float labelSize = diameter * 0.10f;
            float gap = diameter * 0.09f;
            float blockH = capH + gap + labelSize * 0.70f;
            float top = cy - blockH * 0.5f;
            float baseline = top + capH;
            String num = String.valueOf(progress);
            float wn = measure(num, numSize, f.bold);
            float wp = measure("%", pctSize, f.bold);
            float gapX = numSize * 0.03f;
            float maxW = (r - sw * 0.5f) * 1.7f;
            float scale = Math.min(1f, maxW / (wn + wp + gapX));
            numSize *= scale; pctSize *= scale; wn *= scale; wp *= scale;
            float x0 = cx - (wn + wp + gapX) * 0.5f;
            txt.setShader(null); txt.setTypeface(f.bold); txt.setTextAlign(Paint.Align.LEFT); txt.setStyle(Paint.Style.FILL); txt.setLetterSpacing(0f);
            txt.setTextSize(numSize); txt.setColor(Color.WHITE); txt.setShadowLayer(numSize * 0.05f, 0f, numSize * 0.025f, withAlpha(Color.BLACK, 0.45f));
            c.drawText(num, x0, baseline, txt);
            txt.setTextSize(pctSize); txt.setColor(pal.soft);
            c.drawText("%", x0 + wn + gapX, baseline, txt);
            txt.clearShadowLayer();
            if (outerR > 24f * density) {
                text("Completed", cx, baseline + gap + labelSize * 0.70f, labelSize, f.regular, withAlpha(Color.WHITE, 0.96f), Paint.Align.CENTER, (r - sw * 0.5f) * 1.7f);
            }
        }

        // ---- glow helper for icons
        void iconGlow(float cx, float cy, float r, int color) {
            if (r <= 0.5f) return;
            fill.setShader(new RadialGradient(cx, cy, r, new int[] { withAlpha(color, 0.55f), withAlpha(color, 0f) }, new float[] { 0f, 1f }, Shader.TileMode.CLAMP));
            c.drawCircle(cx, cy, r, fill);
            resetPaints();
        }

        // ---- icons (all drawn from paths, so they never depend on fonts or emoji support)
        void clockIcon(float cx, float cy, float s) {
            float r = s * 0.37f;
            float sw = s * 0.105f;
            if (!minimalStyle) iconGlow(cx, cy, s * 0.62f, hex("#2F8CFF"));
            fill.setColor(withAlpha(hex("#06204F"), 0.55f));
            c.drawCircle(cx, cy, r, fill);
            line.setShader(new LinearGradient(cx - r, cy - r, cx + r, cy + r, hex("#5CE6FF"), hex("#2B74FF"), Shader.TileMode.CLAMP));
            line.setStrokeWidth(sw);
            c.drawCircle(cx, cy, r, line);
            resetPaints();
            line.setColor(hex("#D8F2FF")); line.setStrokeWidth(sw * 0.62f);
            c.drawLine(cx, cy, cx, cy - r * 0.60f, line);
            c.drawLine(cx, cy, cx + r * 0.46f, cy + r * 0.20f, line);
            line.setStrokeWidth(sw * 0.5f); line.setColor(withAlpha(hex("#9FDBFF"), 0.9f));
            for (int i = 0; i < 4; i++) {
                double a = Math.PI / 2 * i;
                float ix = (float) Math.cos(a), iy = (float) Math.sin(a);
                c.drawLine(cx + ix * r * 0.74f, cy + iy * r * 0.74f, cx + ix * r * 0.84f, cy + iy * r * 0.84f, line);
            }
            line.setColor(hex("#49D8FF")); line.setStrokeWidth(sw * 0.95f);
            c.drawLine(cx + r * 0.72f, cy - r * 0.72f, cx + r * 1.12f, cy - r * 1.12f, line);
            resetPaints();
        }

        Path flamePath(float ox, float oy, float k, float fx, float fy) {
            float[][] pts = {
                { 50f, 118f }, { 20f, 118f }, { 4f, 94f }, { 8f, 68f },
                { 11f, 50f }, { 24f, 42f }, { 26f, 24f },
                { 38f, 34f }, { 40f, 44f }, { 42f, 50f },
                { 44f, 30f }, { 52f, 12f }, { 62f, 0f },
                { 66f, 20f }, { 90f, 40f }, { 92f, 72f },
                { 94f, 98f }, { 78f, 118f }, { 50f, 118f }
            };
            float[] x = new float[pts.length], y = new float[pts.length];
            for (int i = 0; i < pts.length; i++) {
                x[i] = ox + (50f + (pts[i][0] - 50f) * fx) * k;
                y[i] = oy + (118f + (pts[i][1] - 118f) * fy) * k;
            }
            Path p = new Path();
            p.moveTo(x[0], y[0]);
            p.cubicTo(x[1], y[1], x[2], y[2], x[3], y[3]);
            p.cubicTo(x[4], y[4], x[5], y[5], x[6], y[6]);
            p.cubicTo(x[7], y[7], x[8], y[8], x[9], y[9]);
            p.cubicTo(x[10], y[10], x[11], y[11], x[12], y[12]);
            p.cubicTo(x[13], y[13], x[14], y[14], x[15], y[15]);
            p.cubicTo(x[16], y[16], x[17], y[17], x[18], y[18]);
            p.close();
            return p;
        }

        void flameIcon(float cx, float cy, float s) {
            float k = s / 120f;
            float ox = cx - 50f * k, oy = cy - 60f * k;
            if (!minimalStyle) iconGlow(cx, cy + s * 0.06f, s * 0.72f, hex("#FF7A1A"));
            fill.setShader(new LinearGradient(0f, oy, 0f, oy + 118f * k,
                new int[] { hex("#FFC02E"), hex("#FF7A1C"), hex("#EC3B1B") }, new float[] { 0f, 0.5f, 1f }, Shader.TileMode.CLAMP));
            c.drawPath(flamePath(ox, oy, k, 1f, 1f), fill);
            fill.setShader(new LinearGradient(0f, oy + 40f * k, 0f, oy + 118f * k,
                new int[] { hex("#FFE76A"), hex("#FFAA2A") }, new float[] { 0f, 1f }, Shader.TileMode.CLAMP));
            c.drawPath(flamePath(ox, oy, k, 0.70f, 0.66f), fill);
            fill.setShader(new LinearGradient(0f, oy + 70f * k, 0f, oy + 118f * k,
                new int[] { hex("#FFFBE2"), hex("#FFE98A") }, new float[] { 0f, 1f }, Shader.TileMode.CLAMP));
            c.drawPath(flamePath(ox, oy, k, 0.40f, 0.36f), fill);
            resetPaints();
        }

        void targetIcon(float cx, float cy, float s) {
            float r = s * 0.46f;
            if (!minimalStyle) iconGlow(cx, cy, s * 0.7f, hex("#FF3B55"));
            fill.setColor(hex("#F0334C")); c.drawCircle(cx, cy, r, fill);
            fill.setColor(Color.WHITE); c.drawCircle(cx, cy, r * 0.76f, fill);
            fill.setColor(hex("#F0334C")); c.drawCircle(cx, cy, r * 0.54f, fill);
            fill.setColor(Color.WHITE); c.drawCircle(cx, cy, r * 0.32f, fill);
            fill.setColor(hex("#F0334C")); c.drawCircle(cx, cy, r * 0.15f, fill);
            line.setColor(hex("#1B2A55")); line.setStrokeWidth(s * 0.07f);
            c.drawLine(cx, cy, cx + r * 0.95f, cy - r * 0.95f, line);
            line.setColor(Color.WHITE); line.setStrokeWidth(s * 0.06f);
            c.drawLine(cx + r * 0.78f, cy - r * 0.78f, cx + r * 1.08f, cy - r * 1.08f, line);
            resetPaints();
        }

        void calendarIcon(float cx, float cy, float s) {
            float w = s * 0.86f, h = s * 0.80f, sw = s * 0.085f;
            RectF body = new RectF(cx - w / 2f, cy - h / 2f + s * 0.06f, cx + w / 2f, cy + h / 2f + s * 0.06f);
            int cyan = hex("#2AD8F6");
            if (!minimalStyle) iconGlow(cx, cy, s * 0.65f, cyan);
            fill.setColor(withAlpha(cyan, 0.20f));
            c.drawRoundRect(body, s * 0.14f, s * 0.14f, fill);
            line.setColor(cyan); line.setStrokeWidth(sw);
            RectF stroke = new RectF(body); stroke.inset(sw * 0.5f, sw * 0.5f);
            c.drawRoundRect(stroke, s * 0.13f, s * 0.13f, line);
            c.drawLine(body.left + sw * 0.5f, body.top + h * 0.28f, body.right - sw * 0.5f, body.top + h * 0.28f, line);
            c.drawLine(body.left + w * 0.28f, body.top - s * 0.04f, body.left + w * 0.28f, body.top + h * 0.12f, line);
            c.drawLine(body.right - w * 0.28f, body.top - s * 0.04f, body.right - w * 0.28f, body.top + h * 0.12f, line);
            resetPaints();
            fill.setColor(cyan);
            for (int row = 0; row < 2; row++) for (int col = 0; col < 3; col++) {
                float dx = body.left + w * (0.24f + 0.26f * col), dy = body.top + h * (0.47f + 0.24f * row);
                c.drawRoundRect(new RectF(dx - s * 0.05f, dy - s * 0.05f, dx + s * 0.05f, dy + s * 0.05f), s * 0.02f, s * 0.02f, fill);
            }
            resetPaints();
        }

        void barsIcon(float cx, float cy, float s) {
            float bw = s * 0.23f, gap = s * 0.09f;
            float x0 = cx - (bw * 3f + gap * 2f) / 2f;
            float bottom = cy + s * 0.48f;
            float[] hs = { 0.42f, 0.70f, 0.96f };
            if (!minimalStyle) iconGlow(cx, cy, s * 0.7f, hex("#2BE58A"));
            for (int i = 0; i < 3; i++) {
                float left = x0 + i * (bw + gap);
                RectF bar = new RectF(left, bottom - hs[i] * s, left + bw, bottom);
                fill.setShader(new LinearGradient(0f, bar.top, 0f, bar.bottom, hex("#9CFB62"), hex("#18CF82"), Shader.TileMode.CLAMP));
                c.drawRoundRect(bar, bw * 0.38f, bw * 0.38f, fill);
            }
            resetPaints();
        }

        void chevron(float cx, float cy, float s, int color) {
            Path p = new Path();
            p.moveTo(cx - s * 0.22f, cy - s * 0.42f);
            p.lineTo(cx + s * 0.22f, cy);
            p.lineTo(cx - s * 0.22f, cy + s * 0.42f);
            line.setColor(color); line.setStrokeWidth(s * 0.17f);
            c.drawPath(p, line);
            resetPaints();
        }

        void checkCircle(float cx, float cy, float r, boolean done) {
            if (done) {
                if (!minimalStyle) iconGlow(cx, cy, r * 1.9f, hex("#22E46A"));
                fill.setShader(new LinearGradient(cx, cy - r, cx, cy + r, hex("#4BF27F"), hex("#10B64A"), Shader.TileMode.CLAMP));
                c.drawCircle(cx, cy, r, fill);
                resetPaints();
                Path p = new Path();
                p.moveTo(cx - r * 0.42f, cy + r * 0.02f);
                p.lineTo(cx - r * 0.10f, cy + r * 0.34f);
                p.lineTo(cx + r * 0.46f, cy - r * 0.32f);
                line.setColor(Color.WHITE); line.setStrokeWidth(r * 0.30f);
                c.drawPath(p, line);
            } else {
                fill.setColor(withAlpha(hex("#7C90B0"), 0.34f));
                c.drawCircle(cx, cy, r, fill);
                line.setColor(withAlpha(Color.WHITE, 0.42f)); line.setStrokeWidth(Math.max(1f, density * 1.1f));
                c.drawCircle(cx, cy, r - line.getStrokeWidth() * 0.5f, line);
            }
            resetPaints();
        }

        // ---- brand mark: four colourful operator tiles
        void logo(RectF r) {
            float gap = r.width() * 0.07f;
            float tw = (r.width() - gap) / 2f, th = (r.height() - gap) / 2f;
            float rad = Math.min(tw, th) * 0.27f;
            int[][] cols = {
                { hex("#F6F23C"), hex("#9AD316") }, { hex("#44D6FA"), hex("#1C86EE") },
                { hex("#FF6E6E"), hex("#E0243A") }, { hex("#3BE6A6"), hex("#12AF78") }
            };
            for (int i = 0; i < 4; i++) {
                float x = r.left + (i % 2) * (tw + gap), y = r.top + (i / 2) * (th + gap);
                RectF t = new RectF(x, y, x + tw, y + th);
                fill.setShader(new LinearGradient(0f, t.top, 0f, t.bottom, cols[i][0], cols[i][1], Shader.TileMode.CLAMP));
                c.drawRoundRect(t, rad, rad, fill);
                fill.setShader(new LinearGradient(0f, t.top, 0f, t.top + th * 0.55f, withAlpha(Color.WHITE, 0.38f), withAlpha(Color.WHITE, 0f), Shader.TileMode.CLAMP));
                c.drawRoundRect(t, rad, rad, fill);
                line.setColor(withAlpha(Color.WHITE, 0.55f)); line.setStrokeWidth(Math.max(1f, density * 0.7f));
                RectF in = new RectF(t); in.inset(line.getStrokeWidth() * 0.5f, line.getStrokeWidth() * 0.5f);
                c.drawRoundRect(in, rad, rad, line);
                resetPaints();
                float cx = t.centerX(), cy = t.centerY(), q = Math.min(tw, th) * 0.26f;
                line.setStrokeWidth(Math.min(tw, th) * 0.13f);
                if (i == 0) {
                    line.setColor(hex("#12295C"));
                    c.drawLine(cx - q, cy, cx + q, cy, line); c.drawLine(cx, cy - q, cx, cy + q, line);
                } else if (i == 1) {
                    line.setColor(Color.WHITE);
                    c.drawLine(cx - q, cy, cx + q, cy, line);
                } else if (i == 2) {
                    line.setColor(Color.WHITE);
                    c.drawLine(cx - q * 0.9f, cy - q * 0.9f, cx + q * 0.9f, cy + q * 0.9f, line);
                    c.drawLine(cx - q * 0.9f, cy + q * 0.9f, cx + q * 0.9f, cy - q * 0.9f, line);
                } else {
                    line.setColor(Color.WHITE);
                    line.setStrokeWidth(Math.min(tw, th) * 0.11f);
                    c.drawLine(cx - q * 0.95f, cy, cx + q * 0.95f, cy, line);
                    Path up = new Path();
                    up.moveTo(cx - q * 0.62f, cy - q * 0.62f); up.lineTo(cx, cy - q * 1.22f); up.lineTo(cx + q * 0.62f, cy - q * 0.62f);
                    c.drawPath(up, line);
                    Path dn = new Path();
                    dn.moveTo(cx - q * 0.62f, cy + q * 0.62f); dn.lineTo(cx, cy + q * 1.22f); dn.lineTo(cx + q * 0.62f, cy + q * 0.62f);
                    c.drawPath(dn, line);
                }
                resetPaints();
            }
        }

        // ---- header
        void header(RectF logoRect, float titleX, float titleBase, float titleSize, float tagBase, float tagSize, float maxRight) {
            logo(logoRect);
            String a = "MATH", b = "MASTER";
            tracking = -0.02f;
            float gapW = titleSize * 0.30f;
            float total = measure(a, titleSize, f.bold) + gapW + measure(b, titleSize, f.bold);
            float maxW = Math.max(10f, maxRight - titleX);
            float size = total > maxW ? titleSize * maxW / total : titleSize;
            float wa = measure(a, size, f.bold);
            text(a, titleX, titleBase, size, f.bold, Color.WHITE, Paint.Align.LEFT, 0f);
            text(b, titleX + wa + size * 0.30f, titleBase, size, f.bold, pal.master, Paint.Align.LEFT, 0f);
            tracking = 0f;
            if (tagSize > 0f && !compactStyle) {
                text("Learn  \u00B7  Practice  \u00B7  Quiz  \u00B7  Grow", titleX + size * 0.02f, tagBase, tagSize, f.regular, withAlpha(hex("#CFEAFF"), 0.96f), Paint.Align.LEFT, maxW);
            }
        }

        // ---- panels
        RectF fit(RectF r, float maxH) {
            if (r.height() <= maxH) return r;
            float mid = r.centerY();
            return new RectF(r.left, mid - maxH * 0.5f, r.right, mid + maxH * 0.5f);
        }

        void progressBar(RectF r, int progress) {
            float rad = r.height() * 0.5f;
            fill.setColor(withAlpha(Color.BLACK, 0.26f));
            c.drawRoundRect(r, rad, rad, fill);
            line.setColor(withAlpha(Color.WHITE, 0.14f)); line.setStrokeWidth(Math.max(1f, density * 0.8f));
            RectF e = new RectF(r); e.inset(0.5f * density, 0.5f * density);
            c.drawRoundRect(e, rad, rad, line);
            resetPaints();
            float frac = clamp(progress / 100f, 0f, 1f);
            if (frac <= 0f) return;
            RectF fr = new RectF(r.left, r.top, r.left + Math.max(r.height(), r.width() * frac), r.bottom);
            if (!minimalStyle) {
                fill.setShader(new LinearGradient(fr.left, 0f, fr.right, 0f, withAlpha(pal.bar0, 0.7f), withAlpha(pal.bar1, 0.7f), Shader.TileMode.CLAMP));
                fill.setMaskFilter(blur(r.height() * 0.5f));
                c.drawRoundRect(fr, rad, rad, fill);
                resetPaints();
            }
            fill.setShader(new LinearGradient(fr.left, 0f, fr.right, 0f, pal.bar0, pal.bar1, Shader.TileMode.CLAMP));
            c.drawRoundRect(fr, rad, rad, fill);
            resetPaints();
            fill.setColor(withAlpha(Color.WHITE, 0.9f));
            c.drawCircle(fr.right - rad * 0.55f, fr.top + rad * 0.55f, rad * 0.17f, fill);
            resetPaints();
        }

        void targetPanel(RectF full, boolean bar) {
            glass(full, panelRadius(full));
            RectF r = fit(full, capH);
            float h = r.height();
            float iconS = h * (bar ? 0.56f : 0.46f);
            float icx = r.left + h * 0.14f + iconS * 0.5f;
            float icy = bar ? r.top + h * 0.33f : r.centerY();
            clockIcon(icx, icy, iconS);
            float tx = icx + iconS * 0.5f + h * (bar ? 0.14f : 0.12f);
            float avail = r.right - tx - h * 0.09f;
            boolean complete = d.progress >= 100;
            int shown = Math.min(d.elapsedMinutes, d.targetMinutes);
            String nums, unit = "min", label;
            if (o.target) {
                nums = shown + " / " + d.targetMinutes;
                label = "Today's Target";
            } else if (o.studyTime && o.remaining) {
                nums = String.valueOf(d.elapsedMinutes);
                label = complete ? "Target complete!" : d.remainingMinutes + " min left";
            } else if (o.remaining) {
                nums = complete ? "Done!" : String.valueOf(d.remainingMinutes);
                unit = complete ? null : "min";
                label = complete ? "Target complete" : "Left today";
            } else {
                nums = String.valueOf(d.elapsedMinutes);
                label = "Studied today";
            }
            String value = unit == null ? nums : nums + " " + unit;
            float vs = Math.min(valueRef * su, h * 0.34f);
            float ls = Math.min(labelRef * su, h * 0.24f);
            if (bar) {
                text(label, tx, r.top + h * 0.27f, ls * 1.08f, f.regular, withAlpha(Color.WHITE, 0.94f), Paint.Align.LEFT, avail);
                text(value, tx, r.top + h * 0.62f, vs, f.bold, Color.WHITE, Paint.Align.LEFT, avail);
                float inset = h * 0.17f;
                progressBar(new RectF(r.left + inset, r.top + h * 0.755f, r.right - inset, r.top + h * 0.91f), d.progress);
            } else if (unit != null && (twoLineTarget || measure(value, vs, f.bold) > avail)) {
                text(nums, tx, r.top + h * 0.485f, vs, f.bold, Color.WHITE, Paint.Align.LEFT, avail);
                text(unit, tx, r.top + h * 0.485f + ls * 1.40f, ls, f.regular, withAlpha(Color.WHITE, 0.92f), Paint.Align.LEFT, avail);
            } else {
                text(value, tx, r.top + h * 0.50f, vs, f.bold, Color.WHITE, Paint.Align.LEFT, avail);
                text(label, tx, r.top + h * 0.79f, ls, f.regular, withAlpha(Color.WHITE, 0.92f), Paint.Align.LEFT, avail);
            }
        }

        void streakPanel(RectF full) {
            glass(full, panelRadius(full));
            RectF r = fit(full, capH);
            float h = r.height();
            float iconS = h * 0.52f;
            float icx = r.left + h * 0.15f + iconS * 0.5f;
            flameIcon(icx, r.centerY(), iconS * 1.12f);
            float tx = icx + iconS * 0.5f + h * 0.10f;
            float avail = r.right - tx - h * 0.07f;
            float ns = Math.min(numRef * su, h * 0.46f), ls = Math.min(labelRef * su, h * 0.24f);
            String label = (!shortStreak && measure("Day Streak", ls, f.regular) <= avail * 1.12f) ? "Day Streak" : "Streak";
            text(String.valueOf(d.streak), tx, r.top + h * 0.51f, ns, f.bold, Color.WHITE, Paint.Align.LEFT, avail);
            text(label, tx, r.top + h * 0.755f, ls, f.regular, withAlpha(Color.WHITE, 0.94f), Paint.Align.LEFT, avail);
        }

        void weekStrip(RectF r, float letterRef, float circleRef, float letterBaseFrac, float circleCyFrac) {
            float h = r.height();
            glass(r, Math.min(0.27f * h, 0.5f * h));
            float pad = Math.max(0.035f * r.width(), 0.16f * h);
            float colW = (r.width() - 2f * pad) / 7f;
            float rad = Math.min(Math.min(circleRef * su, 0.24f * h), colW * 0.44f);
            float ls = Math.min(Math.min(letterRef * su, 0.31f * h), colW * 0.52f);
            for (int i = 0; i < 7; i++) {
                float cx = r.left + pad + colW * (i + 0.5f);
                text(d.dayLetters[i], cx, r.top + h * letterBaseFrac + ls * 0.36f, ls, f.bold, Color.WHITE, Paint.Align.CENTER, 0f);
                checkCircle(cx, r.top + h * circleCyFrac, rad, d.weekDone[i]);
            }
        }

        void quizTile(RectF full, float refSize) {
            glass(full, panelRadius(full));
            RectF r = fit(full, capH);
            float h = r.height();
            targetIcon(r.left + h * 0.46f, r.centerY(), h * 0.62f);
            float tx = r.left + h * 0.98f;
            float chevS = h * 0.24f;
            float avail = r.right - tx - chevS * 1.6f - h * 0.08f;
            float s = Math.min(h * 0.30f, refSize * su);
            text("Upcoming Quiz", tx, r.top + h * 0.43f, s, f.medium, Color.WHITE, Paint.Align.LEFT, avail);
            text("5 Questions", tx, r.top + h * 0.75f, s, f.regular, withAlpha(Color.WHITE, 0.95f), Paint.Align.LEFT, avail);
            chevron(r.right - h * 0.30f, r.centerY(), chevS, Color.WHITE);
        }

        // ---- layout plumbing: reference frame -> real pixels
        float refW, refH, sx, sy, su, ox, oy;
        float bodyTopRef, bodyBotRef, padTopRef, kBody = 1f;

        void frame(float rw, float rh) {
            refW = rw; refH = rh; ox = card.left; oy = card.top;
            sx = card.width() / rw; sy = card.height() / rh; su = Math.min(sx, sy);
        }

        void body(float topRef, float botRef, float padTop, float padBot) {
            bodyTopRef = topRef; bodyBotRef = botRef; padTopRef = padTop;
            kBody = o.identity ? 1f : (refH - padTop - padBot) / (botRef - topRef);
        }

        float X(float v) { return ox + v * sx; }
        float Y(float v) { return oy + v * sy; }
        float XU(float v) { return ox + v * su; }
        float YU(float v) { return oy + v * su; }
        float YB(float v) { return o.identity ? Y(v) : Y(padTopRef + (v - bodyTopRef) * kBody); }
        RectF RB(float l, float t, float r, float b) { return new RectF(X(l), YB(t), X(r), YB(b)); }
        RectF RU(float l, float t, float w, float h) { return new RectF(XU(l), YU(t), XU(l) + w * su, YU(t) + h * su); }
        /** Ring scale: never larger than what the body height allows. */
        float ringScale() { return Math.min(sx, sy * kBody); }

        /** Splits [x0,x1] (reference px) between the present items, weighted. */
        RectF[] rowRects(float x0, float x1, float y0, float y1, float gap, float[] weights, boolean[] present) {
            int n = weights.length, count = 0;
            float sum = 0f;
            for (int i = 0; i < n; i++) if (present[i]) { count++; sum += weights[i]; }
            RectF[] out = new RectF[n];
            if (count == 0) return out;
            float total = (x1 - x0) - gap * (count - 1);
            float x = x0;
            for (int i = 0; i < n; i++) {
                if (!present[i]) continue;
                float w = total * weights[i] / sum;
                out[i] = RB(x, y0, x + w, y1);
                x += w + gap;
            }
            return out;
        }

        /** Same, stacked top to bottom. */
        RectF[] colRects(float x0, float x1, float y0, float y1, float gap, float[] weights, boolean[] present) {
            int n = weights.length, count = 0;
            float sum = 0f;
            for (int i = 0; i < n; i++) if (present[i]) { count++; sum += weights[i]; }
            RectF[] out = new RectF[n];
            if (count == 0) return out;
            float total = (y1 - y0) - gap * (count - 1);
            float y = y0;
            for (int i = 0; i < n; i++) {
                if (!present[i]) continue;
                float h = total * weights[i] / sum;
                out[i] = RB(x0, y, x1, y + h);
                y += h + gap;
            }
            return out;
        }

        boolean hasTarget() { return o.target || o.studyTime || o.remaining; }

        float capH = 1e9f;

        void ringAt(float cxRef, float cyRef, float rRef) {
            float rr = rRef * ringScale();
            ring(X(cxRef), YB(cyRef), rr, rr * 0.204f, d.progress, true);
        }

        void chevronButton(float cx, float cy, float r) {
            glass(new RectF(cx - r, cy - r, cx + r, cy + r), r);
            chevron(cx + r * 0.06f, cy, r * 0.78f, Color.WHITE);
        }

        // ================================================================ compositions

        /** hero_wide: header, big ring, target + streak, weekly strip, quiz tile. */
        void layoutHero() {
            frame(858f, 384f);
            labelRef = 21f; valueRef = 33f; numRef = 46f;
            body(128f, 372f, 16f, 12f);
            capH = 126f * su * 1.3f;
            if (hasScreenTime()) { layoutScreenTimeReflow(858f, 384f); drawUpdatePill(); return; }
            boolean ring = o.progress, tg = hasTarget(), st = o.streak, wk = o.weekly, qz = o.quiz;
            if (o.identity) header(RU(38f, 25f, 97f, 87f), XU(157f), YU(72f), 42.5f * su, YU(105f), 23f * su, X(836f));
            boolean row1 = tg || st, row2 = wk || qz;
            float y1a = 134f, y1b = 260f, y2a = 277f, y2b = 366f;
            if (row1 && !row2) y1b = 366f;
            if (!row1 && row2) y2a = 134f;
            if (ring) ringAt(133f, 235f, 113f);
            RectF[] a = rowRects(ring ? 267f : 24f, 841f, y1a, y1b, 12f, new float[] { 351f, 211f }, new boolean[] { tg, st });
            RectF[] b = rowRects(ring ? 242f : 24f, 841f, y2a, y2b, 13f, new float[] { 347f, 239f }, new boolean[] { wk, qz });
            if (a[0] != null) targetPanel(a[0], true);
            if (a[1] != null) streakPanel(a[1]);
            if (b[0] != null) weekStrip(b[0], 22.5f, 16f, 0.36f, 0.69f);
            if (b[1] != null) quizTile(b[1], 19f);
        }

        /** compact_green: header, ring and two stacked panels. */
        void layoutGreen() {
            frame(493f, 341f);
            labelRef = 18.5f; valueRef = 22.5f; numRef = 33f;
            body(112f, 326f, 16f, 14f);
            capH = 94f * su * 1.3f;
            if (hasScreenTime()) { layoutScreenTimeReflow(493f, 341f); drawUpdatePill(); return; }
            boolean ring = o.progress, tg = hasTarget(), st = o.streak;
            if (o.identity) header(RU(38f, 22f, 83f, 76f), XU(137f), YU(60f), 32f * su, YU(90f), 21f * su, X(478f));
            if (ring) ringAt(135f, 214f, 102f);
            RectF[] col = colRects(ring ? 247f : 27f, 466f, 118f, 318f, 12f, new float[] { 1f, 1f }, new boolean[] { tg, st });
            if (col[0] != null) targetPanel(col[0], false);
            if (col[1] != null) streakPanel(col[1]);
        }

        /** square_math_bot: header, ring, two panels and the quiz tile along the bottom. */
        void layoutMathBot() {
            frame(428f, 371f);
            labelRef = 20f; valueRef = 24f; numRef = 28f;
            body(96f, 356f, 14f, 14f);
            capH = 88f * su * 1.3f;
            if (hasScreenTime()) { layoutScreenTimeReflow(428f, 371f); drawUpdatePill(); return; }
            boolean ring = o.progress, tg = hasTarget(), st = o.streak, qz = o.quiz;
            if (o.identity) header(RU(42f, 22f, 71f, 66f), XU(132f), YU(53f), 28.5f * su, YU(80f), 16.5f * su, X(412f));
            float bottom = qz ? 277f : 349f;
            if (ring) ringAt(122f, (100f + bottom) / 2f, Math.min(95f, (bottom - 100f) / 2f));
            RectF[] col = colRects(ring ? 236f : 21f, 407f, 105f, bottom, 10f, new float[] { 1f, 1f }, new boolean[] { tg, st });
            if (col[0] != null) targetPanel(col[0], false);
            if (col[1] != null) streakPanel(col[1]);
            if (qz) quizTile(RB(21f, 290f, 407f, 355f), 19.5f);
        }

        /** square_cosmic: header, ring, two panels and the weekly strip along the bottom. */
        void layoutCosmic() {
            frame(548f, 371f);
            labelRef = 19f; valueRef = 23.5f; numRef = 31f;
            body(96f, 356f, 14f, 14f);
            capH = 86f * su * 1.3f;
            if (hasScreenTime()) { layoutScreenTimeReflow(548f, 371f); drawUpdatePill(); return; }
            boolean ring = o.progress, tg = hasTarget(), st = o.streak, wk = o.weekly;
            if (o.identity) header(RU(39f, 20f, 75f, 68f), XU(139f), YU(50f), 31f * su, YU(79f), 17f * su, X(530f));
            float bottom = wk ? 284f : 350f;
            if (ring) ringAt(131f, (98f + bottom) / 2f, Math.min(95f, (bottom - 98f) / 2f));
            RectF[] col = colRects(ring ? 251f : 27f, 524f, 100f, bottom, 10f, new float[] { 1f, 1f }, new boolean[] { tg, st });
            if (col[0] != null) targetPanel(col[0], false);
            if (col[1] != null) streakPanel(col[1]);
            if (wk) weekStrip(RB(27f, 293f, 524f, 363f), 22f, 16.5f, 0.34f, 0.71f);
        }

        /** medium_study: compact magenta card, header, ring and two panels. */
        void layoutStudy() {
            frame(369f, 336f);
            labelRef = 18.5f; valueRef = 24f; numRef = 27f;
            body(104f, 320f, 14f, 16f);
            capH = 84f * su * 1.3f;
            if (hasScreenTime()) { layoutScreenTimeReflow(369f, 336f); drawUpdatePill(); return; }
            boolean ring = o.progress, tg = hasTarget(), st = o.streak;
            if (o.identity) header(RU(36f, 24f, 72f, 68f), XU(124f), YU(56f), 26.5f * su, YU(82f), 14.5f * su, X(354f));
            if (ring) ringAt(114f, 214f, 93f);
            RectF[] col = colRects(ring ? 200f : 20f, 352f, 112f, 298f, 10f, new float[] { 1f, 1f }, new boolean[] { tg, st });
            if (col[0] != null && col[1] != null && ring) col[1].left = X(214f);
            if (col[0] != null) targetPanel(col[0], false);
            if (col[1] != null) streakPanel(col[1]);
        }

        /** extra_wide_weekly: one-row dashboard, week strip in the middle. */
        void layoutWeekly() {
            frame(1073f, 156f);
            labelRef = 17.5f; valueRef = 24f; numRef = 28f;
            body(54f, 146f, 12f, 12f);
            capH = 86f * su * 1.3f;
            if (hasScreenTime()) { layoutScreenTimeReflow(1073f, 156f); drawUpdatePill(); return; }
            boolean wk = o.weekly, tg = hasTarget(), st = o.streak;
            if (o.identity) header(RU(40f, 20f, 54f, 54f), XU(115f), YU(46f), 25f * su, YU(70f), 12f * su, X(272f));
            float panelsLeft = 629f;
            if (wk) {
                calendarIcon(XU(60f), YB(110f), 38f * su);
                text("This Week", XU(92f), YB(110f) + 19f * su * 0.36f, 19f * su, f.medium, Color.WHITE, Paint.Align.LEFT, 170f * sx);
                weekStrip(RB(280f, 66f, 615f, 140f), 19f, 13.5f, 0.38f, 0.74f);
            } else {
                panelsLeft = 280f;
            }
            RectF[] row = rowRects(panelsLeft, 989f, 54f, 140f, 17f, new float[] { 164f, 179f }, new boolean[] { tg, st });
            if (row[0] != null) targetPanel(row[0], false);
            if (row[1] != null) streakPanel(row[1]);
            chevronButton(card.right - 43f * su, YB(97f), 24f * su);
        }

        /** minimal_progress: small card, logo and bars icon on the left, metric + streak panels. */
        void layoutMinimal() {
            frame(341f, 158f);
            labelRef = 18f; valueRef = 24f; numRef = 27f;
            body(58f, 148f, 12f, 10f);
            capH = 76f * su * 1.3f;
            if (hasScreenTime()) { layoutScreenTimeReflow(341f, 158f); drawUpdatePill(); return; }
            boolean pct = o.progress, metric = o.progress || hasTarget(), st = o.streak;
            if (o.identity) header(RU(29f, 19f, 65f, 58f), XU(111f), YU(44f), 22f * su, YU(0f), 0f, X(332f));
            boolean leftIcon = metric;
            if (leftIcon) {
                if (pct) barsIcon(XU(66f), YB(112f), 50f * su); else clockIcon(XU(66f), YB(112f), 50f * su);
            }
            float left = leftIcon ? 100f : 12f;
            RectF[] row = rowRects(left, 329f, 61f, 136f, 10f, new float[] { 105f, 114f }, new boolean[] { metric, st });
            if (row[0] != null) minimalMetricPanel(row[0]);
            if (row[1] != null) streakPanel(row[1]);
        }

        void minimalMetricPanel(RectF full) {
            glass(full, panelRadius(full));
            RectF r = fit(full, capH);
            float h = r.height();
            boolean pct = o.progress;
            float tx = r.left + h * 0.15f;
            float avail = r.right - tx - h * 0.08f;
            int shown = Math.min(d.elapsedMinutes, d.targetMinutes);
            String minutes = o.target ? shown + " / " + d.targetMinutes + " min" : d.elapsedMinutes + " min";
            if (pct) {
                float ns = h * 0.50f;
                String num = String.valueOf(d.progress);
                float wNum = measure(num, ns, f.bold);
                float wPct = measure("%", ns * 0.74f, f.bold);
                float fitScale = Math.min(1f, avail / (wNum + wPct + ns * 0.03f));
                text(num, tx, r.top + h * 0.60f, ns * fitScale, f.bold, Color.WHITE, Paint.Align.LEFT, 0f);
                text("%", tx + (wNum + ns * 0.03f) * fitScale, r.top + h * 0.60f, ns * 0.74f * fitScale, f.bold, Color.WHITE, Paint.Align.LEFT, 0f);
                if (hasTarget()) text(minutes, tx, r.top + h * 0.90f, h * 0.24f, f.medium, withAlpha(Color.WHITE, 0.94f), Paint.Align.LEFT, avail);
            } else {
                text(minutes, tx, r.centerY() + h * 0.10f, h * 0.26f, f.bold, Color.WHITE, Paint.Align.LEFT, avail);
            }
        }
    }
}
