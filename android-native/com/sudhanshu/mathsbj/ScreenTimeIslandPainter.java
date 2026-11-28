package com.sudhanshu.mathsbj;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;

/**
 * Canvas-only renderer for the emerald neon-glass Screen Time Island.
 *
 * Layout follows the approved reference: a fully rounded glass pill with the app icon, the app
 * name and "Screen Time · Today", a hairline divider, the big usage time, a four-bar equalizer
 * glyph and a glass bubble on the top-right rim. Everything is laid out for the expanded size and
 * revealed by the growing pill, so the collapsed state still merges with the front camera.
 * No blur filters or render effects are used: the halo is a stack of faint strokes.
 */
public final class ScreenTimeIslandPainter {
    /** The approved reference is emerald; flip to true to tint the island with the popup theme. */
    static final boolean FOLLOW_THEME_ACCENT = false;

    private static final int COUNT_STEPS = 36;
    private static final int HALO_STEPS = 6;
    private static final float REF_HEIGHT = 104f;
    private static final float[] GLYPH_HEIGHTS = {14f, 7.5f, 30f, 23f};

    private final float density;
    private final float ew;
    private final float eh;
    private final float u;
    private final int emerald;
    private final int mint;
    private final int cyan;
    private final int blue;
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint art = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint rim = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint halo = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint sheen = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
    private final Paint ink = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint glyph = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path capsule = new Path();
    private final Path waveTop = new Path();
    private final Path ribbonA = new Path();
    private final Path ribbonB = new Path();
    private final Path ribbonEdge = new Path();
    private final Path iconClip = new Path();
    private final RectF rect = new RectF();
    private final Typeface regular;
    private final Typeface medium;
    private final Typeface bold;
    private final Drawable icon;
    private final String name;
    private final Shader bodyShader;
    private final Shader waveShader;
    private final Shader ribbonAShader;
    private final Shader ribbonBShader;
    private final Shader bloomShader;
    private final Shader rimShader;
    private final Shader glyphShader;
    private final Shader bubbleShader;
    private final String[] stepNumber = new String[COUNT_STEPS + 1];
    private final String[] stepUnit = new String[COUNT_STEPS + 1];
    private final String[] stepNumber2 = new String[COUNT_STEPS + 1];
    private final String[] stepUnit2 = new String[COUNT_STEPS + 1];
    private float timeScale = 1f;
    private int iconLeft = Integer.MIN_VALUE;
    private int iconTop;
    private int iconRight;
    private int iconBottom;

