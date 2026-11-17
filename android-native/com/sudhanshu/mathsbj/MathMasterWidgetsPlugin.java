package com.sudhanshu.mathsbj;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;

import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "MathMasterWidgets")
public class MathMasterWidgetsPlugin extends Plugin {
    private static final String PREFS = "math_master_home_widget";
    private static final Set<String> CONTENT_OPTIONS = new HashSet<>(Arrays.asList(
        "appIdentity", "target", "progress", "remaining", "studyTime",
        "streak", "weekly", "quiz", "updateStatus"
    ));

    @PluginMethod
    public void getWidgets(PluginCall call) {
        try {
            Context context = getContext();
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, MathMasterHomeWidgetProvider.class));
            Arrays.sort(ids);
            SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSArray widgets = new JSArray();
            JSArray designs = new JSArray();
            for (String[] option : MathMasterHomeWidgetProvider.getWidgetCompositionOptions()) {
                JSObject design = new JSObject();
                design.put("id", option[0]);
                design.put("name", option[1]);
                designs.put(design);
            }
            for (int id : ids) {
                Bundle options = manager.getAppWidgetOptions(id);
                int width = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
                int height = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
                if (width <= 0 && options != null) width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0);
                if (height <= 0 && options != null) height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);

                String prefix = "instance_" + id + "_";
                JSObject item = new JSObject();
                item.put("appWidgetId", id);
                item.put("composition", safeComposition(preferences.getString(
                    prefix + "composition", preferences.getString("composition", "auto"))));
                item.put("style", MathMasterHomeWidgetProvider.normalizeWidgetStyle(preferences.getString(
                    prefix + "style", preferences.getString("style", "neon"))));
                item.put("widthDp", Math.max(0, width));
                item.put("heightDp", Math.max(0, height));
                item.put("content", readContent(preferences.getString(
                    prefix + "contentJson", preferences.getString("contentJson", null))));
                widgets.put(item);
            }
            JSObject result = new JSObject();
            result.put("widgets", widgets);
            result.put("designs", designs);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to read Android home-screen widgets.", error);
        }
    }

    @PluginMethod
    public void requestAdd(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            JSObject result = new JSObject();
            result.put("requested", false);
            result.put("supported", false);
            call.resolve(result);
            return;
        }
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
            if (!manager.isRequestPinAppWidgetSupported()) {
                JSObject result = new JSObject();
                result.put("requested", false);
                result.put("supported", false);
                call.resolve(result);
                return;
            }
            boolean requested = manager.requestPinAppWidget(
                new ComponentName(getContext(), MathMasterHomeWidgetProvider.class), null, null);
            JSObject result = new JSObject();
            result.put("requested", requested);
            result.put("supported", true);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Android could not start the widget pin confirmation.", error);
        }
    }

    @PluginMethod
    public void configureWidget(PluginCall call) {
        int id = call.getInt("appWidgetId", AppWidgetManager.INVALID_APPWIDGET_ID);
        if (!isActiveWidgetId(id)) {
            call.reject("That Math Master widget is no longer on the home screen. Refresh the list and try again.");
            return;
        }
        try {
            Intent intent = new Intent(getContext(), MathMasterWidgetConfigActivity.class);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Unable to open this widget's Android customization screen.", error);
        }
    }

    @PluginMethod
    public void resetWidget(PluginCall call) {
        int id = call.getInt("appWidgetId", AppWidgetManager.INVALID_APPWIDGET_ID);
        if (!isActiveWidgetId(id)) {
            call.reject("That Math Master widget is no longer on the home screen. Refresh the list and try again.");
            return;
        }
        JSONArray defaults = new JSONArray();
        for (String option : MathMasterHomeWidgetProvider.CONTENT_OPTIONS) defaults.put(option);
        String prefix = "instance_" + id + "_";
        SharedPreferences preferences = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean saved = preferences.edit()
            .putString(prefix + "composition", "auto")
            .putString(prefix + "style", "neon")
            .putString(prefix + "contentJson", defaults.toString())
            .putInt(prefix + "contentSchemaVersion", 3)
            .commit();
        if (!saved) {
            call.reject("Android could not save the widget's default settings. The previous values were kept.");
            return;
        }
        try {
            AppWidgetManager.getInstance(getContext()).updateAppWidget(
                id, MathMasterHomeWidgetProvider.createViews(getContext(), id));
            JSObject result = new JSObject();
            result.put("reset", true);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("The default settings were saved, but Android could not refresh the widget.", error);
        }
    }

    @PluginMethod
    public void renderPreview(PluginCall call) {
        int id = call.getInt("appWidgetId", AppWidgetManager.INVALID_APPWIDGET_ID);
        if (!isActiveWidgetId(id)) {
            call.reject("That widget is no longer active. Refresh the list and try again.");
            return;
        }
        Bitmap bitmap = null;
        try {
            bitmap = MathMasterHomeWidgetProvider.renderWidgetInstancePreview(getContext(), id);
            if (bitmap == null) {
                call.reject("The widget preview is unavailable.");
                return;
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) {
                call.reject("The widget preview could not be encoded.");
                return;
            }
            JSObject result = new JSObject();
            result.put("dataUrl", "data:image/png;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to render this widget preview.", error);
        } catch (OutOfMemoryError error) {
            call.reject("There is not enough memory to render this widget preview.");
        } finally {
            if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle();
        }
    }

    private boolean isActiveWidgetId(int id) {
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return false;
        AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
        int[] ids = manager.getAppWidgetIds(new ComponentName(getContext(), MathMasterHomeWidgetProvider.class));
        for (int activeId : ids) if (activeId == id) return true;
        return false;
    }

    private static String safeComposition(String value) {
        for (String[] option : MathMasterHomeWidgetProvider.getWidgetCompositionOptions()) {
            if (option[0].equals(value)) return value;
        }
        return "auto";
    }

    private static JSONArray readContent(String raw) {
        JSONArray result = new JSONArray();
        if (raw == null) {
            for (String option : MathMasterHomeWidgetProvider.CONTENT_OPTIONS) result.put(option);
            return result;
        }
        if (raw.length() > 4096) {
            result.put("progress");
            return result;
        }
        try {
            JSONArray parsed = new JSONArray(raw);
            for (int i = 0; i < parsed.length(); i++) {
                String value = parsed.optString(i, "");
                if (CONTENT_OPTIONS.contains(value) && !contains(result, value)) result.put(value);
            }
        } catch (JSONException ignored) {
            // Malformed preference data is never reflected back to JavaScript.
            result.put("progress");
            return result;
        }
        if (result.length() == 0) result.put("progress");
        return result;
    }

    private static boolean contains(JSONArray values, String candidate) {
        for (int i = 0; i < values.length(); i++) {
            if (candidate.equals(values.optString(i, ""))) return true;
        }
        return false;
    }
}
