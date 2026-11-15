package android.os;
import java.util.*;
public class Bundle {
    public static final Bundle EMPTY = new Bundle();
    public Map<String, Object> map = new HashMap<>();
    public int getInt(String k, int d) { Object v = map.get(k); return v instanceof Integer ? (Integer) v : d; }
    @SuppressWarnings("unchecked") public <T> ArrayList<T> getParcelableArrayList(String k) { return (ArrayList<T>) map.get(k); }
}
