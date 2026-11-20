package android.content;
import java.util.Map;
import java.util.Set;
public interface SharedPreferences {
    String getString(String key,String def);
    int getInt(String key,int def);
    long getLong(String key,long def);
    boolean getBoolean(String key,boolean def);
    float getFloat(String key,float def);
    Set<String> getStringSet(String key,Set<String> def);
    boolean contains(String key);
    Map<String,?> getAll();
    Editor edit();
    interface Editor {
        Editor putString(String key,String value);
        Editor putInt(String key,int value);
        Editor putLong(String key,long value);
        Editor putFloat(String key,float value);
        Editor putBoolean(String key,boolean value);
        Editor putStringSet(String key,Set<String> value);
        Editor remove(String key);
        void apply();
        boolean commit();
    }
}
