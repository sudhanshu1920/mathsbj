package com.sudhanshu.mathsbj;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.content.res.Resources;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.util.Locale;

/** Renders contact sheets by invoking the production ScreenTimeIslandPainter directly. */
public final class IslandPainterPreview {
    private static final int FRAME_HEIGHT = 112;
    private static final int LABEL_HEIGHT = 18;
    private static final long MINUTE = 60_000L;
    private static final int CURRENT_HOUR = 13;
    private static final String[] THEMES = {
        "arctic-blue", "aurora", "sunset-gold", "soft-rose", "mint", "graphite"
    };
    private static final int[] WIDTHS = { 360, 412, 480 };
    private static final String[] USAGE_LABELS = { "0m", "7m", "1h24m", "11h59m" };
    private static final String[] CUTOUTS = { "center", "left", "none" };
    private static final String[] FRAME_LABELS = {
        "0ms", "80ms", "140ms", "240ms", "340ms",
        "480ms", "700ms", "hold", "dismiss 110ms", "dismiss 380ms"
    };

    private IslandPainterPreview() {}

    public static void main(String[] args) throws Exception {
        String outputPath = args.length > 0 ? args[0] : "tools/island-preview/out";
        File output = new File(outputPath);
        if (!output.exists() && !output.mkdirs()) throw new IOException("Cannot create " + output);
        String assetPath = System.getProperty("island.assets");
        if (assetPath == null || assetPath.isEmpty()) {
            throw new IllegalStateException("Pass -Disland.assets pointing at android-native/assets/");
        }
        PreviewContext context = new PreviewContext(assetPath);
        int rendered = 0;
        for (int width : WIDTHS) {
            for (String cutout : CUTOUTS) {
                renderSheet(context, output, width, cutout);
                rendered++;
            }
        }
        System.out.println("Rendered " + rendered + " Screen Time Island contact sheets into " + output.getAbsolutePath());
    }

    private static void renderSheet(PreviewContext baseContext, File output,
                                    int width, String cutout) throws IOException {
        int scenarioCount = THEMES.length * USAGE_LABELS.length;
        int scenarioHeight = LABEL_HEIGHT + (FRAME_HEIGHT * 2);
        BufferedImage sheet = new BufferedImage(width * 5, scenarioCount * scenarioHeight,
            BufferedImage.TYPE_INT_ARGB);
        Graphics2D labels = sheet.createGraphics();
        labels.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        labels.setFont(new Font("Inter", Font.BOLD, 10));
        labels.setColor(new Color(0xffe5e7eb, true));

        int scenario = 0;
        for (String theme : THEMES) {
            for (int usage = 0; usage < USAGE_LABELS.length; usage++) {
                long total = totalForScenario(usage);
                String appLabel = usage == 3
                    ? "A Very Long Social & Messaging Application Name"
                    : (usage == 2 ? "Instagram" : "YouTube");
                int top = scenario * scenarioHeight;
                labels.drawString(theme + "  ·  " + USAGE_LABELS[usage]
                    + "  ·  " + appLabel + "  ·  " + cutout + " cutout",
                    8, top + 13);

                long[] hourly = hourlyUsage(usage);
                PreviewContext context = new PreviewContext(baseContext.assetPath);
                context.getResources().getDisplayMetrics().density = 1f;
                context.getResources().getDisplayMetrics().widthPixels = width;
                ScreenTimeIslandPainter painter = new ScreenTimeIslandPainter(
                    context, appLabel, new PreviewIcon(ScreenTimeIslandPainter.accentForTheme(theme)), hourly);
                painter.setDurationTarget(total);
                int accent = ScreenTimeIslandPainter.accentForTheme(theme);

                for (int frameIndex = 0; frameIndex < FRAME_LABELS.length; frameIndex++) {
                    PreviewFrame frame = frame(frameIndex, total);
                    BufferedImage image = renderFrame(width, cutout, painter, frame, accent);
                    int frameRow = frameIndex / 5;
                    int frameColumn = frameIndex % 5;
                    int x = frameColumn * width;
                    int y = top + LABEL_HEIGHT + frameRow * FRAME_HEIGHT;
                    labels.drawImage(image, x, y, null);
                    labels.setColor(new Color(0xfff3f4f6, true));
                    labels.setFont(new Font("Inter", Font.PLAIN, 9));
                    labels.drawString(FRAME_LABELS[frameIndex], x + 5, y + 11);
                    labels.setFont(new Font("Inter", Font.BOLD, 10));
                    labels.setColor(new Color(0xffe5e7eb, true));
                }
                scenario++;
            }
        }
        labels.dispose();
        String fileName = String.format(Locale.ROOT, "screen-time-island_%d_cutout-%s.png", width, cutout);
        ImageIO.write(sheet, "png", new File(output, fileName));
        System.out.println(fileName + " " + sheet.getWidth() + "x" + sheet.getHeight());
    }

