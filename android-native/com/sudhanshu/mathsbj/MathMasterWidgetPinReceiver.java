package com.sudhanshu.mathsbj;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/** Handles the launcher callback after the user confirms that a widget was pinned. */
public final class MathMasterWidgetPinReceiver extends BroadcastReceiver {
    private static final String TAG = "MathMasterWidgets";
    public static final String ACTION_PIN_CONFIRMED =
        "com.sudhanshu.mathsbj.action.WIDGET_PIN_CONFIRMED";
    public static final String EXTRA_COMPOSITION = "mathMasterWidgetComposition";
    private static final String PREFS = "math_master_home_widget";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_PIN_CONFIRMED.equals(intent.getAction())) return;
        int widgetId = intent.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            Log.w(TAG, "pinCallback [WIDGET_PIN_CALLBACK_MISSING_ID]");
            return;
        }
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, MathMasterHomeWidgetProvider.class);
        int[] activeIds = manager.getAppWidgetIds(provider);
        boolean active = false;
        if (activeIds != null) {
            for (int activeId : activeIds) {
                if (activeId == widgetId) { active = true; break; }
            }
        }
        if (!active) {
            Log.w(TAG, "pinCallback [WIDGET_PIN_CALLBACK_STALE_ID]");
            return;
        }
        try {
            String composition = intent.getStringExtra(EXTRA_COMPOSITION);
            if (isSupportedComposition(composition)) {
                boolean saved = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putString("instance_" + widgetId + "_composition", composition)
                    .commit();
                if (!saved) {
                    Log.e(TAG, "pinCallback [WIDGET_DESIGN_SAVE_FAILED]");
                    return;
                }
            }
            manager.updateAppWidget(widgetId, MathMasterHomeWidgetProvider.createViews(context, widgetId));
            Log.i(TAG, "pinCallback [WIDGET_PIN_CONFIRMED]");
        } catch (RuntimeException error) {
            Log.e(TAG, "pinCallback [WIDGET_PIN_INITIALIZATION_FAILED]", error);
        }
    }

    private static boolean isSupportedComposition(String value) {
        if (value == null) return false;
        for (String[] option : MathMasterHomeWidgetProvider.getWidgetCompositionOptions()) {
            if (option[0].equals(value)) return true;
        }
        return false;
    }
}
