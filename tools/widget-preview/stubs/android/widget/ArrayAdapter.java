package android.widget;
import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
public class ArrayAdapter<T> {
    private final Context context;
    private final T[] values;
    public ArrayAdapter(Context context, int resource, T[] values) {
        this.context = context;
        this.values = values;
    }
    public void setDropDownViewResource(int resource) {}
    public View getView(int position, View convertView, ViewGroup parent) {
        android.widget.TextView text = new android.widget.TextView(context);
        text.setText(String.valueOf(values[position]));
        return text;
    }
    public View getDropDownView(int position, View convertView, ViewGroup parent) {
        return getView(position, convertView, parent);
    }
}
