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
        int themeAccent = 0;       // 0 = use the composition's own reference palette
        boolean lightMode = false; // Screen Time follows the active app mode
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
        boolean screenTimeShowPercent = false;
        boolean screenTimeDetailed = true;
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

    private static Palette paletteFor(String composition, int themeAccent, boolean lightMode) {
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
        if (themeAccent != 0) applyAccent(p, themeAccent, lightMode);
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
            this.pal = paletteFor(o.composition, o.themeAccent, o.lightMode);
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
            txt.setColor(color); txt.setTypeface(tf); txt.setTextAlign(align); txt.setLetterSpacing(tracking);
            txt.setTextSize(size);
            float w = txt.measureText(s);
            if (maxWidth > 0f && w > maxWidth) { txt.setTextSize(size * maxWidth / w); w = maxWidth; }
            c.drawText(s, x, baseline, txt);
            return w;
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
            if (o.studyAppsScreenTime || o.deviceAppsScreenTime) {
                if (hasLegacyWidgetContent()) layoutScreenTimeCombined();
                else layoutScreenTime();
                drawUpdatePill();
                return;
            }
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
                fill.setColor(o.lightMode ? Color.argb(164, 246, 249, 255) : Color.argb(102, 57, 67, 77));
                c.drawRoundRect(card, cardRadius, cardRadius, fill);
                RectF hairline = new RectF(card);
                hairline.inset(0.5f * density, 0.5f * density);
                line.setColor(o.lightMode ? Color.argb(150, 255, 255, 255) : Color.argb(40, 255, 255, 255));
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
        void layoutScreenTime() {
            float pad = clamp(Math.min(W, H) * 0.055f, 7f * density, 22f * density);
            float gap = Math.max(5f * density, pad * 0.65f);
            boolean study = o.studyAppsScreenTime && d.studyAppsScreenTime != null;
            boolean device = o.deviceAppsScreenTime && d.deviceAppsScreenTime != null;
            if (study && device) {
                if (W >= H * 1.32f && H >= 118f * density) {
                    float mid = W * 0.5f;
                    drawScreenTimeSection(d.studyAppsScreenTime, pad, pad, mid - gap * 0.5f, H - pad,
                        Math.max(1, o.screenTimeMaxEntries / 2));
                    drawScreenTimeSection(d.deviceAppsScreenTime, mid + gap * 0.5f, pad, W - pad, H - pad,
                        Math.max(1, o.screenTimeMaxEntries / 2));
                    line.setColor(withAlpha(Color.WHITE, 0.13f));
                    line.setStrokeWidth(Math.max(1f, density));
                    c.drawLine(mid, pad * 1.2f, mid, H - pad * 1.2f, line);
                    resetPaints();
                } else {
                    float mid = H * 0.5f;
                    drawScreenTimeSection(d.studyAppsScreenTime, pad, pad, W - pad, mid - gap * 0.5f, 1);
                    drawScreenTimeSection(d.deviceAppsScreenTime, pad, mid + gap * 0.5f, W - pad, H - pad, 1);
                    line.setColor(withAlpha(Color.WHITE, 0.13f));
                    line.setStrokeWidth(Math.max(1f, density));
                    c.drawLine(pad, mid, W - pad, mid, line);
                    resetPaints();
                }
            } else {
                ScreenTimeSection section = study ? d.studyAppsScreenTime : d.deviceAppsScreenTime;
                drawScreenTimeSection(section, pad, pad, W - pad, H - pad, o.screenTimeMaxEntries);
            }
        }

        int screenTimePrimaryText() {
            return o.lightMode ? hex("#172033") : Color.WHITE;
        }

        int screenTimeSecondaryText() {
            return withAlpha(screenTimePrimaryText(), o.lightMode ? 0.68f : 0.70f);
        }

        boolean hasLegacyWidgetContent() {
            return o.identity || o.progress || hasTarget() || o.streak || o.weekly || o.quiz;
        }

        String appendSummaryItem(String current, String item) {
            if (item == null || item.length() == 0) return current;
            return current == null || current.length() == 0 ? item : current + "  ·  " + item;
        }

        void layoutScreenTimeCombined() {
            float pad = clamp(Math.min(W, H) * 0.045f, 5f * density, 13f * density);
            float gap = Math.max(4f * density, pad * 0.65f);
            float headerHeight = Math.min(H * 0.32f, clamp(H * 0.22f, 22f * density, 46f * density));
            float sectionTop = card.top + pad + headerHeight + gap;
            drawLegacyContentSummary(card.left + pad, card.top + pad, card.right - pad, card.top + pad + headerHeight);

            boolean study = o.studyAppsScreenTime && d.studyAppsScreenTime != null;
            boolean device = o.deviceAppsScreenTime && d.deviceAppsScreenTime != null;
            float sectionBottom = card.bottom - pad;
            float sectionLeft = card.left + pad;
            float sectionRight = card.right - pad;
            float availableHeight = Math.max(8f * density, sectionBottom - sectionTop);
            if (study && device) {
                if (W >= H * 1.32f && availableHeight >= 88f * density) {
                    float mid = (sectionLeft + sectionRight) * 0.5f;
                    int each = Math.max(1, o.screenTimeMaxEntries / 2);
                    drawScreenTimeSection(d.studyAppsScreenTime, sectionLeft, sectionTop, mid - gap * 0.5f,
                        sectionBottom, each);
                    drawScreenTimeSection(d.deviceAppsScreenTime, mid + gap * 0.5f, sectionTop, sectionRight,
                        sectionBottom, each);
                    line.setColor(withAlpha(screenTimePrimaryText(), 0.13f));
                    line.setStrokeWidth(Math.max(1f, density));
                    c.drawLine(mid, sectionTop + gap, mid, sectionBottom - gap, line);
                    resetPaints();
                } else {
                    float mid = sectionTop + availableHeight * 0.5f;
                    drawScreenTimeSection(d.studyAppsScreenTime, sectionLeft, sectionTop, sectionRight,
                        mid - gap * 0.5f, 1);
                    drawScreenTimeSection(d.deviceAppsScreenTime, sectionLeft, mid + gap * 0.5f,
                        sectionRight, sectionBottom, 1);
                    line.setColor(withAlpha(screenTimePrimaryText(), 0.13f));
                    line.setStrokeWidth(Math.max(1f, density));
                    c.drawLine(sectionLeft + gap, mid, sectionRight - gap, mid, line);
                    resetPaints();
                }
            } else {
                ScreenTimeSection section = study ? d.studyAppsScreenTime : d.deviceAppsScreenTime;
                drawScreenTimeSection(section, sectionLeft, sectionTop, sectionRight, sectionBottom,
                    o.screenTimeMaxEntries);
            }
        }

        void drawLegacyContentSummary(float left, float top, float right, float bottom) {
            if (right <= left || bottom <= top) return;
            RectF panel = new RectF(left, top, right, bottom);
            glass(panel, Math.min(cardRadius * 0.38f, Math.max(5f * density, panel.height() * 0.22f)));
            float pad = clamp(panel.height() * 0.12f, 3f * density, 8f * density);
            float titleSize = clamp(panel.height() * 0.27f, 8.5f * density, 13f * density);
            float detailSize = clamp(panel.height() * 0.22f, 7f * density, 10f * density);
            float x = left + pad;
            float maxWidth = panel.width() - pad * 2f;
            float y = top + pad;
            if (o.identity) {
                text("Math Master", x, y + titleSize, titleSize, f.bold,
                    screenTimePrimaryText(), Paint.Align.LEFT, maxWidth);
                y += titleSize + pad * 0.55f;
            }

            String firstLine = "";
            if (o.progress) firstLine = appendSummaryItem(firstLine, "Progress " + d.progress + "%");
            if (o.target) firstLine = appendSummaryItem(firstLine,
                d.elapsedMinutes + " / " + d.targetMinutes + " min");
            else if (o.studyTime) firstLine = appendSummaryItem(firstLine, d.elapsedMinutes + " min studied");
            if (o.remaining) firstLine = appendSummaryItem(firstLine, d.remainingMinutes + " min left");

            String secondLine = "";
            if (o.streak) secondLine = appendSummaryItem(secondLine, "Streak " + d.streak);
            if (o.weekly) {
                int completed = 0;
                if (d.weekDone != null) for (boolean dayDone : d.weekDone) if (dayDone) completed++;
                secondLine = appendSummaryItem(secondLine, "Week " + completed + "/7");
            }
            if (o.quiz) secondLine = appendSummaryItem(secondLine, "Upcoming Quiz");

            if (firstLine.length() > 0 && y + detailSize <= bottom - pad * 0.45f) {
                text(firstLine, x, y + detailSize, detailSize, f.medium,
                    screenTimeSecondaryText(), Paint.Align.LEFT, maxWidth);
                y += detailSize + pad * 0.40f;
            }
            if (secondLine.length() > 0 && y + detailSize <= bottom - pad * 0.25f) {
                text(secondLine, x, y + detailSize, detailSize, f.medium,
                    screenTimeSecondaryText(), Paint.Align.LEFT, maxWidth);
            }
        }

        void drawScreenTimeSection(ScreenTimeSection section, float left, float top, float right, float bottom, int requestedRows) {
            if (section == null || right <= left || bottom <= top) return;
            float w = right - left;
            float h = bottom - top;
            float pad = clamp(Math.min(w, h) * 0.045f, 3f * density, 10f * density);
            RectF panel = new RectF(left, top, right, bottom);
            glass(panel, Math.min(cardRadius * 0.50f, Math.max(6f * density, h * 0.10f)));

            float titleSize = clamp(h * 0.105f, 9.5f * density, 17f * density);
            float metaSize = clamp(titleSize * 0.66f, 7f * density, 10f * density);
            float x = left + pad;
            float y = top + pad + titleSize;
            text(section.title, x, y, titleSize, f.bold, screenTimePrimaryText(), Paint.Align.LEFT, w - pad * 2f);
            text(section.periodLabel, right - pad, y, metaSize, f.medium, withAlpha(screenTimePrimaryText(), 0.72f), Paint.Align.RIGHT, w * 0.40f);

            y += metaSize + pad * 0.65f;
            if (!"ok".equals(section.status)) {
                String headline;
                String detail;
                if ("permission_required".equals(section.status)) {
                    headline = "Usage Access Required";
                    detail = "Tap widget to open Android settings";
                } else if ("no_study_apps".equals(section.status)) {
                    headline = "No Study Apps Selected";
                    detail = "Select apps in Study Mode";
                } else if ("no_visible_apps".equals(section.status)) {
                    headline = "No apps selected for display";
                    detail = "Edit app entries in Widget Studio";
                } else if ("no_usage".equals(section.status)) {
                    headline = "No screen time recorded yet.";
                    detail = "No usage was reported for this period";
                } else if ("error".equals(section.status)) {
                    headline = "Screen time unavailable";
                    detail = "Open Math Master and retry";
                } else {
                    headline = "Loading real screen time…";
                    detail = "Usage data stays on this device";
                }
                float statusSize = clamp(titleSize * 0.82f, 8f * density, 13f * density);
                text(headline, x, y + statusSize, statusSize, f.medium, screenTimePrimaryText(), Paint.Align.LEFT, w - pad * 2f);
                text(detail, x, y + statusSize * 2.15f, metaSize, f.regular, screenTimeSecondaryText(),
                    Paint.Align.LEFT, w - pad * 2f);
                drawScreenTimeUpdated(section, right - pad, bottom - pad * 0.45f, metaSize);
                return;
            }

            if (o.screenTimeShowTotal) {
                String total = formatUsageDuration(section.totalUsageMillis);
                float valueSize = clamp(h * 0.13f, 12f * density, 21f * density);
                text(total, x, y + valueSize, valueSize, f.bold, pal.master, Paint.Align.LEFT, w - pad * 2f);
                y += valueSize + pad * 0.60f;
            }

            float footerHeight = metaSize * 1.55f;
            float available = bottom - pad - footerHeight - y;
            float minRow = o.screenTimeDetailed ? 27f * density : 19f * density;
            int fitRows = Math.max(0, (int) Math.floor(available / minRow));
            int rows = Math.min(Math.min(requestedRows, section.entries.size()), fitRows);
            if (rows == 0 && available > 10f * density && !section.entries.isEmpty()) rows = 1;
            for (int i = 0; i < rows; i++) {
                ScreenTimeEntry entry = section.entries.get(i);
                float rowHeight = available / Math.max(1, rows);
                if (rowHeight > 48f * density) rowHeight = 48f * density;
                float iconSize = Math.min(21f * density, rowHeight * (o.screenTimeDetailed ? 0.62f : 0.78f));
                float iconLeft = x;
                float iconTop = y + Math.max(0f, (rowHeight - iconSize) * 0.34f);
                if (entry.icon != null && !entry.icon.isRecycled()) {
                    RectF iconBounds = new RectF(iconLeft, iconTop, iconLeft + iconSize, iconTop + iconSize);
                    fill.setColor(screenTimePrimaryText());
                    c.drawBitmap(entry.icon, null, iconBounds, fill);
                    resetPaints();
                } else {
                    fill.setColor(withAlpha(pal.master, 0.30f));
                    c.drawRoundRect(new RectF(iconLeft, iconTop, iconLeft + iconSize, iconTop + iconSize),
                        iconSize * 0.22f, iconSize * 0.22f, fill);
                    resetPaints();
                }
                float labelLeft = iconLeft + iconSize + pad * 0.60f;
                float valueRight = right - pad;
                float valueWidth = o.screenTimeShowUsage ? Math.min(w * 0.37f, 86f * density) : 0f;
                float labelMax = Math.max(8f * density, valueRight - labelLeft - valueWidth - pad * 0.4f);
                float labelBaseline = y + rowHeight * (o.screenTimeDetailed ? 0.42f : 0.68f);
                text(entry.label, labelLeft, labelBaseline, metaSize * 1.04f, f.medium,
                    screenTimePrimaryText(), Paint.Align.LEFT, labelMax);
                if (o.screenTimeShowUsage) {
                    String usageLabel = formatUsageDuration(entry.usageMillis);
                    if (o.screenTimeDetailed && o.screenTimeShowPercent) {
                        usageLabel += "  " + Math.round(entry.percent) + "%";
                    }
                    text(usageLabel, valueRight, labelBaseline,
                        metaSize * 1.02f, f.bold, screenTimePrimaryText(), Paint.Align.RIGHT, valueWidth);
                }
                if (o.screenTimeShowPercent) {
                    float barY = y + rowHeight * 0.77f;
                    float barH = Math.max(2f * density, rowHeight * 0.075f);
                    float barRight = right - pad;
                    float barLeft = labelLeft;
                    RectF track = new RectF(barLeft, barY, barRight, barY + barH);
                    float fraction = Math.max(0f, Math.min(1f, entry.percent / 100f));
                    fill.setColor(withAlpha(pal.track, 0.95f));
                    c.drawRoundRect(track, barH, barH, fill);
                    if (fraction > 0f) {
                        RectF progress = new RectF(barLeft, barY, barLeft + track.width() * fraction, barY + barH);
                        fill.setShader(new LinearGradient(progress.left, progress.top, progress.right, progress.top,
                            pal.bar0, pal.bar1, Shader.TileMode.CLAMP));
                        c.drawRoundRect(progress, barH, barH, fill);
                        fill.setShader(null);
                    }
                    resetPaints();
                }
                y += rowHeight;
                if (i < rows - 1) {
                    line.setColor(withAlpha(screenTimePrimaryText(), 0.10f));
                    line.setStrokeWidth(Math.max(1f, density * 0.65f));
                    c.drawLine(labelLeft, y, right - pad, y, line);
                    resetPaints();
                }
            }
            drawScreenTimeUpdated(section, right - pad, bottom - pad * 0.45f, metaSize);
        }

        void drawScreenTimeUpdated(ScreenTimeSection section, float right, float baseline, float size) {
            if (section == null || section.lastUpdatedAt <= 0L) return;
            java.text.SimpleDateFormat format = new java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault());
            String label = "Updated " + format.format(new java.util.Date(section.lastUpdatedAt));
            text(label, right, baseline, size * 0.82f, f.regular,
                withAlpha(screenTimePrimaryText(), o.lightMode ? 0.56f : 0.58f), Paint.Align.RIGHT,
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
                o.lightMode ? hex("#172033") : Color.WHITE, Paint.Align.CENTER, r.width() - h * 0.4f);
        }

        // ---- glass surfaces
        void glass(RectF r, float radius) {
            fill.setColor(withAlpha(Color.BLACK, o.lightMode ? 0.035f : 0.12f));
            c.drawRoundRect(r, radius, radius, fill);
            fill.setShader(new LinearGradient(r.left, r.top, r.left, r.bottom,
                withAlpha(Color.WHITE, o.lightMode ? 0.82f : 0.12f),
                withAlpha(Color.WHITE, o.lightMode ? 0.42f : 0.035f), Shader.TileMode.CLAMP));
            c.drawRoundRect(r, radius, radius, fill);
            fill.setShader(null);
            RectF in = new RectF(r);
            float sw = Math.max(1f, 1.05f * density);
            in.inset(sw * 0.5f, sw * 0.5f);
            int edge = o.lightMode ? withAlpha(pal.master, 0.42f) : Color.WHITE;
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
