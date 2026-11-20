package android.widget;
import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
public class AdapterView<T> extends ViewGroup {
    public AdapterView(Context context) { super(context); }
    public interface OnItemSelectedListener {
        void onItemSelected(AdapterView<?> parent, View view, int position, long id);
        void onNothingSelected(AdapterView<?> parent);
    }
    public void setOnItemSelectedListener(OnItemSelectedListener listener) {}
}
