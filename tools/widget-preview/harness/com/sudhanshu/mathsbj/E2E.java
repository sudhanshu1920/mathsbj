package com.sudhanshu.mathsbj;

import android.content.*;
import android.content.pm.PackageManager;
import android.content.res.*;
import android.appwidget.AppWidgetManager;
import android.graphics.Bitmap;
import android.graphics.Typeface;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.util.SizeF;
import android.widget.RemoteViews;
import javax.imageio.ImageIO;
import java.io.File;
import java.text.SimpleDateFormat;
import java.util.*;

public class E2E {
    static class MemPrefs implements SharedPreferences {
        final Map<String, Object> m = new HashMap<>();
        public String getString(String k, String d) { return m.containsKey(k) ? (String) m.get(k) : d; }
        public int getInt(String k, int d) { return m.containsKey(k) ? (Integer) m.get(k) : d; }
        public long getLong(String k, long d) { return m.containsKey(k) ? ((Number) m.get(k)).longValue() : d; }
        public boolean getBoolean(String k, boolean d) { return m.containsKey(k) ? (Boolean) m.get(k) : d; }
        public boolean contains(String k) { return m.containsKey(k); }
        public Map<String, ?> getAll() { return m; }
        public Editor edit() {
            return new Editor() {
                public Editor putString(String k, String v) { m.put(k, v); return this; }
                public Editor putInt(String k, int v) { m.put(k, v); return this; }
                public Editor putLong(String k, long v) { m.put(k, v); return this; }
                public Editor putBoolean(String k, boolean v) { m.put(k, v); return this; }
                public Editor remove(String k) { m.remove(k); return this; }
                public void apply() {}
                public boolean commit() { return true; }
            };
        }
    }

    static class FakeContext extends Context {
        final MemPrefs prefs = new MemPrefs(); final AssetManager assets = new AssetManager(); final DisplayMetrics dm = new DisplayMetrics();
        public SharedPreferences getSharedPreferences(String n, int mode) { return prefs; }
        public String getPackageName() { return "com.sudhanshu.mathsbj"; }
        public Resources getResources() { return new Resources() { public DisplayMetrics getDisplayMetrics() { return dm; } }; }
        public AssetManager getAssets() { return assets; }
        public Context getApplicationContext() { return this; }
        public PackageManager getPackageManager() { return new PackageManager() { public Intent getLaunchIntentForPackage(String p) { return new Intent(); } }; }
    }

