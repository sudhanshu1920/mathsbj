package android.content;
public class Intent {
    public Intent() {}
    public Intent(Context context, Class<?> type) {}
    public static final int FLAG_ACTIVITY_CLEAR_TOP = 0x04000000, FLAG_ACTIVITY_SINGLE_TOP = 0x20000000;
    public Intent addFlags(int f) { return this; }
    public Intent setAction(String a) { return this; }
    public Intent putExtra(String k, String v) { return this; }
    public Intent putExtra(String k, int v) { return this; }
    public int getIntExtra(String k, int d) { return d; }
}
