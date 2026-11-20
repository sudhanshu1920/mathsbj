package android.view;
import android.content.Context;
public class ViewGroup extends View {
    public ViewGroup(Context c){super(c);}
    public static class LayoutParams {
        public static final int MATCH_PARENT=-1, WRAP_CONTENT=-2;
        public int width, height, leftMargin, topMargin, rightMargin, bottomMargin;
        public LayoutParams(int width,int height){super();this.width=width;this.height=height;}
        public void setMargins(int left,int top,int right,int bottom){leftMargin=left;topMargin=top;rightMargin=right;bottomMargin=bottom;}
        public void setMarginEnd(int margin){rightMargin=margin;}
    }
    public void addView(View view){if(view!=null)view.setParent(this);}
    public void addView(View view, LayoutParams params){if(view!=null)view.setParent(this);}
    public void removeView(View view){if(view!=null)view.setParent(null);}
    public void removeAllViews(){}
}