    private static BufferedImage renderFrame(int screenWidth, String cutout,
                                             ScreenTimeIslandPainter painter,
                                             PreviewFrame frame, int accent) {
        Bitmap bitmap = Bitmap.createBitmap(screenWidth, FRAME_HEIGHT, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(0xff121318);

        if (!"none".equals(cutout)) {
            Paint camera = new Paint(Paint.ANTI_ALIAS_FLAG);
            camera.setColor(0xff050507);
            camera.setStyle(Paint.Style.FILL);
            float cameraLeft = "center".equals(cutout) ? (screenWidth - 36f) * 0.5f : 18f;
            canvas.drawRoundRect(cameraLeft, 0f, cameraLeft + 36f, 10f, 5f, 5f, camera);
            camera.setColor(0xff30323a);
            canvas.drawCircle(cameraLeft + 25f, 5f, 2.2f, camera);
        }

        int collapsedWidth = 112;
        int collapsedHeight = 34;
        int expandedWidth = Math.min(screenWidth - 32, 344);
        int expandedHeight = 88;
        int anchorTop = "center".equals(cutout) ? 0 : 6;
        int windowWidth = Math.round(lerp(collapsedWidth, expandedWidth, frame.widthProgress));
        int windowHeight = Math.round(lerp(collapsedHeight, expandedHeight, frame.heightProgress));
        int left = (screenWidth - windowWidth) / 2;

        int save = canvas.save();
        canvas.translate(left, anchorTop);
        painter.draw(canvas, windowWidth, windowHeight, frame.morph,
            frame.alpha, frame.iconScale, frame.barProgress, frame.pulse,
            accent, CURRENT_HOUR, frame.elapsedMillis);
        canvas.restoreToCount(save);
        return bitmap.image;
    }

    private static PreviewFrame frame(int index, long totalMillis) {
        PreviewFrame value = new PreviewFrame();
        value.pulse = 0.5f;
        if (index <= 6) {
            long time = new long[]{0, 80, 140, 240, 340, 480, 700}[index];
            if (time < 140L) {
                value.alpha = time / 140f;
                value.iconScale = value.alpha;
                value.widthProgress = 0f;
                value.heightProgress = 0f;
                value.morph = 0f;
                value.barProgress = 0f;
                value.elapsedMillis = 0L;
            } else {
                long morphElapsed = time - 140L;
                value.widthProgress = clamp(ScreenTimeIslandSpring.valueAt(morphElapsed / 1000f, 0.42f, 0.78f), 0f, 1.06f);
                value.heightProgress = clamp(ScreenTimeIslandSpring.valueAt(Math.max(0L, morphElapsed - 60L) / 1000f, 0.42f, 0.78f), 0f, 1.06f);
                value.morph = clamp(Math.min(value.widthProgress, value.heightProgress), 0f, 1f);
                float content = clamp((value.morph - 0.55f) / 0.45f, 0f, 1f);
                value.alpha = 1f;
                value.iconScale = content;
                value.barProgress = clamp((morphElapsed - 170L) / 480f, 0f, 1f);
                value.elapsedMillis = Math.round(totalMillis * easeOutCubic(morphElapsed / 520f));
            }
        } else if (index == 7) {
            value.widthProgress = 1f;
            value.heightProgress = 1f;
            value.morph = 1f;
            value.alpha = 1f;
            value.iconScale = 1f;
            value.barProgress = 1f;
            value.elapsedMillis = totalMillis;
        } else {
            long dismissElapsed = index == 8 ? 110L : 380L;
            float reverse = clamp(ScreenTimeIslandSpring.valueAt(dismissElapsed / 1000f, 0.42f, 0.90f), 0f, 1f);
            value.morph = 1f - reverse;
            value.widthProgress = value.morph;
            value.heightProgress = value.morph;
            value.alpha = dismissElapsed <= 240L ? 1f : clamp(1f - (dismissElapsed - 240L) / 140f, 0f, 1f);
            value.iconScale = value.alpha;
            value.barProgress = dismissElapsed < 110L ? 1f - dismissElapsed / 110f : 0f;
            value.elapsedMillis = totalMillis;
        }
        return value;
    }

    private static long totalForScenario(int usage) {
        if (usage == 1) return 7L * MINUTE;
        if (usage == 2) return 84L * MINUTE;
        if (usage == 3) return 719L * MINUTE;
        return 0L;
    }

    private static long[] hourlyUsage(int usage) {
        long[] result = new long[24];
        if (usage == 1) {
            result[CURRENT_HOUR] = 7L * MINUTE;
        } else if (usage == 2) {
            result[CURRENT_HOUR - 2] = 25L * MINUTE;
            result[CURRENT_HOUR - 1] = 35L * MINUTE;
            result[CURRENT_HOUR] = 24L * MINUTE;
        } else if (usage == 3) {
            for (int hour = 2; hour < 13; hour++) result[hour] = 60L * MINUTE;
            result[CURRENT_HOUR] = 59L * MINUTE;
        }
        return result;
    }

    private static float easeOutCubic(float value) {
        float x = clamp(value, 0f, 1f);
        float inverse = 1f - x;
        return 1f - inverse * inverse * inverse;
    }
    private static float clamp(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }
    private static float lerp(float a, float b, float p) { return a + (b - a) * p; }

    private static final class PreviewFrame {
        float widthProgress, heightProgress, morph, alpha, iconScale, barProgress, pulse;
        long elapsedMillis;
    }

    private static final class PreviewContext extends Context {
        final String assetPath;
        final Resources resources = new Resources();
        final AssetManager assets = new AssetManager();
        PreviewContext(String assetPath) {
            this.assetPath = assetPath.endsWith("/") ? assetPath : assetPath + "/";
            assets.baseDir = this.assetPath;
            resources.getDisplayMetrics().density = 1f;
        }
        @Override public SharedPreferences getSharedPreferences(String name, int mode) { return null; }
        @Override public String getPackageName() { return "com.sudhanshu.mathsbj.preview"; }
        @Override public Resources getResources() { return resources; }
        @Override public AssetManager getAssets() { return assets; }
        @Override public Context getApplicationContext() { return this; }
        @Override public PackageManager getPackageManager() { return null; }
    }

    private static final class PreviewIcon extends Drawable {
        private final int accent;
        PreviewIcon(int accent) { this.accent = accent; }
        @Override public void draw(Canvas canvas) {
            Paint body = new Paint(Paint.ANTI_ALIAS_FLAG);
            body.setColor(accent);
            body.setStyle(Paint.Style.FILL);
            float width = right - left;
            float height = bottom - top;
            canvas.drawRoundRect(left, top, right, bottom, width * 0.26f, height * 0.26f, body);
            Paint glint = new Paint(Paint.ANTI_ALIAS_FLAG);
            glint.setColor(0x99ffffff);
            canvas.drawCircle(left + width * 0.68f, top + height * 0.30f, width * 0.09f, glint);
        }
    }
}
