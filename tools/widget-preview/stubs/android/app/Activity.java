package android.app;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.res.*;
import android.view.View;
import android.view.Window;
public class Activity extends Context {
    public static final int RESULT_OK = -1, RESULT_CANCELED = 0;
    private final Resources resources = new Resources();
    private final Window window = new Window(this);
    public Intent getIntent() { return new Intent(); }
    public void setResult(int result) {}
    public void setResult(int result, Intent data) {}
    public void finish() {}
    public boolean isFinishing() { return false; }
    protected void onCreate(android.os.Bundle state) {}
    protected void onResume() {}
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {}
    protected void onDestroy() {}
    public void startActivity(Intent intent) {}
    public void startActivityForResult(Intent intent, int requestCode) {}
    public void setContentView(View view) {}
    public SharedPreferences getSharedPreferences(String name, int mode) { return null; }
    public String getPackageName() { return ""; }
    public Resources getResources() { return resources; }
    public Resources.Theme getTheme() { return resources.newTheme(); }
    public AssetManager getAssets() { return null; }
    public Context getApplicationContext() { return this; }
    public PackageManager getPackageManager() { return null; }
    public Window getWindow() { return window; }
}
