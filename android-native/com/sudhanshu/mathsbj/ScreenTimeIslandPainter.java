package com.sudhanshu.mathsbj;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;

/** Canvas-only renderer for the OLED Screen Time Island. */
public final class ScreenTimeIslandPainter {
    private final float density;
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint hairline = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
    private final Paint bars = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint rim = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path iconClip = new Path();
    private final RectF iconRect = new RectF();
    private final Typeface regular;
    private final Typeface medium;
    private final Typeface bold;
    private final long[] hourly;
    private final Drawable icon;
    private final String label;
    private String[] primaryValues = new String[]{"<1"};
    private String[] primaryUnits = new String[]{"m"};
    private String[] secondaryValues = new String[]{""};
    private String[] secondaryUnits = new String[]{""};
    private float[] primaryWidths = new float[]{0f};
    private float[] secondaryWidths = new float[]{0f};
    private int displayedMinute = -1;
    private int targetMinutes;
    private String timePrimary = "<1";
    private String timePrimaryUnit = "m";
    private String timeSecondary = "";
    private String timeSecondaryUnit = "";
    private float timePrimaryWidth;
    private float timeSecondaryWidth;

    public ScreenTimeIslandPainter(Context context, String appLabel, Drawable appIcon, long[] hourlyMillis) {
        density = context.getResources().getDisplayMetrics().density;
        label = appLabel == null || appLabel.trim().isEmpty() ? "App" : appLabel;
        icon = appIcon;
        hourly = hourlyMillis == null ? new long[24] : hourlyMillis.clone();
        Typeface fallback = Typeface.create("sans-serif", Typeface.NORMAL);
        regular = loadTypeface(context, "fonts/MathMaster-Regular.otf", fallback);
        medium = loadTypeface(context, "fonts/MathMaster-Medium.otf", Typeface.create("sans-serif-medium", Typeface.NORMAL));
        bold = loadTypeface(context, "fonts/MathMaster-Bold.otf", Typeface.create("sans-serif", Typeface.BOLD));
        fill.setColor(Color.BLACK);
        fill.setStyle(Paint.Style.FILL);
        hairline.setStyle(Paint.Style.STROKE);
        hairline.setStrokeWidth(dp(0.75f));
        hairline.setShader(new LinearGradient(0f, 0f, 0f, dp(100f),
            new int[]{Color.argb(56, 255, 255, 255), Color.argb(10, 255, 255, 255)},
            null, Shader.TileMode.CLAMP));
        text.setTypeface(medium);
        text.setFontFeatureSettings("tnum");
        text.setColor(Color.WHITE);
        bars.setStyle(Paint.Style.FILL);
        rim.setStyle(Paint.Style.STROKE);
        rim.setStrokeWidth(dp(1f));
        setDurationTarget(0L);
    }

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

    /** Precomputes every displayed minute before animation; the frame loop only indexes arrays. */
    public void setDurationTarget(long totalMillis) {
        targetMinutes = (int) Math.min(26L * 60L, Math.max(0L, Math.max(0L, totalMillis) / 60_000L));
        int length = targetMinutes + 1;
        primaryValues = new String[length];
        primaryUnits = new String[length];
        secondaryValues = new String[length];
        secondaryUnits = new String[length];
        primaryWidths = new float[length];
        secondaryWidths = new float[length];
        for (int minute = 0; minute <= targetMinutes; minute++) {
            String primary;
            String primaryUnit;
            String secondary = "";
            String secondaryUnit = "";
            if (minute < 1) {
                primary = "<1";
                primaryUnit = "m";
            } else if (minute >= 60) {
                primary = Long.toString(minute / 60L);
                primaryUnit = "h";
                secondary = Long.toString(minute % 60L);
                secondaryUnit = "m";
            } else {
                primary = Integer.toString(minute);
                primaryUnit = "m";
            }
            primaryValues[minute] = primary;
            primaryUnits[minute] = primaryUnit;
            secondaryValues[minute] = secondary;
            secondaryUnits[minute] = secondaryUnit;
            text.setTypeface(bold);
            text.setTextSize(dp(24f));
            float width = text.measureText(primary);
            text.setTypeface(medium);
            text.setTextSize(dp(14f));
            primaryWidths[minute] = width + text.measureText(primaryUnit);
            if (!secondary.isEmpty()) {
                text.setTypeface(bold);
                text.setTextSize(dp(24f));
                width = text.measureText(secondary);
                text.setTypeface(medium);
                text.setTextSize(dp(14f));
                secondaryWidths[minute] = width + text.measureText(secondaryUnit);
            }
        }
        displayedMinute = -1;
        updateElapsed(0L);
    }

    /** No strings or objects are created by this per-frame selector. */
    public void updateElapsed(long elapsedMillis) {
        int minute = (int) Math.min(targetMinutes,
            Math.max(0L, Math.max(0L, elapsedMillis) / 60_000L));
        if (minute == displayedMinute) return;
        displayedMinute = minute;
        timePrimary = primaryValues[minute];
        timePrimaryUnit = primaryUnits[minute];
        timeSecondary = secondaryValues[minute];
        timeSecondaryUnit = secondaryUnits[minute];
        timePrimaryWidth = primaryWidths[minute];
        timeSecondaryWidth = secondaryWidths[minute];
    }

