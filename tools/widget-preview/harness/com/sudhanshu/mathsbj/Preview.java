package com.sudhanshu.mathsbj;

import android.graphics.Bitmap;
import android.graphics.Typeface;
import javax.imageio.ImageIO;
import java.io.File;

/** Renders every composition at the size it was laid out for (device px at 2.75x density). */
public class Preview {
    static MathMasterWidgetRenderer.Fonts fonts() {
        String dir = System.getProperty("widget.assets", "android-native/assets/") + "fonts/";
        Typeface regular = Typeface.createFromFile(dir + "MathMaster-Regular.otf");
        Typeface medium = Typeface.createFromFile(dir + "MathMaster-Medium.otf");
        Typeface bold = Typeface.createFromFile(dir + "MathMaster-Bold.otf");
        Typeface.register("sans-serif", Typeface.NORMAL, regular);
        Typeface.register("sans-serif-medium", Typeface.NORMAL, medium);
        Typeface.register("sans-serif", Typeface.BOLD, bold);
        return new MathMasterWidgetRenderer.Fonts(regular, medium, bold);
    }

    static MathMasterWidgetRenderer.Data data() {
        MathMasterWidgetRenderer.Data d = new MathMasterWidgetRenderer.Data();
        d.progress = 72; d.elapsedMinutes = 25; d.targetMinutes = 35; d.remainingMinutes = 10; d.streak = 12;
        d.weekDone = new boolean[] { true, true, true, true, true, false, false };
        d.todayIndex = 4;
        return d;
    }

    static void save(Bitmap b, String path) throws Exception { ImageIO.write(b.image, "png", new File(path)); }

    public static void main(String[] args) throws Exception {
        String out = args.length > 0 ? args[0] : "out";
        new File(out).mkdirs();
        MathMasterWidgetRenderer.Fonts fonts = fonts();
        MathMasterWidgetRenderer.Data data = data();
        float density = 2.75f;
        Object[][] specs = {
            { "hero_wide", 858, 384 }, { "compact_green", 493, 341 }, { "square_math_bot", 428, 371 },
            { "square_cosmic", 548, 371 }, { "medium_study", 369, 336 }, { "extra_wide_weekly", 1073, 156 },
            { "minimal_progress", 341, 158 },
        };
        for (Object[] s : specs) {
            MathMasterWidgetRenderer.Options o = new MathMasterWidgetRenderer.Options();
            o.composition = (String) s[0];
            int w = (Integer) s[1] + 9, h = (Integer) s[2] + 9;
            long t0 = System.nanoTime();
            Bitmap b = MathMasterWidgetRenderer.render(fonts, data, o, w, h, density);
            long ms = (System.nanoTime() - t0) / 1_000_000;
            save(b, out + "/" + s[0] + ".png");
            save(b, out + "/before_baseline_" + s[0] + ".png");
            System.out.println(s[0] + " " + w + "x" + h + " rendered in " + ms + " ms");
        }
    }
}
