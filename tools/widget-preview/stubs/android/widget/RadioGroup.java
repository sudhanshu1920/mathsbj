package android.widget;
import android.content.Context;
public class RadioGroup extends LinearLayout {
    public RadioGroup(Context c) { super(c); }
    public void check(int id) {} public int getCheckedRadioButtonId() { return -1; }
    public interface OnCheckedChangeListener { void onCheckedChanged(RadioGroup g, int id); }
    public void setOnCheckedChangeListener(OnCheckedChangeListener l) {}
    public static class LayoutParams extends LinearLayout.LayoutParams { public LayoutParams(int w, int h) { super(w, h); } public LayoutParams(int w, int h, float wt) { super(w, h, wt); } }
}
