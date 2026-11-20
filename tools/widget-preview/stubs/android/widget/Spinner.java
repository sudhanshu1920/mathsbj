package android.widget;
import android.content.Context;
public class Spinner extends AdapterView<ArrayAdapter<?>> {
    private int selected;
    public Spinner(Context context) { super(context); }
    public void setAdapter(ArrayAdapter<?> adapter) {}
    public void setSelection(int position) { selected=position; }
    public int getSelectedItemPosition() { return selected; }
    public Object getSelectedItem() { return null; }
    public void setPadding(int left,int top,int right,int bottom) {}
}