    public ScreenTimeIslandPainter(Context context, String appLabel, Drawable appIcon,
                                   int accentColor, float expandedWidthPx, float expandedHeightPx) {
        density = context.getResources().getDisplayMetrics().density;
        ew = Math.max(dp(240f), expandedWidthPx);
        eh = Math.max(dp(48f), expandedHeightPx);
        u = eh / REF_HEIGHT;
        icon = appIcon;
        if (FOLLOW_THEME_ACCENT) {
            emerald = accentColor;
            mint = blend(accentColor, Color.WHITE, 0.55f);
            cyan = blend(accentColor, Color.rgb(25, 230, 220), 0.45f);
            blue = blend(accentColor, Color.rgb(29, 143, 224), 0.45f);
        } else {
            emerald = Color.rgb(46, 229, 157);
            mint = Color.rgb(168, 243, 220);
            cyan = Color.rgb(25, 230, 220);
            blue = Color.rgb(29, 143, 224);
        }

        Typeface fallback = Typeface.create("sans-serif", Typeface.NORMAL);
        regular = loadTypeface(context, "fonts/MathMaster-Regular.otf", fallback);
        medium = loadTypeface(context, "fonts/MathMaster-Medium.otf",
            Typeface.create("sans-serif-medium", Typeface.NORMAL));
        bold = loadTypeface(context, "fonts/MathMaster-Bold.otf",
            Typeface.create("sans-serif", Typeface.BOLD));

        text.setTypeface(bold);
        text.setTextSize(21.5f * u);
        name = ellipsize(appLabel == null || appLabel.trim().isEmpty() ? "App" : appLabel.trim(),
            dividerX() - 12f * u - 87f * u);

        fill.setStyle(Paint.Style.FILL);
        art.setStyle(Paint.Style.FILL);
        rim.setStyle(Paint.Style.STROKE);
        rim.setStrokeWidth(Math.max(1.3f, 1.6f * density));
        halo.setStyle(Paint.Style.STROKE);
        halo.setStrokeWidth(2.2f * density);
        sheen.setStyle(Paint.Style.STROKE);
        sheen.setStrokeWidth(Math.max(1f, 0.9f * density));
        sheen.setStrokeCap(Paint.Cap.ROUND);
        ink.setStyle(Paint.Style.FILL);
        glyph.setStyle(Paint.Style.FILL);

        bodyShader = new LinearGradient(0f, 0f, 0f, eh,
            new int[]{Color.rgb(17, 49, 51), Color.rgb(11, 32, 36), Color.rgb(10, 44, 40)},
            new float[]{0f, 0.52f, 1f}, Shader.TileMode.CLAMP);

        waveTop.moveTo(ew * 0.16f, 0f);
        waveTop.lineTo(ew * 0.84f, 0f);
        waveTop.cubicTo(ew * 0.74f, eh * 0.36f, ew * 0.52f, eh * 0.06f, ew * 0.36f, eh * 0.30f);
        waveTop.cubicTo(ew * 0.29f, eh * 0.40f, ew * 0.22f, eh * 0.30f, ew * 0.16f, 0f);
        waveTop.close();
        waveShader = new LinearGradient(0f, 0f, 0f, eh * 0.45f,
            Color.argb(34, 255, 255, 255), Color.argb(0, 255, 255, 255), Shader.TileMode.CLAMP);

        ribbonA.moveTo(ew * 0.44f, eh);
        ribbonA.cubicTo(ew * 0.66f, eh * 0.90f, ew * 0.84f, eh * 0.72f, ew * 1.06f, eh * 0.38f);
        ribbonA.lineTo(ew * 1.06f, eh * 1.1f);
        ribbonA.lineTo(ew * 0.44f, eh * 1.1f);
        ribbonA.close();
        ribbonAShader = new LinearGradient(ew * 0.44f, eh, ew * 1.04f, eh * 0.50f,
            new int[]{withAlpha(emerald, 0), withAlpha(Color.rgb(16, 190, 150), 120), withAlpha(cyan, 150)},
            new float[]{0f, 0.55f, 1f}, Shader.TileMode.CLAMP);
        ribbonB.moveTo(ew * 0.58f, eh);
        ribbonB.cubicTo(ew * 0.74f, eh * 0.96f, ew * 0.90f, eh * 0.84f, ew * 1.06f, eh * 0.52f);
        ribbonB.lineTo(ew * 1.06f, eh * 1.1f);
        ribbonB.lineTo(ew * 0.58f, eh * 1.1f);
        ribbonB.close();
        ribbonBShader = new LinearGradient(ew * 0.58f, eh, ew * 1.0f, eh * 0.6f,
            new int[]{withAlpha(blue, 0), withAlpha(blue, 118), withAlpha(cyan, 90)},
            new float[]{0f, 0.6f, 1f}, Shader.TileMode.CLAMP);
        ribbonEdge.moveTo(ew * 0.44f, eh);
        ribbonEdge.cubicTo(ew * 0.66f, eh * 0.90f, ew * 0.84f, eh * 0.72f, ew * 1.06f, eh * 0.38f);

        bloomShader = new RadialGradient(ew * 0.08f, eh * 0.98f, ew * 0.36f,
            new int[]{Color.argb(150, 6, 96, 74), Color.argb(0, 6, 96, 74)}, new float[]{0f, 1f},
            Shader.TileMode.CLAMP);
        rimShader = new LinearGradient(0f, 0f, ew, 0f,
            new int[]{mint, withAlpha(emerald, 245), withAlpha(mint, 235), withAlpha(cyan, 255)},
            new float[]{0f, 0.28f, 0.62f, 1f}, Shader.TileMode.CLAMP);
        glyphShader = new LinearGradient(0f, eh * 0.30f, 0f, eh * 0.68f,
            Color.rgb(84, 255, 188), Color.rgb(8, 196, 112), Shader.TileMode.CLAMP);
        float bubbleRadius = 14f * u;
        bubbleShader = new RadialGradient(-bubbleRadius * 0.35f, -bubbleRadius * 0.40f, bubbleRadius * 1.45f,
            new int[]{Color.argb(240, 214, 255, 242), Color.argb(205, 60, 238, 182), Color.argb(235, 10, 160, 132)},
            new float[]{0f, 0.45f, 1f}, Shader.TileMode.CLAMP);
        setDurationTarget(0L);
    }

