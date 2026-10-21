package com.sudhanshu.mathsbj;

import android.app.Activity;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "GameImmersive")
public class GameImmersivePlugin extends Plugin {
    private int previousSystemUiVisibility;
    private boolean hasSavedSystemUiVisibility = false;

    @PluginMethod
    public void enter(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity is unavailable");
            return;
        }

        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            View decorView = window.getDecorView();

            if (!hasSavedSystemUiVisibility) {
                previousSystemUiVisibility = decorView.getSystemUiVisibility();
                hasSavedSystemUiVisibility = true;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = window.getInsetsController();
                if (controller != null) {
                    controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    );
                    controller.hide(
                        WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars()
                    );
                }
            } else {
                int flags =
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                decorView.setSystemUiVisibility(flags);
            }

            call.resolve();
        });
    }

    @PluginMethod
    public void exit(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }

        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            View decorView = window.getDecorView();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = window.getInsetsController();
                if (controller != null) {
                    controller.show(
                        WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars()
                    );
                }
            } else if (hasSavedSystemUiVisibility) {
                decorView.setSystemUiVisibility(previousSystemUiVisibility);
            }

            if (hasSavedSystemUiVisibility && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                decorView.setSystemUiVisibility(previousSystemUiVisibility);
            }
            hasSavedSystemUiVisibility = false;
            call.resolve();
        });
    }
}
