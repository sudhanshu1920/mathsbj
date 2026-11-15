package android.widget;
import android.app.PendingIntent; import android.graphics.Bitmap; import android.util.SizeF; import java.util.*;
public class RemoteViews {
    public Bitmap lastBitmap; public String description; public PendingIntent click; public Map<SizeF, RemoteViews> sized;
    public RemoteViews(String pkg, int layout) {}
    public RemoteViews(Map<SizeF, RemoteViews> m) { sized = m; }
    public void setImageViewBitmap(int id, Bitmap b) { lastBitmap = b; }
    public void setContentDescription(int id, CharSequence d) { description = String.valueOf(d); }
    public void setOnClickPendingIntent(int id, PendingIntent p) { click = p; }
}
