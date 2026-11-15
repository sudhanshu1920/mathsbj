package android.view;
import android.content.Context;
public class View {
    public static final int GONE = 8, VISIBLE = 0, IMPORTANT_FOR_ACCESSIBILITY_NO = 2;
    private static int nextId = 1; public static int generateViewId() { return nextId++; }
    private int id; private Object tag;
    public View(Context c) {}
    public int getId() { return id; } public void setId(int i) { id = i; }
    public void setTag(Object t) { tag = t; } public Object getTag() { return tag; }
    public void setBackground(android.graphics.drawable.GradientDrawable d) {}
    public void setBackgroundColor(int c) {}
    public void setClipToOutline(boolean b) {} public void setElevation(float e) {}
    public void setPadding(int l, int t, int r, int b) {} public void setVisibility(int v) {}
    public void setContentDescription(CharSequence c) {}
    public void setOnClickListener(OnClickListener l) {}
    public <T extends View> T findViewById(int id) { return null; }
    public interface OnClickListener { void onClick(View v); }
}
