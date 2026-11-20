package android.graphics;
import java.awt.image.BufferedImage;
public class Bitmap {
    public enum Config { ARGB_8888, RGB_565 }
    public final BufferedImage image; private int density = 160; private boolean recycled = false;
    Bitmap(BufferedImage im) { image = im; }
    public static Bitmap createBitmap(int w, int h, Config c) {
        if (w <= 0 || h <= 0) throw new IllegalArgumentException("width and height must be > 0");
        return new Bitmap(new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB));
    }
    public int getWidth() { return image.getWidth(); }
    public int getHeight() { return image.getHeight(); }
    public int getByteCount() { return Math.max(0, getWidth() * getHeight() * 4); }
    public boolean isRecycled() { return recycled; }
    public void setDensity(int d) { density = d; }
    public int getDensity() { return density; }
    public void recycle() { recycled = true; }
}
