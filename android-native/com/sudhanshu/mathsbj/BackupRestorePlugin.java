package com.sudhanshu.mathsbj;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Log;

import com.getcapacitor.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "MathMasterBackup")
public class BackupRestorePlugin extends Plugin {
    private static final String TAG = "MathMasterBackup";
    private static final int MAX_BACKUP_BYTES = 64 * 1024 * 1024;
    private static final String WIDGET_PREFS = "math_master_home_widget";
    private static final Set<String> GLOBAL_STRING_KEYS = new TreeSet<>(Arrays.asList(
        "contentJson", "style", "composition", "theme", "mode", "appAccentColor", "accentColor"
    ));
    private static final Set<String> GLOBAL_BOOLEAN_KEYS = new TreeSet<>(Collections.singletonList("enabled"));
    private static final Set<String> INSTANCE_STRING_FIELDS = new TreeSet<>(Arrays.asList(
        "contentJson", "style", "composition", "themeMode", "theme"
    ));
    private static final Pattern INSTANCE_KEY = Pattern.compile(
        "^instance_([0-9]+)_(contentJson|style|composition|themeMode|theme|contentSchemaVersion)$"
    );
    private static final Set<String> CONTENT_OPTIONS = new TreeSet<>(Arrays.asList(
        "appIdentity", "target", "progress", "remaining", "studyTime", "streak", "weekly", "updateStatus"
    ));
    private static final Set<String> COMPOSITIONS = new TreeSet<>(Arrays.asList(
        "auto", "hero_wide", "compact_green", "square_math_bot", "medium_study",
        "square_cosmic", "extra_wide_weekly", "minimal_progress"
    ));
    private static final Set<String> THEMES = new TreeSet<>(Arrays.asList(
        "app", "emerald", "ocean", "graphite", "rose", "violet", "sapphire", "aurora"
    ));
    private static final Set<String> THEME_MODES = new TreeSet<>(Arrays.asList(
        "app", "random", "emerald", "ocean", "graphite", "rose", "violet", "sapphire", "aurora"
    ));
    private static final Set<String> STYLES = new TreeSet<>(Arrays.asList("glass", "compact", "minimal"));

