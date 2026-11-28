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

/**
 * Renders contact sheets by driving the production ScreenTimeIslandMotion timeline into the
 * production ScreenTimeIslandPainter, so what is reviewed here is what the overlay draws.
 */
public final class IslandPainterPreview {
    private static final int LABEL_HEIGHT = 20;
    private static final long MINUTE = 60_000L;
    private static final int[] WIDTHS = { 360, 412, 480 };
    private static final String[] CUTOUTS = { "center", "left", "none" };
    private static final String[] NAMES = { "ChatGPT", "Instagram", "Social & Messaging Companion Ultra", "YouTube" };
    private static final long[] USAGE_MINUTES = { 0L, 20L, 84L, 719L };
    private static final String[] USAGE_LABELS = { "<1 min", "20 min", "1 hr 24 min", "11 hr 59 min" };
    private static final long[] SHOW_MS = { 60L, 120L, 190L, 280L, 420L, 900L };
    private static final long DISMISS_AT_MS = 1500L;
    private static final long[] DISMISS_OFFSETS = { 90L, 210L };
    private static final int COLUMNS = 4;

    private IslandPainterPreview() {}

    public static void main(String[] args) throws Exception {
        String outputPath = args.length > 0 ? args[0] : "tools/island-preview/out";
        File output = new File(outputPath);
        if (!output.exists() && !output.mkdirs()) throw new IOException("Cannot create " + output);
        String assetPath = System.getProperty("island.assets");
        if (assetPath == null || assetPath.isEmpty()) {
            throw new IllegalStateException("Pass -Disland.assets pointing at android-native/assets/");
        }
        float density = Float.parseFloat(System.getProperty("island.density", "2"));
        PreviewContext context = new PreviewContext(assetPath, density);
        int rendered = 0;
        for (int width : WIDTHS) {
            for (String cutout : CUTOUTS) {
                renderSheet(context, output, width, cutout, density);
                rendered++;
            }
        }
        System.out.println("Rendered " + rendered + " Screen Time Island contact sheets into " + output.getAbsolutePath());
    }

    private static void renderSheet(PreviewContext context, File output, int widthDp, String cutout,
                                    float density) throws IOException {
        int frames = SHOW_MS.length + DISMISS_OFFSETS.length;
        int rows = (frames + COLUMNS - 1) / COLUMNS;
        float screenW = widthDp * density;
        float ew = ScreenTimeIslandPainter.expandedWidthPx(screenW, density);
        float eh = ScreenTimeIslandPainter.expandedHeightPx(ew, density);
        int padSide = ScreenTimeIslandPainter.padSide(density);
        int padTop = ScreenTimeIslandPainter.padTop(density);
        int padBottom = ScreenTimeIslandPainter.padBottom(density);
        int windowW = Math.round(ew + 2f * padSide);
        int windowH = Math.round(eh + padTop + padBottom);
        int cellW = Math.round(Math.max(screenW * 0.9f, windowW + 24f * density));
        int cellH = windowH + Math.round(26f * density);
        int scenarioHeight = LABEL_HEIGHT + rows * cellH;
        BufferedImage sheet = new BufferedImage(COLUMNS * cellW, NAMES.length * scenarioHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = sheet.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setColor(new Color(8, 10, 14));
        g.fillRect(0, 0, sheet.getWidth(), sheet.getHeight());
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 13));

        float collapsedW = 112f * density;
        float collapsedH = 34f * density;
        float cameraTop = 7f * density;
        float cameraSize = 10f * density;
        boolean centered = "center".equals(cutout);
        float anchorTop = centered
            ? Math.max(2f * density, cameraTop + cameraSize * 0.5f - collapsedH * 0.5f)
            : 6f * density;

