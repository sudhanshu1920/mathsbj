package android.view;

import android.content.Context;

public class Window {
    private final View decorView;

    public Window(Context context) {
        decorView = new View(context);
    }

    public void setStatusBarColor(int color) {}
    public void setNavigationBarColor(int color) {}
    public View getDecorView() { return decorView; }
}
