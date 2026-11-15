package android.appwidget;
import android.content.Context; import android.os.Bundle;
public class AppWidgetProvider {
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {}
    public void onDeleted(Context c, int[] ids) {}
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) {}
}