    /** Expanded pill size shared by the overlay and the desktop preview (reference ratio is about 5.3:1). */
    public static float expandedWidthPx(float screenWidthPx, float density) {
        return Math.max(240f * density, Math.min(screenWidthPx - 28f * density, 372f * density));
    }

    public static float expandedHeightPx(float expandedWidthPx, float density) {
        return Math.max(62f * density, Math.min(76f * density, expandedWidthPx / 5.3f));
    }

    /** Padding the overlay window reserves around the pill for the halo and the bubble. */
    public static int padSide(float density) { return Math.round(13f * density); }
    public static int padTop(float density) { return Math.round(8f * density); }
    public static int padBottom(float density) { return Math.round(15f * density); }

    public static int accentForTheme(String theme) {
        if (theme == null) return Color.rgb(59, 130, 246);
        switch (theme) {
            case "deep-space": case "indigo": return Color.rgb(99, 102, 241);
            case "titanium-silver": case "graphite": return Color.rgb(148, 163, 184);
            case "midnight-violet": return Color.rgb(139, 92, 246);
            case "sapphire": return Color.rgb(37, 99, 235);
            case "ocean-cyan": return Color.rgb(8, 145, 178);
            case "emerald-glass": case "forest": return Color.rgb(16, 185, 129);
            case "aurora": return Color.rgb(34, 211, 238);
            case "soft-rose": return Color.rgb(244, 114, 182);
            case "sunset-gold": return Color.rgb(245, 158, 11);
            case "pearl-white": return Color.rgb(37, 99, 235);
            case "mint": return Color.rgb(13, 148, 136);
            default: return Color.rgb(59, 130, 246);
        }
    }

    /** Pre-builds the count-up strings ("20 min", "1 hr 24 min") so frames only index arrays. */
    public void setDurationTarget(long totalMillis) {
        long minutes = Math.min(24L * 60L, Math.max(0L, totalMillis / 60_000L));
        for (int step = 0; step <= COUNT_STEPS; step++) {
            long minute = Math.round(minutes * (step / (double) COUNT_STEPS));
            if (minute < 1L) {
                stepNumber[step] = "<1"; stepUnit[step] = "min";
                stepNumber2[step] = ""; stepUnit2[step] = "";
            } else if (minute >= 60L) {
                stepNumber[step] = Long.toString(minute / 60L); stepUnit[step] = "hr";
                long rest = minute % 60L;
                stepNumber2[step] = rest == 0L ? "" : Long.toString(rest);
                stepUnit2[step] = rest == 0L ? "" : "min";
            } else {
                stepNumber[step] = Long.toString(minute); stepUnit[step] = "min";
                stepNumber2[step] = ""; stepUnit2[step] = "";
            }
        }
        float full = timeWidth(COUNT_STEPS, 1f);
        float available = (ew - 37f * u - 34.8f * u - 16f * u) - timeLeft();
        timeScale = full > available && available > 0f ? Math.max(0.62f, available / full) : 1f;
    }

