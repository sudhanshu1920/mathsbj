package android.graphics;
import java.awt.geom.Point2D;
public class LinearGradient extends Shader {
    public LinearGradient(float x0, float y0, float x1, float y1, int[] colors, float[] pos, TileMode tile) {
        if (Math.abs(x1 - x0) < 1e-3f && Math.abs(y1 - y0) < 1e-3f) y1 = y0 + 1e-2f;
        awt = new java.awt.LinearGradientPaint(new Point2D.Float(x0, y0), new Point2D.Float(x1, y1),
            fixPositions(pos, colors.length), toAwt(colors), java.awt.MultipleGradientPaint.CycleMethod.NO_CYCLE);
    }
    public LinearGradient(float x0, float y0, float x1, float y1, int c0, int c1, TileMode tile) {
        this(x0, y0, x1, y1, new int[] { c0, c1 }, null, tile);
    }
}