    @PluginMethod
    public void saveBackup(PluginCall call) {
        String filename = call.getString("filename");
        String content = call.getString("content");
        if (filename == null || !filename.matches("[A-Za-z0-9_.-]{1,120}") ||
            !filename.endsWith(".mathbackup") || content == null) {
            call.reject("Invalid backup filename or contents.");
            return;
        }
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (bytes.length == 0 || bytes.length > MAX_BACKUP_BYTES) {
            call.reject("Backup file must be between 1 byte and 64 MB.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/octet-stream");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
            "application/octet-stream", "application/json", "application/vnd.mathmaster.backup"
        });
        startActivityForResult(call, intent, "createBackupResult");
    }

    @ActivityCallback
    private void createBackupResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null ||
            result.getData().getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("saved", false);
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }
        String content = call.getString("content");
        if (content == null) {
            call.reject("Backup contents are no longer available. Please create the backup again.");
            return;
        }
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (bytes.length == 0 || bytes.length > MAX_BACKUP_BYTES) {
            call.reject("Backup file must be between 1 byte and 64 MB.");
            return;
        }
        Uri uri = result.getData().getData();
        try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (output == null) throw new IllegalStateException("The selected destination could not be opened.");
            for (int offset = 0; offset < bytes.length; offset += 64 * 1024) {
                output.write(bytes, offset, Math.min(64 * 1024, bytes.length - offset));
            }
            output.flush();
        } catch (Exception error) {
            try { getContext().getContentResolver().delete(uri, null, null); } catch (Exception ignored) { }
            Log.w(TAG, "Unable to finish writing the selected backup document.", error);
            call.reject("Unable to save the backup. Check the selected destination and available storage.", error);
            return;
        }

        try {
            byte[] expected = MessageDigest.getInstance("SHA-256").digest(bytes);
            byte[] actual = digestDocument(uri);
            if (!MessageDigest.isEqual(expected, actual)) {
                getContext().getContentResolver().delete(uri, null, null);
                throw new IllegalStateException("Written backup did not pass read-back verification.");
            }
        } catch (Exception error) {
            try { getContext().getContentResolver().delete(uri, null, null); } catch (Exception ignored) { }
            Log.w(TAG, "Backup write verification failed.", error);
            call.reject("The backup was written but could not be verified. It was not reported as successful.", error);
            return;
        }

        JSObject saved = new JSObject();
        saved.put("saved", true);
        saved.put("cancelled", false);
        saved.put("bytesWritten", bytes.length);
        call.resolve(saved);
    }

    private byte[] digestDocument(Uri uri) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long length = 0L;
        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) throw new IllegalStateException("The saved document could not be read back.");
            byte[] buffer = new byte[32 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) {
                length += count;
                if (length > MAX_BACKUP_BYTES) throw new IllegalStateException("Written document exceeds backup limits.");
                digest.update(buffer, 0, count);
            }
        }
        return digest.digest();
    }

    @PluginMethod
    public void pickBackup(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
            "application/octet-stream", "application/json", "application/vnd.mathmaster.backup"
        });
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "pickBackupResult");
    }

    @ActivityCallback
    private void pickBackupResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null ||
            result.getData().getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }
        Uri uri = result.getData().getData();
        try (InputStream input = getContext().getContentResolver().openInputStream(uri);
             ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalStateException("The selected document could not be opened.");
            byte[] buffer = new byte[32 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (bytes.size() + count > MAX_BACKUP_BYTES) {
                    throw new IllegalArgumentException("Backup file exceeds the 64 MB limit.");
                }
                bytes.write(buffer, 0, count);
            }
            JSObject selected = new JSObject();
            selected.put("cancelled", false);
            selected.put("fileName", queryDisplayName(uri));
            selected.put("content", new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            call.resolve(selected);
        } catch (Exception error) {
            Log.w(TAG, "Unable to read the selected backup document.", error);
            call.reject(error instanceof IllegalArgumentException ? error.getMessage() : "Unable to read the selected backup file.", error);
        }
    }

    private String queryDisplayName(Uri uri) {
        try (android.database.Cursor cursor = getContext().getContentResolver()
            .query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (column >= 0) {
                    String name = cursor.getString(column);
                    if (name != null && !name.isEmpty()) return name;
                }
            }
        } catch (Exception ignored) { }
        return "selected-backup.mathbackup";
    }

    @PluginMethod
    public void getWidgetPreferences(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("snapshot", createWidgetPreferenceSnapshot().toString());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to export saved widget preferences.", error);
        }
    }

    @PluginMethod
    public void restoreWidgetPreferences(PluginCall call) {
        String snapshotText = call.getString("snapshot");
        if (snapshotText == null || snapshotText.length() > 1024 * 1024) {
            call.reject("Widget preference snapshot is invalid or too large.");
            return;
        }
        try {
            JSONObject snapshot = new JSONObject(snapshotText);
            if (snapshot.optInt("version", -1) != 1 ||
                !(snapshot.opt("global") instanceof JSONObject) ||
                !(snapshot.opt("instances") instanceof JSONArray)) {
                throw new JSONException("Unsupported widget preference schema.");
            }
            JSONObject global = snapshot.getJSONObject("global");
            JSONArray instances = snapshot.getJSONArray("instances");
            if (global.length() > 32 || instances.length() > 100) {
                throw new JSONException("Widget preference snapshot exceeds its limits.");
            }
            Map<String, Object> safeGlobal = new TreeMap<>();
            for (String key : keys(global)) {
                Object value = global.get(key);
                if (!isValidGlobalPreference(key, value)) throw new JSONException("Invalid widget preference: " + key);
                safeGlobal.put(key, value);
            }

            List<JSONObject> safeInstances = new ArrayList<>();
            Set<Integer> seenIds = new TreeSet<>();
            for (int i = 0; i < instances.length(); i++) {
                JSONObject item = instances.getJSONObject(i);
                int oldId = item.getInt("widgetId");
                if (oldId < 0 || !seenIds.add(oldId) || !(item.opt("preferences") instanceof JSONObject)) {
                    throw new JSONException("Invalid or duplicate widget instance.");
                }
                JSONObject source = item.getJSONObject("preferences");
                if (source.length() > 16) throw new JSONException("Too many fields on a widget instance.");
                JSONObject fields = new JSONObject();
                for (String field : keys(source)) {
                    Object value = source.get(field);
                    if (!isValidInstancePreference(field, value)) throw new JSONException("Invalid widget instance preference: " + field);
                    fields.put(field, value);
                }
                JSONObject normalized = new JSONObject();
                normalized.put("widgetId", oldId);
                normalized.put("preferences", fields);
                safeInstances.add(normalized);
            }

            SharedPreferences preferences = getContext().getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
            int[] activeIds = getCurrentWidgetIds();
            Arrays.sort(activeIds);
            SharedPreferences.Editor editor = preferences.edit();
            for (String key : GLOBAL_STRING_KEYS) editor.remove(key);
            for (String key : GLOBAL_BOOLEAN_KEYS) editor.remove(key);
            for (String key : preferences.getAll().keySet()) {
                if (INSTANCE_KEY.matcher(key).matches()) editor.remove(key);
            }
            for (Map.Entry<String, Object> entry : safeGlobal.entrySet()) {
                putPreference(editor, entry.getKey(), entry.getValue());
            }
            int mapped = Math.min(activeIds.length, safeInstances.size());
            for (int i = 0; i < mapped; i++) {
                JSONObject fields = safeInstances.get(i).getJSONObject("preferences");
                int activeId = activeIds[i];
                for (String field : keys(fields)) putPreference(editor, "instance_" + activeId + "_" + field, fields.get(field));
            }
            if (!editor.commit()) throw new IllegalStateException("Android could not commit widget preferences.");
            MathMasterHomeWidgetProvider.updateWidgetPreferences(getContext());

            JSObject result = new JSObject();
            result.put("restored", true);
            result.put("mappedInstances", mapped);
            result.put("skippedInstances", safeInstances.size() - mapped);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Widget preferences were not changed because the backup data was invalid.", error);
        }
    }

    private JSONObject createWidgetPreferenceSnapshot() throws JSONException {
        SharedPreferences preferences = getContext().getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        Map<String, ?> all = preferences.getAll();
        JSONObject global = new JSONObject();
        for (String key : GLOBAL_STRING_KEYS) if (all.containsKey(key)) global.put(key, all.get(key));
        for (String key : GLOBAL_BOOLEAN_KEYS) if (all.containsKey(key)) global.put(key, all.get(key));

        TreeMap<Integer, JSONObject> instances = new TreeMap<>();
        for (Map.Entry<String, ?> entry : all.entrySet()) {
            Matcher matcher = INSTANCE_KEY.matcher(entry.getKey());
            if (!matcher.matches()) continue;
            int widgetId;
            try { widgetId = Integer.parseInt(matcher.group(1)); } catch (NumberFormatException ignored) { continue; }
            String field = matcher.group(2);
            Object value = entry.getValue();
            if (!isValidInstancePreference(field, value)) continue;
            JSONObject instance = instances.get(widgetId);
            if (instance == null) {
                instance = new JSONObject();
                instances.put(widgetId, instance);
            }
            instance.put(field, value);
        }
        JSONArray serialized = new JSONArray();
        for (Map.Entry<Integer, JSONObject> entry : instances.entrySet()) {
            JSONObject item = new JSONObject();
            item.put("widgetId", entry.getKey());
            item.put("preferences", entry.getValue());
            serialized.put(item);
        }
        JSONObject result = new JSONObject();
        result.put("version", 1);
        result.put("global", global);
        result.put("instances", serialized);
        return result;
    }

    private int[] getCurrentWidgetIds() {
        AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
        ComponentName provider = new ComponentName(getContext(), "com.sudhanshu.mathsbj.MathMasterHomeWidgetProvider");
        int[] ids = manager.getAppWidgetIds(provider);
        return ids == null ? new int[0] : ids;
    }

    private static boolean isValidGlobalPreference(String key, Object value) {
        if (GLOBAL_BOOLEAN_KEYS.contains(key)) return value instanceof Boolean;
        return GLOBAL_STRING_KEYS.contains(key) && value instanceof String && validateWidgetString(key, (String) value);
    }

    private static boolean isValidInstancePreference(String field, Object value) {
        if ("contentSchemaVersion".equals(field)) {
            return value instanceof Number && ((Number) value).intValue() >= 1 && ((Number) value).intValue() <= 2;
        }
        return INSTANCE_STRING_FIELDS.contains(field) && value instanceof String && validateWidgetString(field, (String) value);
    }

    private static boolean validateWidgetString(String field, String value) {
        if (value == null || value.length() > 8192) return false;
        if ("contentJson".equals(field)) {
            try {
                JSONArray content = new JSONArray(value);
                if (content.length() > CONTENT_OPTIONS.size()) return false;
                Set<String> seen = new TreeSet<>();
                for (int i = 0; i < content.length(); i++) {
                    String option = content.getString(i);
                    if (!CONTENT_OPTIONS.contains(option) || !seen.add(option)) return false;
                }
                return true;
            } catch (JSONException ignored) { return false; }
        }
        if ("style".equals(field)) return STYLES.contains(value);
        if ("composition".equals(field)) return COMPOSITIONS.contains(value);
        if ("theme".equals(field)) return THEMES.contains(value);
        if ("themeMode".equals(field)) return THEME_MODES.contains(value);
        if ("mode".equals(field)) return "dark".equals(value) || "light".equals(value);
        if ("appAccentColor".equals(field) || "accentColor".equals(field)) return value.matches("^#[0-9a-fA-F]{6}$");
        return false;
    }

    private static void putPreference(SharedPreferences.Editor editor, String key, Object value) {
        if (value instanceof String) editor.putString(key, (String) value);
        else if (value instanceof Boolean) editor.putBoolean(key, (Boolean) value);
        else if (value instanceof Integer) editor.putInt(key, (Integer) value);
        else if (value instanceof Long) editor.putLong(key, (Long) value);
        else throw new IllegalArgumentException("Unsupported widget preference value.");
    }

    private static List<String> keys(JSONObject object) {
        List<String> keys = new ArrayList<>();
        java.util.Iterator<String> iterator = object.keys();
        while (iterator.hasNext()) keys.add(iterator.next());
        Collections.sort(keys);
        return keys;
    }
}
