package android.widget;
import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
public class LinearLayout extends ViewGroup {
    public static final int HORIZONTAL=0, VERTICAL=1;
    private int orientation=HORIZONTAL;
    public LinearLayout(Context c){super(c);}
    public void setOrientation(int value){orientation=value;}
    public int getOrientation(){return orientation;}
    public void setGravity(int gravity){}
    public static class LayoutParams extends ViewGroup.LayoutParams {
        public float weight;
        public LayoutParams(int width,int height){super(width,height);}
        public LayoutParams(int width,int height,float weight){super(width,height);this.weight=weight;}
    }
    @Override public void addView(View view){super.addView(view);}
    @Override public void addView(View view, ViewGroup.LayoutParams params){super.addView(view,params);}
}
