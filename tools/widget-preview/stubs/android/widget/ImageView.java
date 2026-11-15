package android.widget;
import android.content.Context; import android.graphics.Bitmap;
public class ImageView extends android.view.View {
    public enum ScaleType { FIT_CENTER, CENTER_CROP, FIT_XY }
    public ImageView(Context c) { super(c); }
    public void setScaleType(ScaleType t) {} public void setAdjustViewBounds(boolean b) {} public void setMaxHeight(int h) {}
    public void setImageBitmap(Bitmap b) {}
}