    public void draw(Canvas canvas, int width, int height, float morph, float alpha,
                     float iconScale, float barProgress, float currentHourPulse,
                     int accent, int currentHour, long elapsedMillis) {
        updateElapsed(elapsedMillis);
        float w = width;
        float h = height;
        float safeMorph = clamp(morph, 0f, 1f);
        int overallAlpha = Math.round(255f * clamp(alpha, 0f, 1f));
        if (overallAlpha <= 0 || width <= 0 || height <= 0) return;

        int save = canvas.save();
        float emergence = clamp(Math.max(iconScale, safeMorph), 0f, 1f);
        float scale = 0.86f + (0.14f * emergence);
        canvas.scale(scale, scale, w * 0.5f, h * 0.5f);
        fill.setAlpha(overallAlpha);
        canvas.drawRoundRect(0.5f, 0.5f, w - 0.5f, h - 0.5f,
            h * (0.5f - 0.18f * safeMorph), h * (0.5f - 0.18f * safeMorph), fill);
        hairline.setAlpha(overallAlpha);
        canvas.drawRoundRect(dp(0.5f), dp(0.5f), w - dp(0.5f), h - dp(0.5f),
            h * (0.5f - 0.18f * safeMorph), h * (0.5f - 0.18f * safeMorph), hairline);
        int rimAlpha = Math.round(overallAlpha * 0.35f * safeMorph);
        rim.setColor((rimAlpha << 24) | (accent & 0x00ffffff));
        canvas.drawLine(dp(18f), h - dp(1.6f), w - dp(18f), h - dp(1.6f), rim);
        rim.setStrokeWidth(dp(0.55f));
        rim.setAlpha(Math.round(rimAlpha * 0.45f));
        canvas.drawLine(dp(28f), h - dp(2.8f), w - dp(28f), h - dp(2.8f), rim);
        rim.setStrokeWidth(dp(1f));

        if (safeMorph < 0.55f) {
            drawCollapsed(canvas, w, h, overallAlpha, accent);
        }
        if (safeMorph > 0.02f) {
            float contentAlpha = clamp((safeMorph - 0.48f) / 0.52f, 0f, 1f);
            drawExpanded(canvas, w, h, overallAlpha, contentAlpha, barProgress,
                currentHourPulse, accent, currentHour);
        }
        canvas.restoreToCount(save);
    }

    private void drawCollapsed(Canvas canvas, float width, float height, int alpha, int accent) {
        float size = dp(18f);
        float top = (height - size) * 0.5f;
        drawIcon(canvas, dp(12f), top, size, alpha);
        bars.setColor((Math.round(alpha * 0.96f) << 24) | (accent & 0x00ffffff));
        canvas.drawCircle(width - dp(13f), height * 0.5f, dp(3.1f), bars);
    }

    private void drawExpanded(Canvas canvas, float width, float height, int alpha,
                              float contentAlpha, float barProgress, float pulse,
                              int accent, int currentHour) {
        int visibleAlpha = Math.round(alpha * contentAlpha);
        if (visibleAlpha <= 0) return;
        float iconSize = dp(36f) * (0.5f + 0.5f * clamp(contentAlpha, 0f, 1f));
        float iconLeft = dp(14f) + (dp(36f) - iconSize) * 0.5f;
        float iconTop = dp(12f) + (dp(36f) - iconSize) * 0.5f;
        float textOffsetY = dp(6f) * (1f - clamp(contentAlpha, 0f, 1f));
        drawIcon(canvas, iconLeft, iconTop, iconSize, visibleAlpha);

        float textLeft = dp(60f);
        text.setTypeface(medium);
        text.setTextSize(dp(13f));
        text.setColor(Color.WHITE);
        text.setAlpha(Math.round(visibleAlpha * 0.92f));
        text.setTextAlign(Paint.Align.LEFT);
        String displayLabel = label;
        float available = Math.max(dp(72f), width - dp(164f) - textLeft);
        if (text.measureText(displayLabel) > available) {
            // Clip instead of creating a shortened String on every frame.
            canvas.save();
            canvas.clipRect(textLeft, 0f, textLeft + available, dp(31f));
            canvas.drawText(displayLabel, textLeft, dp(27f) + textOffsetY, text);
            canvas.restore();
        } else {
            canvas.drawText(displayLabel, textLeft, dp(27f), text);
        }

        text.setTypeface(regular);
        text.setTextSize(dp(10.5f));
        text.setColor(Color.WHITE);
        text.setAlpha(Math.round(visibleAlpha * 0.52f));
        canvas.drawText("Today · since 12 AM", textLeft, dp(42f) + textOffsetY, text);

        float timeRight = width - dp(16f);
        float timeY = dp(33f) + textOffsetY;
        float totalWidth = timePrimaryWidth + timeSecondaryWidth + (timeSecondaryWidth > 0f ? dp(4f) : 0f);
        float timeX = timeRight - totalWidth;
        text.setTextAlign(Paint.Align.LEFT);
        text.setTypeface(bold);
        text.setTextSize(dp(24f));
        text.setColor(Color.WHITE);
        text.setAlpha(Math.round(visibleAlpha * 0.98f));
        canvas.drawText(timePrimary, timeX, timeY, text);
        float unitX = timeX + text.measureText(timePrimary);
        text.setTypeface(medium);
        text.setTextSize(dp(14f));
        text.setAlpha(Math.round(visibleAlpha * 0.62f));
        canvas.drawText(timePrimaryUnit, unitX, timeY, text);
        if (!timeSecondary.isEmpty()) {
            float secondX = timeRight - timeSecondaryWidth;
            text.setTypeface(bold);
            text.setTextSize(dp(24f));
            text.setAlpha(Math.round(visibleAlpha * 0.98f));
            canvas.drawText(timeSecondary, secondX, timeY, text);
            text.setTypeface(medium);
            text.setTextSize(dp(14f));
            text.setAlpha(Math.round(visibleAlpha * 0.62f));
            canvas.drawText(timeSecondaryUnit, secondX + text.measureText(timeSecondary), timeY, text);
        }

        drawHourlyBars(canvas, width, visibleAlpha, barProgress, pulse, accent, currentHour);
    }