    public void draw(Canvas canvas, int viewWidth, int viewHeight, ScreenTimeIslandMotion.Frame f) {
        float w = f.width;
        float h = f.height;
        float a01 = clamp(f.alpha, 0f, 1f);
        if (a01 <= 0.002f || w < 2f || h < 2f || viewWidth <= 0 || viewHeight <= 0) return;
        float morph = clamp(f.morph, 0f, 1.06f);
        float r = h * 0.5f;
        int alpha = Math.round(255f * a01);
        float ignite = clamp((morph - 0.10f) / 0.55f, 0f, 1f);
        float exit = clamp(f.exit, 0f, 1f);
        float contentK = clamp((morph - 0.40f) / 0.42f, 0f, 1f) * (1f - exit);
        float s = f.scale * (1f - 0.026f * clamp(f.press, 0f, 1f));
        float top = padTop(density) + f.offsetY;

        int save = canvas.save();
        canvas.scale(s, s, viewWidth * 0.5f, top + h * 0.5f);
        canvas.translate((viewWidth - w) * 0.5f, top);

        if (ignite > 0.01f) drawHalo(canvas, w, h, r, Math.round(alpha * ignite * (0.82f + 0.18f * f.pulse)));

        fill.setShader(null);
        fill.setColor(Color.BLACK);
        fill.setAlpha(alpha);
        canvas.drawRoundRect(0f, 0f, w, h, r, r, fill);

        float ox = (w - ew) * 0.5f;
        if (ignite > 0.01f) {
            fill.setShader(bodyShader);
            fill.setAlpha(Math.round(alpha * ignite));
            canvas.drawRoundRect(0f, 0f, w, h, r, r, fill);
            fill.setShader(null);

            int saveArt = canvas.save();
            capsule.reset();
            rect.set(0f, 0f, w, h);
            capsule.addRoundRect(rect, r, r, Path.Direction.CW);
            canvas.clipPath(capsule);
            canvas.translate(ox, 0f);
            int artAlpha = Math.round(alpha * ignite * (1f - exit * 0.6f));
            art.setShader(bloomShader);
            art.setAlpha(artAlpha);
            rect.set(0f, 0f, ew, eh);
            canvas.drawRect(rect, art);
            art.setShader(waveShader);
            art.setAlpha(artAlpha);
            canvas.drawPath(waveTop, art);
            art.setShader(ribbonAShader);
            art.setAlpha(Math.round(artAlpha * (0.86f + 0.14f * f.pulse)));
            canvas.drawPath(ribbonA, art);
            art.setShader(ribbonBShader);
            art.setAlpha(artAlpha);
            canvas.drawPath(ribbonB, art);
            sheen.setShader(null);
            sheen.setColor(Color.argb(Math.round(artAlpha * 0.38f), 168, 243, 220));
            canvas.drawPath(ribbonEdge, sheen);
            art.setShader(null);
            canvas.restoreToCount(saveArt);
        }

        float collapsedK = 1f - clamp(morph / 0.22f, 0f, 1f);
        if (collapsedK > 0.01f) drawCollapsed(canvas, w, h, alpha, collapsedK, f.pulse);

        if (contentK > 0.003f) {
            int saveContent = canvas.save();
            capsule.reset();
            rect.set(0f, 0f, w, h);
            capsule.addRoundRect(rect, r, r, Path.Direction.CW);
            canvas.clipPath(capsule);
            canvas.translate(ox, 0f);
            drawExpanded(canvas, f, Math.round(alpha * contentK));
            canvas.restoreToCount(saveContent);
        }

        drawRim(canvas, w, h, r, alpha, ignite, ox);
        if (f.shimmer >= 0f && f.shimmer <= 1f) drawShimmer(canvas, w, r, alpha, f.shimmer);
        if (contentK > 0.003f) drawBubble(canvas, w, Math.round(alpha * contentK), f.contentMs, f.pulse);
        canvas.restoreToCount(save);
    }

    private void drawHalo(Canvas canvas, float w, float h, float r, int alpha) {
        for (int i = 0; i < HALO_STEPS; i++) {
            float g = (0.6f + i * 1.9f) * density;
            float falloff = 1f - i / (float) HALO_STEPS;
            halo.setColor((Math.round(alpha * 0.26f * falloff * falloff) << 24) | (emerald & 0x00ffffff));
            canvas.drawRoundRect(-g, -g + density, w + g, h + g + density, r + g, r + g, halo);
        }
    }