    static String json(String... items) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < items.length; i++) { if (i > 0) b.append(','); b.append('"').append(items[i]).append('"'); } return b.append(']').toString(); }

    static String sundayPlus(int offset) {
        Calendar c = Calendar.getInstance(); c.set(Calendar.HOUR_OF_DAY, 12);
        c.add(Calendar.DAY_OF_MONTH, -(c.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY) + offset);
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.getTime());
    }

    static void sizes(AppWidgetManager mgr, int id, float... wh) {
        Bundle b = new Bundle(); ArrayList<SizeF> list = new ArrayList<>();
        for (int i = 0; i < wh.length; i += 2) list.add(new SizeF(wh[i], wh[i + 1]));
        b.map.put(AppWidgetManager.OPTION_APPWIDGET_SIZES, list);
        b.map.put(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, (int) wh[0]); b.map.put(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, (int) wh[1]);
        mgr.options.put(id, b);
    }

    static String outDir = "out";
    static void save(Bitmap b, String name) throws Exception { ImageIO.write(b.image, "png", new File(outDir, name + ".png")); }

    static Bitmap render(FakeContext ctx, int id) {
        RemoteViews rv = MathMasterHomeWidgetProvider.createViews(ctx, id);
        RemoteViews first = rv.sized != null ? rv.sized.values().iterator().next() : rv;
        if (first.lastBitmap == null) throw new IllegalStateException("no bitmap for widget " + id);
        if (first.description == null || first.description.isEmpty()) throw new IllegalStateException("no description");
        return first.lastBitmap;
    }

    public static void main(String[] args) throws Exception {
        if (args.length > 0) outDir = args[0];
        new File(outDir).mkdirs();
        FakeContext ctx = new FakeContext();
        ctx.assets.baseDir = System.getProperty("widget.assets", "android-native/assets/");
        // fonts: register the bundled subset files as shim "system" fallbacks as well
        Typeface.register("sans-serif", Typeface.NORMAL, Typeface.createFromFile(ctx.assets.baseDir + "fonts/MathMaster-Regular.otf"));
        Typeface.register("sans-serif-medium", Typeface.NORMAL, Typeface.createFromFile(ctx.assets.baseDir + "fonts/MathMaster-Medium.otf"));
        Typeface.register("sans-serif", Typeface.BOLD, Typeface.createFromFile(ctx.assets.baseDir + "fonts/MathMaster-Bold.otf"));
        AppWidgetManager mgr = AppWidgetManager.instance;
        MemPrefs p = ctx.prefs;
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        p.m.put("targetMinutes", 35); p.m.put("elapsedSeconds", 25L * 60L); p.m.put("dayKey", today); p.m.put("currentStreak", 12);
        p.m.put("completedDaysJson", json(sundayPlus(0), sundayPlus(1), sundayPlus(2), sundayPlus(3), sundayPlus(4)));

        // 1. defaults at several launcher sizes (auto composition)
        float[][] sz = { {320, 146}, {146, 146}, {110, 80}, {320, 68}, {250, 250}, {220, 146}, {160, 70} };
        for (int i = 0; i < sz.length; i++) {
            sizes(mgr, 100 + i, sz[i][0], sz[i][1]);
            save(render(ctx, 100 + i), "e2e_auto_" + (int) sz[i][0] + "x" + (int) sz[i][1]);
        }
        // 2. every composition at the size it was designed for (dp = reference px / 2.75)
        String[] comps = MathMasterWidgetRenderer.COMPOSITIONS;
        float[][] design = { {312, 140}, {179, 124}, {156, 135}, {134, 122}, {199, 135}, {390, 57}, {124, 57} };
        for (int i = 0; i < comps.length; i++) {
            int id = 200 + i; sizes(mgr, id, design[i][0], design[i][1]);
            p.m.put("instance_" + id + "_composition", comps[i]);
            p.m.put("instance_" + id + "_contentJson", json("appIdentity", "target", "progress", "remaining", "studyTime", "streak", "weekly", "quiz", "updateStatus"));
            p.m.put("instance_" + id + "_contentSchemaVersion", 3);
            save(render(ctx, id), "e2e_comp_" + comps[i]);
        }
        // 3. variants on the hero: theme, style, content subsets, update badge, disabled
        sizes(mgr, 300, 312, 140); p.m.put("instance_300_composition", "hero_wide");
        p.m.put("instance_300_style", "blur");
        p.m.put("instance_300_contentJson", json("appIdentity", "target", "progress", "streak", "weekly", "quiz")); p.m.put("instance_300_contentSchemaVersion", 3);
        save(render(ctx, 300), "e2e_var_blur");
        sizes(mgr, 301, 312, 140); p.m.put("instance_301_composition", "hero_wide");
        p.m.put("instance_301_contentJson", json("progress", "streak")); p.m.put("instance_301_contentSchemaVersion", 3);
        save(render(ctx, 301), "e2e_var_ring_streak_only");
        sizes(mgr, 302, 312, 140); p.m.put("instance_302_composition", "hero_wide"); p.m.put("instance_302_style", "transparent");
        p.m.put("instance_302_contentJson", json("appIdentity", "target", "progress", "remaining", "streak", "weekly", "quiz")); p.m.put("instance_302_contentSchemaVersion", 3);
        save(render(ctx, 302), "e2e_var_transparent");
        sizes(mgr, 304, 312, 140); p.m.put("instance_304_composition", "hero_wide");
        p.m.put("instance_304_contentJson", json("appIdentity", "studyTime", "remaining", "weekly")); p.m.put("instance_304_contentSchemaVersion", 3);
        save(render(ctx, 304), "e2e_var_study_remaining_only");
        // old-schema instance (no quiz key, schema 2) must gain the quiz tile through migration
        sizes(mgr, 303, 312, 140); p.m.put("instance_303_composition", "hero_wide"); p.m.put("instance_303_style", "blur");
        p.m.put("instance_303_contentJson", json("appIdentity", "target", "progress", "streak", "weekly")); p.m.put("instance_303_contentSchemaVersion", 2);
        save(render(ctx, 303), "e2e_var_migrated");
        System.out.println("migrated schema -> " + p.m.get("instance_303_contentSchemaVersion") + " json " + p.m.get("instance_303_contentJson") + " style " + p.m.get("instance_303_style"));
        p.m.put("updateAvailable", true); p.m.put("hasCheckedUpdates", true); p.m.put("installedVersionName", "1.0.0"); p.m.put("latestVersionName", "1.1.0"); p.m.put("latestVersionCode", 11L); p.m.put("installedVersionCode", 10L);
        save(render(ctx, 200), "e2e_var_update_badge");
        p.m.put("updateAvailable", false);
        p.m.put("enabled", false);
        save(render(ctx, 200), "e2e_var_disabled");
        p.m.put("enabled", true);
        // 4. extremes: zero progress, full progress, streak 0, three-digit values
        p.m.put("elapsedSeconds", 0L); p.m.put("currentStreak", 0); p.m.put("completedDaysJson", "[]");
        save(render(ctx, 200), "e2e_var_zero");
        p.m.put("elapsedSeconds", 400L * 60L); p.m.put("currentStreak", 365); p.m.put("targetMinutes", 120); p.m.put("completedDaysJson", json(sundayPlus(0), sundayPlus(1), sundayPlus(2), sundayPlus(3), sundayPlus(4), sundayPlus(5), sundayPlus(6)));
        save(render(ctx, 200), "e2e_var_full");
        // 5. config preview helper
        Set<String> all = new HashSet<>(Arrays.asList(MathMasterHomeWidgetProvider.CONTENT_OPTIONS));
        Bitmap prev = MathMasterHomeWidgetProvider.renderConfigurationPreview(ctx, "auto", "neon", all, 312, 140);
        save(prev, "e2e_config_preview");
        System.out.println("E2E OK");
    }
}
