package android.widget;
import android.content.Context;
public class CompoundButton extends Button {
    public CompoundButton(Context c) { super(c); }
    public void setButtonTintList(android.content.res.ColorStateList l) {}
    public void setChecked(boolean b) {} public boolean isChecked() { return false; }
    public interface OnCheckedChangeListener { void onCheckedChanged(CompoundButton b, boolean checked); }
    public void setOnCheckedChangeListener(OnCheckedChangeListener l) {}
}
