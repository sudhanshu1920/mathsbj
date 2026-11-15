package android.content;
import java.util.Map;
public interface SharedPreferences {
    String getString(String key, String def); int getInt(String key, int def); long getLong(String key, long def);
    boolean getBoolean(String key, boolean def); boolean contains(String key); Map<String, ?> getAll(); Editor edit();
    interface Editor {
        Editor putString(String k, String v); Editor putInt(String k, int v); Editor putLong(String k, long v);
        Editor putBoolean(String k, boolean v); Editor remove(String k); void apply(); boolean commit();
    }
}
