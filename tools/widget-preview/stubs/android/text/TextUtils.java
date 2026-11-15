package android.text;
public class TextUtils {
    public enum TruncateAt { START, MIDDLE, END }
    public static String join(CharSequence d, Iterable<?> items) { StringBuilder b = new StringBuilder(); boolean f = true; for (Object o : items) { if (!f) b.append(d); f = false; b.append(o); } return b.toString(); }
}
