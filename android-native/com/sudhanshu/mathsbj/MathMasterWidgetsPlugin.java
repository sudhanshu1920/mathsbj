package com.sudhanshu.mathsbj;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.graphics.Bitmap;
import android.util.Log;
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
import java.util.UUID;

@CapacitorPlugin(name = "MathMasterWidgets")
public class MathMasterWidgetsPlugin extends Plugin {
    private static final String TAG = "MathMasterWidgets";
    private static final int PIN_REQUEST_CODE = 8908;
    private static final String PREFS = "math_master_home_widget";
    private static final Set<String> CONTENT_OPTIONS = new HashSet<>(Arrays.asList(
        "appIdentity", "target", "progress", "remaining", "studyTime",
        "streak", "weekly", "quiz", "updateStatus", "studyAppsScreenTime", "deviceAppsScreenTime"
    ));

    @PluginMethod
    public void syncAppearance(PluginCall call) {
        String requestedMode = call.getString("mode");
        String mode = requestedMode == null ? "dark" : requestedMode;
        String accent = call.getString("accentColor");
        if (!"light".equals(mode) && !"dark".equals(mode)) {
            call.reject("INVALID_WIDGET_APPEARANCE: Choose light or dark mode.");
            return;
        }
        if (accent == null || !accent.matches("^#[0-9a-fA-F]{6}$")) {
            call.reject("INVALID_WIDGET_APPEARANCE: The theme accent colour is invalid.");
            return;
        }
        SharedPreferences preferences = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!preferences.edit().putString("mode", mode).putString("appAccentColor", accent).commit()) {
            call.reject("Unable to save the local widget appearance preference.");
            return;
        }
        MathMasterHomeWidgetProvider.updateScreenTimeAppearance(getContext());
        JSObject result = new JSObject();
        result.put("updated", true);
        call.resolve(result);
    }

    @PluginMethod
    public void refreshScreenTime(PluginCall call) {
        try {
            // QueryUsageStats is dispatched to the repository worker; this only schedules a
            // local widget refresh and never uploads app usage to a service.
            MathMasterHomeWidgetProvider.refreshScreenTimeWidgets(getContext());
            JSObject result = new JSObject();
            result.put("scheduled", true);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Unable to schedule the local widget screen-time refresh.", error);
        }
    }

    @PluginMethod
    public void getWidgets(PluginCall call) {
        try {
            Context context = getContext();
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            ComponentName provider = new ComponentName(context, MathMasterHomeWidgetProvider.class);
            int[] ids = manager.getAppWidgetIds(provider);
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
                AppWidgetProviderInfo providerInfo = manager.getAppWidgetInfo(id);
                if (providerInfo == null || providerInfo.provider == null || !provider.equals(providerInfo.provider)) {
                    throw new IllegalStateException("Active Math Master widget provider metadata is unavailable.");
                }
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
                item.put("textScale", MathMasterHomeWidgetProvider.normalizeWidgetTextScale(
                    preferences.getFloat(prefix + "textScale", 1f)));
                item.put("appearance", MathMasterHomeWidgetProvider.normalizeWidgetAppearance(
                    preferences.getString(prefix + "appearance", "dark")));
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
            Log.e(TAG, "getWidgets [WIDGET_DISCOVERY_FAILED]", error);
            call.reject("WIDGET_DISCOVERY_FAILED: Unable to read Math Master home-screen widgets.", error);
        }
    }

    @PluginMethod
    public void getDesigns(PluginCall call) {
        JSArray designs = new JSArray();
        Set<String> selected = new HashSet<>(Arrays.asList(
            "appIdentity", "target", "progress", "remaining", "studyTime", "streak", "weekly", "quiz", "updateStatus"
        ));
        try {
            for (String[] option : MathMasterHomeWidgetProvider.getWidgetCompositionOptions()) {
                JSObject design = new JSObject();
                design.put("id", option[0]);
                design.put("name", option[1]);
                int widthDp = 320;
                int heightDp = 146;
                if (option[0].startsWith("square")) {
                    widthDp = 180;
                    heightDp = 180;
                } else if ("compact_green".equals(option[0]) || "medium_study".equals(option[0])) {
                    widthDp = 240;
                    heightDp = 150;
                } else if ("extra_wide_weekly".equals(option[0])) {
                    widthDp = 320;
                    heightDp = 112;
                } else if ("minimal_progress".equals(option[0])) {
                    widthDp = 180;
                    heightDp = 96;
                }
                Bitmap preview = null;
                try {
                    preview = MathMasterHomeWidgetProvider.renderConfigurationPreview(
                        getContext(), option[0], "neon", selected, widthDp, heightDp);
                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    if (preview == null || !preview.compress(Bitmap.CompressFormat.PNG, 100, output)) {
                        throw new IllegalStateException("The native renderer returned no design preview.");
                    }
                    design.put("previewDataUrl",
                        "data:image/png;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
                    design.put("previewWidthDp", widthDp);
                    design.put("previewHeightDp", heightDp);
                } catch (Exception previewError) {
                    Log.w(TAG, "getDesigns [WIDGET_DESIGN_PREVIEW_FAILED] " + option[0], previewError);
                    design.put("previewDataUrl", "");
                } catch (OutOfMemoryError previewError) {
                    Log.w(TAG, "getDesigns [WIDGET_DESIGN_PREVIEW_OOM] " + option[0], previewError);
                    design.put("previewDataUrl", "");
                } finally {
                    if (preview != null && !preview.isRecycled()) preview.recycle();
                }
                designs.put(design);
            }
            JSObject result = new JSObject();
            result.put("designs", designs);
            call.resolve(result);
        } catch (Exception error) {
            Log.e(TAG, "getDesigns [WIDGET_DESIGN_REGISTRY_FAILED]", error);
            call.reject("WIDGET_DESIGN_REGISTRY_FAILED: Unable to read supported widget designs.", error);
        }
    }

    @PluginMethod
    public void requestAdd(PluginCall call) {
        String requestedComposition = call.getString("composition");
        if (requestedComposition != null && !isSupportedComposition(requestedComposition)) {
            call.reject("INVALID_WIDGET_COMPOSITION: Choose a supported Math Master design.");
            return;
        }
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
            String composition = requestedComposition == null ? "auto" : requestedComposition;
            Context context = getContext();
            Intent callbackIntent = new Intent(context, MathMasterWidgetConfigActivity.class);
            callbackIntent.setAction("com.sudhanshu.mathsbj.action.CONFIGURE_PINNED_WIDGET");
            callbackIntent.setData(Uri.parse(
                "mathmaster-widget-pin://" + composition + "/" + UUID.randomUUID().toString()));
            callbackIntent.putExtra("initialComposition", composition);
            callbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent successCallback = PendingIntent.getActivity(
                context, PIN_REQUEST_CODE, callbackIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            boolean requested = manager.requestPinAppWidget(
                new ComponentName(context, MathMasterHomeWidgetProvider.class), null, successCallback);
            if (!requested) successCallback.cancel();
            JSObject result = new JSObject();
            result.put("requested", requested);
            result.put("supported", true);
            call.resolve(result);
        } catch (RuntimeException error) {
            Log.e(TAG, "requestAdd [WIDGET_PIN_REQUEST_FAILED]", error);
            call.reject("WIDGET_PIN_REQUEST_FAILED: Android could not start the widget pin confirmation.", error);
        }
    }

    @PluginMethod
    public void configureWidget(PluginCall call) {
        int id = call.getInt("appWidgetId", AppWidgetManager.INVALID_APPWIDGET_ID);
        if (!isActiveWidgetId(id)) {
            call.reject("That Math Master widget is no longer on the home screen. Refresh the list and try again.");
            return;
        }
        String requestedComposition = call.getString("composition");
        if (requestedComposition != null && !isSupportedComposition(requestedComposition)) {
            call.reject("INVALID_WIDGET_COMPOSITION: Choose a supported Math Master design.");
            return;
        }
        try {
            Intent intent = new Intent(getContext(), MathMasterWidgetConfigActivity.class);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
            if (requestedComposition != null) intent.putExtra("initialComposition", requestedComposition);
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
    public void updateCustomization(PluginCall call) {
        int id = call.getInt("appWidgetId", AppWidgetManager.INVALID_APPWIDGET_ID);
        if (!isActiveWidgetId(id)) {
            call.reject("That Math Master widget is no longer on the home screen. Refresh the list and try again.");
            return;
        }
        String style = call.getString("style");
        Double requestedScale = call.getDouble("textScale");
        String appearance = call.getString("appearance");
        if (style == null && requestedScale == null && appearance == null) {
            call.reject("Choose a background effect, widget appearance or text size to update.");
            return;
        }
        if (style != null && !("neon".equals(style) || "blur".equals(style) || "transparent".equals(style))) {
            call.reject("INVALID_WIDGET_STYLE: Choose a supported background effect.");
            return;
        }
        if (appearance != null && !("dark".equals(appearance) || "light".equals(appearance))) {
            call.reject("INVALID_WIDGET_APPEARANCE: Choose dark or light mode.");
            return;
        }
        if (requestedScale != null) {
            double rounded = Math.round(requestedScale * 10d) / 10d;
            if (Double.isNaN(requestedScale) || Double.isInfinite(requestedScale)
                || Math.abs(rounded - requestedScale) > 0.001d || rounded < 0.8d || rounded > 1.3d) {
                call.reject("INVALID_WIDGET_TEXT_SCALE: Choose a text size from 0.8 to 1.3 in 0.1 steps.");
                return;
            }
        }

        String prefix = "instance_" + id + "_";
        SharedPreferences preferences = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String styleKey = prefix + "style";
        String scaleKey = prefix + "textScale";
        String appearanceKey = prefix + "appearance";
        boolean hadStyle = preferences.contains(styleKey);
        boolean hadScale = preferences.contains(scaleKey);
        boolean hadAppearance = preferences.contains(appearanceKey);
        String previousStyle = preferences.getString(styleKey, preferences.getString("style", "neon"));
        float previousScale = preferences.getFloat(scaleKey, 1f);
        String previousAppearance = preferences.getString(appearanceKey, "dark");
        SharedPreferences.Editor editor = preferences.edit();
        if (style != null) editor.putString(styleKey, style);
        if (requestedScale != null) editor.putFloat(scaleKey, requestedScale.floatValue());
        if (appearance != null) editor.putString(appearanceKey, appearance);
        if (!editor.commit()) {
            call.reject("Unable to save widget customization. Previous settings were kept.");
            return;
        }
        try {
            AppWidgetManager.getInstance(getContext()).updateAppWidget(
                id, MathMasterHomeWidgetProvider.createViews(getContext(), id));
            JSObject result = new JSObject();
            result.put("style", MathMasterHomeWidgetProvider.normalizeWidgetStyle(
                preferences.getString(styleKey, preferences.getString("style", "neon"))));
            result.put("textScale", MathMasterHomeWidgetProvider.normalizeWidgetTextScale(
                preferences.getFloat(scaleKey, 1f)));
            result.put("appearance", MathMasterHomeWidgetProvider.normalizeWidgetAppearance(
                preferences.getString(appearanceKey, "dark")));
            call.resolve(result);
        } catch (RuntimeException updateError) {
            SharedPreferences.Editor rollback = preferences.edit();
            if (hadStyle) rollback.putString(styleKey, previousStyle);
            else rollback.remove(styleKey);
            if (hadScale) rollback.putFloat(scaleKey, previousScale);
            else rollback.remove(scaleKey);
            if (hadAppearance) rollback.putString(appearanceKey, previousAppearance);
            else rollback.remove(appearanceKey);
            if (!rollback.commit()) {
                call.reject("Widget update failed and its previous settings could not be restored.", updateError);
                return;
            }
            call.reject("Widget update failed. Previous settings were restored.", updateError);
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
        for (String option : new String[] {
            "appIdentity", "target", "progress", "remaining", "studyTime", "streak", "weekly", "quiz", "updateStatus"
        }) defaults.put(option);
        String prefix = "instance_" + id + "_";
        SharedPreferences preferences = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean saved = preferences.edit()
            .putString(prefix + "composition", "auto")
            .putString(prefix + "style", "neon")
            .putString(prefix + "appearance", "dark")
            .putString(prefix + "contentJson", defaults.toString())
            .putInt(prefix + "contentSchemaVersion", 4)
            .remove(prefix + "screenTimePeriod")
            .remove(prefix + "screenTimeSort")
            .remove(prefix + "screenTimeMaxEntries")
            .remove(prefix + "screenTimeShowTotal")
            .remove(prefix + "screenTimeShowUsage")
            .remove(prefix + "screenTimeShowPercent")
            .remove(prefix + "screenTimeDetailed")
            .remove(prefix + "textScale")
            .remove(prefix + "screenTimeHiddenStudyPackages")
            .remove(prefix + "screenTimeHiddenDevicePackages")
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

    private static boolean isSupportedComposition(String value) {
        for (String[] option : MathMasterHomeWidgetProvider.getWidgetCompositionOptions()) {
            if (option[0].equals(value)) return true;
        }
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
            // Preserve the pre-Screen-Time default; both Screen Time sources are opt-in.
            for (String option : new String[] {
                "appIdentity", "target", "progress", "remaining", "studyTime",
                "streak", "weekly", "quiz", "updateStatus"
            }) result.put(option);
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