        for (int scenario = 0; scenario < NAMES.length; scenario++) {
            boolean light = scenario % 2 == 1;
            int top = scenario * scenarioHeight;
            g.setColor(new Color(236, 244, 240));
            g.drawString(String.format(Locale.US, "%s - %s - %ddp - %s cutout - %s background",
                NAMES[scenario], USAGE_LABELS[scenario], widthDp, cutout, light ? "light" : "dark"), 8, top + 14);

            PreviewIcon icon = new PreviewIcon(scenario);
            ScreenTimeIslandPainter painter = new ScreenTimeIslandPainter(context, NAMES[scenario], icon,
                0xff2ee59d, ew, eh);
            painter.setDurationTarget(USAGE_MINUTES[scenario] * MINUTE);
            ScreenTimeIslandMotion motion = new ScreenTimeIslandMotion(collapsedW, collapsedH, ew, eh, false, 4200L);
            ScreenTimeIslandMotion.Frame frame = new ScreenTimeIslandMotion.Frame();
            motion.start(0L);

            long clock = 0L;
            int index = 0;
            for (int i = 0; i < SHOW_MS.length; i++) {
                clock = advance(motion, frame, clock, SHOW_MS[i]);
                drawCell(g, painter, frame, index++, top, cellW, cellH, windowW, windowH, density, light,
                    centered, !"none".equals(cutout), cameraTop, cameraSize, anchorTop, padTop, cutout, screenW);
            }
            clock = advance(motion, frame, clock, DISMISS_AT_MS);
            motion.dismiss(clock);
            long dismissStart = clock;
            for (long offset : DISMISS_OFFSETS) {
                clock = advance(motion, frame, clock, dismissStart + offset);
                drawCell(g, painter, frame, index++, top, cellW, cellH, windowW, windowH, density, light,
                    centered, !"none".equals(cutout), cameraTop, cameraSize, anchorTop, padTop, cutout, screenW);
            }
        }
        g.dispose();
        ImageIO.write(sheet, "png", new File(output, String.format(Locale.US,
            "screen-time-island_%d_cutout-%s.png", widthDp, cutout)));
    }

    private static long advance(ScreenTimeIslandMotion motion, ScreenTimeIslandMotion.Frame frame, long from, long to) {
        long t = from;
        while (t < to) {
            t = Math.min(to, t + 8L);
            motion.evaluate(t, frame);
        }
        if (from == to) motion.evaluate(to, frame);
        return to;
    }

    private static void drawCell(Graphics2D g, ScreenTimeIslandPainter painter, ScreenTimeIslandMotion.Frame frame,
                                 int index, int top, int cellW, int cellH, int windowW, int windowH, float density,
                                 boolean light, boolean centered, boolean hasCamera, float cameraTop, float cameraSize,
                                 float anchorTop, int padTop, String cutout, float screenW) {
        int column = index % COLUMNS;
        int row = index / COLUMNS;
        int x0 = column * cellW;
        int y0 = top + LABEL_HEIGHT + row * cellH;
        Bitmap bitmap = Bitmap.createBitmap(cellW, cellH, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(light ? 0xffe9edf1 : 0xff10141a);
        RectF area = new RectF(0f, 0f, cellW, cellH);
        canvas.drawRect(area, paint);
        paint.setColor(light ? 0xffd5dbe2 : 0xff181d25);
        area.set(0f, cellH * 0.55f, cellW, cellH);
        canvas.drawRect(area, paint);
        if (hasCamera) {
            float cx = centered ? cellW * 0.5f : cellW * 0.5f - screenW * 0.30f;
            paint.setColor(0xff000000);
            canvas.drawCircle(cx, cameraTop + cameraSize * 0.5f, cameraSize * 0.5f, paint);
        }
        int save = canvas.save();
        canvas.translate((cellW - windowW) * 0.5f, anchorTop - padTop);
        painter.draw(canvas, windowW, windowH, frame);
        canvas.restoreToCount(save);
        g2draw(g, bitmap, x0, y0);
        g.setColor(new Color(150, 170, 165));
        g.drawRect(x0, y0, cellW - 1, cellH - 1);
    }

    private static void g2draw(Graphics2D g, Bitmap bitmap, int x, int y) {
        g.drawImage(bitmap.image, x, y, null);
    }

    private static final class PreviewContext extends Context {
        final String assetPath;
        final Resources resources = new Resources();
        final AssetManager assets = new AssetManager();
        PreviewContext(String assetPath, float density) {
            this.assetPath = assetPath.endsWith("/") ? assetPath : assetPath + "/";
            assets.baseDir = this.assetPath;
            resources.getDisplayMetrics().density = density;
        }
        @Override public SharedPreferences getSharedPreferences(String name, int mode) { return null; }
        @Override public String getPackageName() { return "com.sudhanshu.mathsbj.preview"; }
        @Override public Resources getResources() { return resources; }
        @Override public AssetManager getAssets() { return assets; }
        @Override public Context getApplicationContext() { return this; }
        @Override public PackageManager getPackageManager() { return null; }
    }

    /** Stand-in launcher icons: a white tile for ChatGPT-like apps and coloured tiles otherwise. */
    private static final class PreviewIcon extends Drawable {
        private final int variant;
        PreviewIcon(int variant) { this.variant = variant; }
        @Override public void draw(Canvas canvas) {
            Paint body = new Paint(Paint.ANTI_ALIAS_FLAG);
            body.setStyle(Paint.Style.FILL);
            body.setColor(variant == 0 ? 0xfff4f6f6 : variant == 1 ? 0xffc13584 : variant == 2 ? 0xff3b82f6 : 0xffe53935);
            float width = right - left;
            float height = bottom - top;
            canvas.drawRoundRect(left, top, right, bottom, width * 0.24f, height * 0.24f, body);
            Paint glyph = new Paint(Paint.ANTI_ALIAS_FLAG);
            glyph.setStyle(Paint.Style.STROKE);
            glyph.setStrokeWidth(Math.max(1f, width * 0.07f));
            glyph.setColor(variant == 0 ? 0xff111111 : 0xe6ffffff);
            canvas.drawCircle(left + width * 0.5f, top + height * 0.5f, width * 0.24f, glyph);
        }
    }
}
