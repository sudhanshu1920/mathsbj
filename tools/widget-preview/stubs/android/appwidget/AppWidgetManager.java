package android.appwidget;
import android.content.*; import android.os.Bundle; import android.widget.RemoteViews;
public class AppWidgetManager {
    public static final int INVALID_APPWIDGET_ID = 0;
    public static final String EXTRA_APPWIDGET_ID = "appWidgetId";
    public static final String OPTION_APPWIDGET_MIN_WIDTH = "appWidgetMinWidth", OPTION_APPWIDGET_MIN_HEIGHT = "appWidgetMinHeight",
        OPTION_APPWIDGET_MAX_WIDTH = "appWidgetMaxWidth", OPTION_APPWIDGET_MAX_HEIGHT = "appWidgetMaxHeight", OPTION_APPWIDGET_SIZES = "appWidgetSizes";
    public static AppWidgetManager instance = new AppWidgetManager();
    public java.util.Map<Integer, Bundle> options = new java.util.HashMap<>();
    public java.util.Map<Integer, RemoteViews> pushed = new java.util.HashMap<>();
    public static AppWidgetManager getInstance(Context c) { return instance; }
    public int[] getAppWidgetIds(ComponentName n) { int[] ids = new int[options.size()]; int i = 0; for (int k : options.keySet()) ids[i++] = k; return ids; }
    public Bundle getAppWidgetOptions(int id) { return options.get(id); }
    public void updateAppWidget(int id, RemoteViews v) { pushed.put(id, v); }
}