    private void drawRim(Canvas canvas, float w, float h, float r, int alpha, float ignite, float ox) {
        float inset = rim.getStrokeWidth() * 0.5f;
        canvas.save();
        canvas.translate(ox, 0f);
        rim.setShader(rimShader);
        rim.setAlpha(Math.round(alpha * (0.30f + 0.70f * ignite)));
        canvas.drawRoundRect(-ox + inset, inset, w - ox - inset, h - inset, r - inset, r - inset, rim);
        canvas.restore();
        rim.setShader(null);
        if (ignite > 0.02f && w > r * 2.4f) {
            sheen.setShader(null);
            sheen.setColor(Color.argb(Math.round(alpha * 0.46f * ignite), 214, 255, 242));
            canvas.drawLine(r * 1.05f, density * 1.15f, w - r * 1.05f, density * 1.15f, sheen);
        }
    }

    private void drawShimmer(Canvas canvas, float w, float r, int alpha, float progress) {
        float start = r * 0.8f;
        float end = w - r * 0.8f;
        if (end <= start) return;
        float center = start + (end - start) * progress;
        float sigma = Math.max(dp(18f), (end - start) * 0.12f);
        float segment = dp(4f);
        sheen.setShader(null);
        for (int i = -9; i <= 9; i++) {
            float x = center + i * segment;
            if (x < start || x > end) continue;
            float d = (x - center) / sigma;
            float strength = (float) Math.exp(-d * d);
            sheen.setColor(Color.argb(Math.round(alpha * 0.75f * strength), 255, 255, 255));
            canvas.drawLine(x - segment * 0.5f, density * 1.15f, x + segment * 0.5f, density * 1.15f, sheen);
        }
    }

    private void drawCollapsed(Canvas canvas, float w, float h, int alpha, float k, float pulse) {
        float size = Math.min(dp(18f), h - dp(10f));
        if (size > dp(6f)) drawIcon(canvas, dp(9f), (h - size) * 0.5f, size, Math.round(alpha * k), 0.28f);
        float cy = h * 0.5f;
        float cx = w - dp(11f);
        ink.setColor((Math.round(alpha * k * 0.30f * (1f - pulse)) << 24) | (emerald & 0x00ffffff));
        canvas.drawCircle(cx, cy, dp(3f) + dp(3.2f) * pulse, ink);
        ink.setColor((Math.round(alpha * k * 0.96f) << 24) | (emerald & 0x00ffffff));
        canvas.drawCircle(cx, cy, dp(3f), ink);
    }

    private void drawExpanded(Canvas canvas, ScreenTimeIslandMotion.Frame f, int alpha) {
        float ms = f.contentMs;

        float tile = 48f * u;
        float tilePop = pop(ms, 0f, 340f);
        float size = tile * (0.55f + 0.45f * tilePop);
        float cx = 22f * u + tile * 0.5f;
        drawIcon(canvas, cx - size * 0.5f, eh * 0.5f - size * 0.5f, size,
            Math.round(alpha * fade(ms, 0f, 200f)), 0.24f);

        float nameK = fade(ms, 60f, 260f);
        text.setTextAlign(Paint.Align.LEFT);
        text.setTypeface(bold);
        text.setTextSize(21.5f * u);
        text.setColor(Color.WHITE);
        text.setAlpha(Math.round(alpha * nameK));
        canvas.drawText(name, 87f * u, 45f * u + (1f - nameK) * 5f * u, text);

        float captionK = fade(ms, 110f, 260f);
        text.setTypeface(regular);
        text.setTextSize(17f * u);
        text.setColor(Color.rgb(188, 209, 213));
        text.setAlpha(Math.round(alpha * 0.92f * captionK));
        canvas.drawText("Screen Time \u00b7 Today", 87f * u, 66f * u + (1f - captionK) * 5f * u, text);

        float dividerK = fade(ms, 170f, 300f);
        float dividerX = dividerX();
        float mid = 50.5f * u;
        float half = 21.5f * u * dividerK;
        sheen.setShader(null);
        sheen.setStrokeWidth(Math.max(1f, 1.3f * density));
        sheen.setColor(Color.argb(Math.round(alpha * 0.34f), 255, 255, 255));
        canvas.drawLine(dividerX, mid - half, dividerX, mid + half, sheen);
        sheen.setStrokeWidth(Math.max(1f, 0.9f * density));

        drawTime(canvas, f, alpha, ms);
        drawGlyph(canvas, alpha, ms);
    }

