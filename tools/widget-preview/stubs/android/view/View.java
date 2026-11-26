package android.view;
import android.content.Context;
public class View {
    public static final int GONE=8, INVISIBLE=4, VISIBLE=0, IMPORTANT_FOR_ACCESSIBILITY_NO=2;
    public static final int SYSTEM_UI_FLAG_LIGHT_STATUS_BAR=8192, SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR=16;
    private static int nextId=1;
    private int id, visibility=VISIBLE, systemUiVisibility;
    private Object tag, parent;
    public static int generateViewId(){return nextId++;}
    public View(Context c) {}
    public int getId(){return id;} public void setId(int value){id=value;}
    public void setTag(Object value){tag=value;} public Object getTag(){return tag;}
    public void setBackground(android.graphics.drawable.GradientDrawable drawable) {}
    public void setBackgroundColor(int color) {}
    public void setClipToOutline(boolean value) {} public void setClipToPadding(boolean value) {}
    public void setElevation(float value) {}
    public void setPadding(int left,int top,int right,int bottom) {}
    public void setVisibility(int value){visibility=value;} public int getVisibility(){return visibility;}
    public int getSystemUiVisibility(){return systemUiVisibility;}
    public void setSystemUiVisibility(int value){systemUiVisibility=value;}
    public void setContentDescription(CharSequence description) {}
    public void setOnClickListener(OnClickListener listener) {}
    public void setMinHeight(int height) {}
    public Object getParent(){return parent;}
    public void setParent(Object value){parent=value;}
    public <T extends View> T findViewById(int value){return null;}
    public interface OnClickListener { void onClick(View view); }
}
