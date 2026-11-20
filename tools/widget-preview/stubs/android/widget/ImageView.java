package android.widget;
import android.content.Context;
import android.graphics.Bitmap;
public class ImageView extends android.view.View {
    public enum ScaleType { FIT_CENTER, CENTER_CROP, FIT_XY }
    public ImageView(Context c){super(c);}
    public void setScaleType(ScaleType type){}
    public void setAdjustViewBounds(boolean enabled){}
    public void setMaxHeight(int height){}
    public void setImageBitmap(Bitmap bitmap){}
    public void setImageDrawable(Object drawable){}
}
