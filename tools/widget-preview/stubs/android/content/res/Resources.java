package android.content.res;
import android.util.DisplayMetrics;
public class Resources {
    private final DisplayMetrics metrics = new DisplayMetrics();
    private final Configuration configuration = new Configuration();
    public DisplayMetrics getDisplayMetrics() { return metrics; }
    public Configuration getConfiguration() { return configuration; }
    public Theme newTheme() { return new Theme(); }
    public static class Theme {
        public boolean resolveAttribute(int attribute, android.util.TypedValue value, boolean resolveRefs) {
            if (value != null) value.data = 0xff6578d7;
            return true;
        }
    }
}