    private void drawTime(Canvas canvas, ScreenTimeIslandMotion.Frame f, int alpha, float ms) {
        int step = Math.round(clamp(f.counter, 0f, 1f) * COUNT_STEPS);
        float k = fade(ms, 150f, 280f);
        float x = timeLeft();
        float y = 64f * u + (1f - k) * 8f * u;
        float numSize = 43f * u * timeScale;
        float unitSize = 27f * u * timeScale;
        text.setTextAlign(Paint.Align.LEFT);
        text.setColor(Color.WHITE);
        x = drawTimePart(canvas, stepNumber[step], x, y, numSize, bold, Math.round(alpha * k));
        x = drawTimePart(canvas, stepUnit[step], x + 3f * u, y, unitSize, medium, Math.round(alpha * 0.94f * k));
        if (stepNumber2[step].isEmpty()) return;
        x = drawTimePart(canvas, stepNumber2[step], x + 7f * u, y, numSize, bold, Math.round(alpha * k));
        drawTimePart(canvas, stepUnit2[step], x + 3f * u, y, unitSize, medium, Math.round(alpha * 0.94f * k));
    }

    private float drawTimePart(Canvas canvas, String value, float x, float y, float size,
                               Typeface face, int alpha) {
        text.setTypeface(face);
        text.setTextSize(size);
        text.setAlpha(alpha);
        canvas.drawText(value, x, y, text);
        return x + text.measureText(value);
    }

    private float timeWidth(int step, float scale) {
        float numSize = 43f * u * scale;
        float unitSize = 27f * u * scale;
        float width = measure(stepNumber[step], numSize, bold) + 3f * u + measure(stepUnit[step], unitSize, medium);
        if (!stepNumber2[step].isEmpty()) {
            width += 7f * u + measure(stepNumber2[step], numSize, bold)
                + 3f * u + measure(stepUnit2[step], unitSize, medium);
        }
        return width;
    }

    private float measure(String value, float size, Typeface face) {
        text.setTypeface(face);
        text.setTextSize(size);
        return text.measureText(value);
    }

    private void drawGlyph(Canvas canvas, int alpha, float ms) {
        float barW = 6f * u;
        float gap = 3.6f * u;
        float right = ew - 37f * u;
        float left = right - (4f * barW + 3f * gap);
        float bottom = 66.5f * u;
        glyph.setShader(glyphShader);
        for (int i = 0; i < 4; i++) {
            float grow = clamp(pop(ms, 230f + i * 40f, 320f), 0f, 1.12f);
            float idle = ms > 760f ? 1f + 0.09f * (float) Math.sin(ms * 0.0055 + i * 1.9) : 1f;
            float height = GLYPH_HEIGHTS[i] * u * grow * idle;
            float x = left + i * (barW + gap);
            glyph.setAlpha(Math.round(alpha * 0.96f));
            canvas.drawRoundRect(x, bottom - height, x + barW, bottom, barW * 0.5f, barW * 0.5f, glyph);
        }
        glyph.setShader(null);
    }

    private void drawBubble(Canvas canvas, float w, int alpha, float ms, float pulse) {
        float k = clamp(pop(ms, 260f, 360f), 0f, 1.1f);
        if (k <= 0.01f) return;
        float radius = 14f * u;
        float cx = w - 20f * u;
        float cy = 16f * u + (pulse - 0.5f) * 0.9f * density;
        int save = canvas.save();
        canvas.translate(cx, cy);
        canvas.scale(k, k);
        ink.setShader(bubbleShader);
        ink.setAlpha(Math.round(alpha * 0.92f));
        canvas.drawCircle(0f, 0f, radius, ink);
        ink.setShader(null);
        sheen.setShader(null);
        sheen.setStrokeWidth(Math.max(1f, 0.8f * density));
        sheen.setColor(Color.argb(Math.round(alpha * 0.62f), 214, 255, 242));
        canvas.drawCircle(0f, 0f, radius, sheen);
        sheen.setStrokeWidth(Math.max(1f, 0.9f * density));
        canvas.restoreToCount(save);
    }

