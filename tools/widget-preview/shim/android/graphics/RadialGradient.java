package android.graphics;
import java.awt.geom.Point2D;
public class RadialGradient extends Shader {
    public RadialGradient(float cx, float cy, float r, int[] colors, float[] stops, TileMode tile) {
        awt = new java.awt.RadialGradientPaint(new Point2D.Float(cx, cy), Math.max(r, 1e-3f),
            fixPositions(stops, colors.length), toAwt(colors), java.awt.MultipleGradientPaint.CycleMethod.NO_CYCLE);
    }
    public RadialGradient(float cx, float cy, float r, int c0, int c1, TileMode tile) {
        this(cx, cy, r, new int[] { c0, c1 }, null, tile);
    }
}
