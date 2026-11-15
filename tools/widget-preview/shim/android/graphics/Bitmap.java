package android.graphics;
import java.awt.image.BufferedImage;
public class Bitmap {
    public enum Config { ARGB_8888, RGB_565 }
    public final BufferedImage image; private int density = 160;
    Bitmap(BufferedImage im) { image = im; }
    public static Bitmap createBitmap(int w, int h, Config c) {
        if (w <= 0 || h <= 0) throw new IllegalArgumentException("width and height must be > 0");
        return new Bitmap(new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB));
    }
    public int getWidth() { return image.getWidth(); }
    public int getHeight() { return image.getHeight(); }
    public void setDensity(int d) { density = d; }
    public int getDensity() { return density; }
    public void recycle() {}
}