    private void drawIcon(Canvas canvas, float left, float top, float size, int alpha, float radiusFraction) {
        float radius = size * radiusFraction;
        if (icon == null) {
            ink.setShader(null);
            ink.setColor(Color.argb(Math.round(0.92f * alpha), 90, 150, 140));
            canvas.drawRoundRect(left, top, left + size, top + size, radius, radius, ink);
            return;
        }
        rect.set(left, top, left + size, top + size);
        iconClip.reset();
        iconClip.addRoundRect(rect, radius, radius, Path.Direction.CW);
        int save = canvas.save();
        canvas.clipPath(iconClip);
        int oldAlpha = icon.getAlpha();
        icon.setAlpha(alpha);
        int l = Math.round(left);
        int t = Math.round(top);
        int rr = Math.round(left + size);
        int b = Math.round(top + size);
        if (l != iconLeft || t != iconTop || rr != iconRight || b != iconBottom) {
            iconLeft = l;
            iconTop = t;
            iconRight = rr;
            iconBottom = b;
            icon.setBounds(l, t, rr, b);
        }
        icon.draw(canvas);
        icon.setAlpha(oldAlpha);
        canvas.restoreToCount(save);
        sheen.setShader(null);
        sheen.setStrokeWidth(Math.max(1f, 0.75f * density));
        sheen.setColor(Color.argb(Math.round(alpha * 0.28f), 255, 255, 255));
        canvas.drawRoundRect(rect, radius, radius, sheen);
        sheen.setStrokeWidth(Math.max(1f, 0.9f * density));
    }

    private float dividerX() { return ew * 0.49f; }
    private float timeLeft() { return dividerX() + 41f * u; }

    private String ellipsize(String value, float maxWidth) {
        if (text.measureText(value) <= maxWidth) return value;
        String ellipsis = "\u2026";
        int end = value.length();
        while (end > 1) {
            end--;
            String candidate = value.substring(0, end).trim() + ellipsis;
            if (text.measureText(candidate) <= maxWidth) return candidate;
        }
        return ellipsis;
    }

    private static Typeface loadTypeface(Context context, String path, Typeface fallback) {
        try { return Typeface.createFromAsset(context.getAssets(), path); }
        catch (RuntimeException ignored) { return fallback; }
    }

    private static float fade(float ms, float start, float duration) {
        float x = clamp((ms - start) / duration, 0f, 1f);
        float inverse = 1f - x;
        return 1f - inverse * inverse * inverse;
    }

    /** Ease-out with a restrained overshoot (about 4%) for pops and bar growth. */
    private static float pop(float ms, float start, float duration) {
        float x = clamp((ms - start) / duration, 0f, 1f);
        float c1 = 1.1f;
        float c3 = c1 + 1f;
        float t = x - 1f;
        return 1f + c3 * t * t * t + c1 * t * t;
    }

    private static int withAlpha(int color, int alpha) {
        return (Math.max(0, Math.min(255, alpha)) << 24) | (color & 0x00ffffff);
    }

    private static int blend(int from, int to, float amount) {
        float k = clamp(amount, 0f, 1f);
        int r = Math.round(Color.red(from) + (Color.red(to) - Color.red(from)) * k);
        int g = Math.round(Color.green(from) + (Color.green(to) - Color.green(from)) * k);
        int b = Math.round(Color.blue(from) + (Color.blue(to) - Color.blue(from)) * k);
        return Color.rgb(r, g, b);
    }

    private float dp(float value) { return value * density; }

    private static float clamp(float value, float min, float max) {
        if (Float.isNaN(value) || Float.isInfinite(value)) return min;
        return Math.max(min, Math.min(max, value));
    }
}
