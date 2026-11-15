package android.app;
import android.content.*; import android.content.pm.PackageManager; import android.content.res.*;
public class Activity extends Context {
    public static final int RESULT_OK = -1, RESULT_CANCELED = 0;
    public Intent getIntent() { return new Intent(); }
    public void setResult(int r) {} public void setResult(int r, Intent i) {} public void finish() {}
    protected void onCreate(android.os.Bundle b) {}
    public void setContentView(android.view.View v) {}
    public SharedPreferences getSharedPreferences(String n, int m) { return null; }
    public String getPackageName() { return ""; } public Resources getResources() { return null; }
    public AssetManager getAssets() { return null; } public Context getApplicationContext() { return this; }
    public PackageManager getPackageManager() { return null; }
}
