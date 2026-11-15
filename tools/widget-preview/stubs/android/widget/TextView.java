package android.widget;
import android.content.Context; import android.view.View;
public class TextView extends View {
    public TextView(Context c) { super(c); }
    public void setText(CharSequence t) {} public void setTextColor(int c) {} public void setTextSize(float s) {}
    public void setTypeface(android.graphics.Typeface t, int style) {}
    public void setMaxLines(int n) {} public void setEllipsize(android.text.TextUtils.TruncateAt t) {}
}
