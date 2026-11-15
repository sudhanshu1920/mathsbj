package com.sudhanshu.mathsbj;

import android.graphics.Bitmap;
import android.graphics.Typeface;
import javax.imageio.ImageIO;
import java.io.File;

/** Renders the static widget-picker preview with the exact same renderer the widget uses. */
public class MakePreview {
    public static void main(String[] args) throws Exception {
        String dir = System.getProperty("widget.assets", "android-native/assets/") + "fonts/";
        Typeface regular = Typeface.createFromFile(dir + "MathMaster-Regular.otf");
        Typeface medium = Typeface.createFromFile(dir + "MathMaster-Medium.otf");
        Typeface bold = Typeface.createFromFile(dir + "MathMaster-Bold.otf");
        MathMasterWidgetRenderer.Data d = new MathMasterWidgetRenderer.Data();
        d.progress = 72; d.elapsedMinutes = 25; d.targetMinutes = 35; d.remainingMinutes = 10; d.streak = 12;
        d.weekDone = new boolean[] { true, true, true, true, true, false, false }; d.todayIndex = 4;
        MathMasterWidgetRenderer.Options o = new MathMasterWidgetRenderer.Options();
        o.composition = "hero_wide"; o.remaining = false; o.studyTime = false; o.update = false;
        Bitmap b = MathMasterWidgetRenderer.render(new MathMasterWidgetRenderer.Fonts(regular, medium, bold), d, o, 800, 365, 2.5f);
        ImageIO.write(b.image, "png", new File(args[0]));
        System.out.println("preview " + b.getWidth() + "x" + b.getHeight());
    }
}
