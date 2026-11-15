package android.graphics;
import java.awt.*;
import java.awt.geom.*;
import java.awt.image.*;
public class SweepGradient extends Shader {
    public SweepGradient(final float cx, final float cy, final int[] colors, float[] positions) {
        final float[] pos = fixPositions(positions, colors.length);
        awt = new java.awt.Paint() {
            public int getTransparency() { return TRANSLUCENT; }
            public PaintContext createContext(ColorModel cm, Rectangle db, Rectangle2D ub, AffineTransform xf, RenderingHints h) {
                final AffineTransform inv;
                try { inv = xf.createInverse(); } catch (NoninvertibleTransformException e) { throw new RuntimeException(e); }
                return new PaintContext() {
                    public void dispose() {}
                    public ColorModel getColorModel() { return ColorModel.getRGBdefault(); }
                    public Raster getRaster(int x, int y, int w, int hh) {
                        WritableRaster r = getColorModel().createCompatibleWritableRaster(w, hh);
                        int[] px = new int[w * hh]; double[] pt = new double[2];
                        for (int j = 0; j < hh; j++) for (int i = 0; i < w; i++) {
                            pt[0] = x + i + 0.5; pt[1] = y + j + 0.5; inv.transform(pt, 0, pt, 0, 1);
                            double a = Math.atan2(pt[1] - cy, pt[0] - cx); if (a < 0) a += Math.PI * 2;
                            px[j * w + i] = colorAt((float) (a / (Math.PI * 2)));
                        }
                        r.setDataElements(0, 0, w, hh, px); return r;
                    }
                };
            }
            int colorAt(float t) {
                if (t <= pos[0]) return colors[0];
                for (int k = 1; k < pos.length; k++) if (t <= pos[k]) {
                    float f = (t - pos[k - 1]) / (pos[k] - pos[k - 1]); int c0 = colors[k - 1], c1 = colors[k];
                    int a = (int) (Color.alpha(c0) + (Color.alpha(c1) - Color.alpha(c0)) * f), r = (int) (Color.red(c0) + (Color.red(c1) - Color.red(c0)) * f);
                    int g = (int) (Color.green(c0) + (Color.green(c1) - Color.green(c0)) * f), b = (int) (Color.blue(c0) + (Color.blue(c1) - Color.blue(c0)) * f);
                    return Color.argb(a, r, g, b);
                }
                return colors[colors.length - 1];
            }
        };
    }
    public SweepGradient(float cx, float cy, int c0, int c1) { this(cx, cy, new int[] { c0, c1 }, null); }
}
