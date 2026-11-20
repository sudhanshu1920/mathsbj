package android.content;
public class Intent {
    public static final int FLAG_ACTIVITY_NEW_TASK = 0x10000000;
    public static final int FLAG_ACTIVITY_CLEAR_TOP = 0x04000000, FLAG_ACTIVITY_SINGLE_TOP = 0x20000000;
    private String action, stringExtra;
    private int intExtra;
    private boolean booleanExtra;
    public Intent() {}
    public Intent(Context context, Class<?> target) {}
    public Intent addFlags(int flags) { return this; }
    public Intent setAction(String value) { action=value; return this; }
    public Intent putExtra(String key, String value) { stringExtra=value; return this; }
    public Intent putExtra(String key, int value) { intExtra=value; return this; }
    public Intent putExtra(String key, boolean value) { booleanExtra=value; return this; }
    public Intent putExtra(String key, long value) { return this; }
    public int getIntExtra(String key, int fallback) { return intExtra; }
    public boolean getBooleanExtra(String key, boolean fallback) { return booleanExtra; }
    public String getStringExtra(String key) { return stringExtra; }
    public String getAction() { return action; }
}