    private void drawHourlyBars(Canvas canvas, float width, int alpha, float progress,
                                float pulse, int accent, int currentHour) {
        float left = dp(15f);
        float right = width - dp(15f);
        float gap = dp(2f);
        float barWidth = Math.max(dp(2.2f), Math.min(dp(3f),
            (right - left - (23f * gap)) / 24f));
        float totalWidth = (barWidth * 24f) + (gap * 23f);
        left = (width - totalWidth) * 0.5f;
        float baseline = dp(77f);
        float maxHeight = dp(14f);
        long maximum = 1L;
        for (long value : hourly) if (value > maximum) maximum = value;
        for (int i = 0; i < 24; i++) {
            float x = left + i * (barWidth + gap);
            long value = Math.max(0L, hourly[i]);
            float target = value == 0L ? dp(2.2f)
                : Math.max(dp(3f), maxHeight * ((float) value / (float) maximum));
            float elapsedSinceBarStart = progress * 480f;
            float staggeredProgress = clamp((elapsedSinceBarStart - i * 10f) / 250f, 0f, 1f);
            float barHeight = target * staggeredProgress;
            if (i == currentHour) {
                int pulseAlpha = Math.round(alpha * (0.68f + 0.22f * clamp(pulse, 0f, 1f)));
                bars.setColor((pulseAlpha << 24) | (accent & 0x00ffffff));
            } else {
                int a = Math.round(alpha * (value > 0L ? 0.38f : 0.10f));
                bars.setColor((a << 24) | 0x00ffffff);
            }
            float top = baseline - barHeight;
            canvas.drawRoundRect(x, top, x + barWidth, baseline,
                barWidth * 0.5f, barWidth * 0.5f, bars);
        }

        text.setTypeface(regular);
        text.setTextSize(dp(8f));
        text.setColor(Color.WHITE);
        text.setAlpha(Math.round(alpha * 0.36f));
        text.setTextAlign(Paint.Align.LEFT);
        canvas.drawText("12A", dp(15f), dp(91f), text);
        canvas.drawText("6A", width * 0.25f - dp(5f), dp(91f), text);
        canvas.drawText("12P", width * 0.5f - dp(8f), dp(91f), text);
        canvas.drawText("6P", width * 0.75f - dp(5f), dp(91f), text);
    }

    private void drawIcon(Canvas canvas, float left, float top, float size, int alpha) {
        if (icon == null) {
            bars.setColor(Color.argb(Math.round(0.92f * alpha), 90, 110, 140));
            canvas.drawRoundRect(left, top, left + size, top + size, dp(9f), dp(9f), bars);
            return;
        }
        iconRect.set(left, top, left + size, top + size);
        iconClip.reset();
        iconClip.addRoundRect(iconRect, dp(9f), dp(9f), Path.Direction.CW);
        int save = canvas.save();
        canvas.clipPath(iconClip);
        int oldAlpha = icon.getAlpha();
        icon.setAlpha(alpha);
        icon.setBounds(Math.round(left), Math.round(top), Math.round(left + size), Math.round(top + size));
        icon.draw(canvas);
        icon.setAlpha(oldAlpha);
        canvas.restoreToCount(save);
        rim.setColor(Color.argb(Math.round(alpha * 0.16f), 255, 255, 255));
        rim.setStrokeWidth(dp(0.75f));
        canvas.drawRoundRect(iconRect, dp(9f), dp(9f), rim);
        rim.setStrokeWidth(dp(1f));
    }

    private static Typeface loadTypeface(Context context, String path, Typeface fallback) {
        try { return Typeface.createFromAsset(context.getAssets(), path); }
        catch (RuntimeException ignored) { return fallback; }
    }

    private float dp(float value) { return value * density; }
    private static float clamp(float value, float min, float max) {
        if (Float.isNaN(value) || Float.isInfinite(value)) return min;
        return Math.max(min, Math.min(max, value));
    }
}