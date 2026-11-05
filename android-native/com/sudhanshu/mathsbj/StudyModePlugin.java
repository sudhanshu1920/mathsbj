package com.sudhanshu.mathsbj;

import android.app.TimePickerDialog;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "StudyMode")
public final class StudyModePlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        StudyModeManager.reconcile(getContext());
        call.resolve(StudyModeManager.getStatus(getContext()));
    }

    @PluginMethod
    public void refresh(PluginCall call) {
        StudyModeManager.reconcile(getContext());
        call.resolve(StudyModeManager.getStatus(getContext()));
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        try {
            Boolean enabled = call.getBoolean("enabled");
            if (enabled == null) {
                call.reject("Study Mode enabled state is required.");
                return;
            }
            StudyModeManager.setEnabled(getContext(), enabled);
            call.resolve(StudyModeManager.getStatus(getContext()));
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage(), error);
        } catch (Exception error) {
            call.reject("Android could not update Study Mode.", error);
        }
    }

    @PluginMethod
    public void saveConfig(PluginCall call) {
        try {
            JSONArray rawPackages = call.getData().optJSONArray("selectedPackageNames");
            JSONArray rawDays = call.getData().optJSONArray("selectedDays");
            List<String> packages = new ArrayList<>();
            Set<Integer> days = new HashSet<>();
            if (rawPackages != null) {
                for (int i = 0; i < rawPackages.length(); i++) {
                    String name = rawPackages.optString(i, "");
                    if (!name.isEmpty()) packages.add(name);
                }
            }
            if (rawDays != null) {
                for (int i = 0; i < rawDays.length(); i++) {
                    int day = rawDays.optInt(i, -1);
                    if (day >= 1 && day <= 7) days.add(day);
                }
            }

            Integer startHour = call.getInt("startHour");
            Integer startMinute = call.getInt("startMinute");
            Integer endHour = call.getInt("endHour");
            Integer endMinute = call.getInt("endMinute");
            if (startHour == null || startMinute == null || endHour == null || endMinute == null) {
                call.reject("Choose valid start and end times.");
                return;
            }
            StudyModeManager.saveConfig(
                getContext(), packages, startHour, startMinute, endHour, endMinute, days
            );
            call.resolve(StudyModeManager.getStatus(getContext()));
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage(), error);
        } catch (Exception error) {
            call.reject("Android could not save Study Mode settings.", error);
        }
    }

    @PluginMethod
    public void listApps(PluginCall call) {
        try {
            android.content.pm.PackageManager pm = getContext().getPackageManager();
            Intent launcher = new Intent(Intent.ACTION_MAIN);
            launcher.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> activities = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? pm.queryIntentActivities(launcher, android.content.pm.PackageManager.ResolveInfoFlags.of(0L))
                : pm.queryIntentActivities(launcher, 0);
            Set<String> protectedPackages = StudyModeManager.getProtectedPackages(getContext());
            JSArray apps = new JSArray();
            Set<String> seen = new HashSet<>();
            List<AppEntry> entries = new ArrayList<>();
            for (ResolveInfo activity : activities) {
                if (activity.activityInfo == null) continue;
                String packageName = activity.activityInfo.packageName;
                if (!seen.add(packageName)
                    || !StudyModeManager.isVisibleApplication(getContext(), packageName)) continue;
                try {
                    ApplicationInfo info = activity.activityInfo.applicationInfo;
                    if (info == null) info = loadApplicationInfo(pm, packageName);
                    if (info == null) continue;

                    String label = packageName;
                    try {
                        CharSequence appLabel = pm.getApplicationLabel(info);
                        if (appLabel != null && appLabel.length() > 0) label = appLabel.toString();
                    } catch (Exception ignored) {
                        // A missing OEM label falls back to the stable package name.
                    }

                    String iconDataUrl = "";
                    try {
                        Drawable icon = pm.getApplicationIcon(info);
                        if (icon != null) iconDataUrl = drawableToDataUrl(icon);
                    } catch (Exception ignored) {
                        // Missing OEM icon resources do not hide an otherwise launchable app.
                    }

                    boolean selectable = StudyModeManager.isSelectableApplication(
                        getContext(), packageName, protectedPackages);
                    entries.add(new AppEntry(
                        packageName,
                        label,
                        iconDataUrl,
                        StudyModeManager.isSystemApplication(info),
                        selectable
                    ));
                } catch (Exception ignored) {
                    // A package disappearing during discovery must not hide other apps.
                }
            }
            entries.sort(Comparator.comparing(entry -> entry.label.toLowerCase(java.util.Locale.ROOT)));
            for (AppEntry entry : entries) {
                JSObject item = new JSObject();
                item.put("packageName", entry.packageName);
                item.put("label", entry.label);
                item.put("iconDataUrl", entry.iconDataUrl);
                item.put("systemApp", entry.systemApp);
                item.put("selectable", entry.selectable);
                apps.put(item);
            }
            JSObject result = new JSObject();
            result.put("apps", apps);
            result.put("discoveryScope", "launcher-visible");
            result.put("appCount", entries.size());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to read installed launcher apps visible to Math Master.", error);
        }
    }

    private ApplicationInfo loadApplicationInfo(
        android.content.pm.PackageManager pm, String packageName
    ) throws android.content.pm.PackageManager.NameNotFoundException {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            ? pm.getApplicationInfo(packageName, android.content.pm.PackageManager.ApplicationInfoFlags.of(0L))
            : pm.getApplicationInfo(packageName, 0);
    }

    private String drawableToDataUrl(Drawable drawable) {
        int size = Math.max(48, Math.min(96, Math.round(64 * getContext().getResources().getDisplayMetrics().density)));
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, size, size);
        drawable.draw(canvas);
        ByteArrayOutputStream stream = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 90, stream);
        bitmap.recycle();
        return "data:image/png;base64," + android.util.Base64.encodeToString(stream.toByteArray(), android.util.Base64.NO_WRAP);
    }

    @PluginMethod
    public void openPermissionSettings(PluginCall call) {
        String permission = call.getString("permission", "");
        Intent intent;
        switch (permission) {
            case "usage":
                intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                break;
            case "overlay":
                intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    android.net.Uri.parse("package:" + getContext().getPackageName()));
                break;
            case "exactAlarm":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        android.net.Uri.parse("package:" + getContext().getPackageName()));
                } else {
                    call.resolve();
                    return;
                }
                break;
            default:
                call.reject("Unknown Study Mode permission.");
                return;
        }
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    android.net.Uri.parse("package:" + getContext().getPackageName()));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                call.resolve();
            } catch (Exception fallbackError) {
                call.reject("Unable to open the Android permission settings.", fallbackError);
            }
        }
    }

    @PluginMethod
    public void showTimePicker(PluginCall call) {
        Integer hour = call.getInt("hour");
        Integer minute = call.getInt("minute");
        String title = call.getString("title", "Study time");
        if (hour == null || minute == null || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            call.reject("Invalid time supplied to Android time picker.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            TimePickerDialog dialog = new TimePickerDialog(
                getActivity(),
                (view, selectedHour, selectedMinute) -> {
                    JSObject result = new JSObject();
                    result.put("confirmed", true);
                    result.put("hour", selectedHour);
                    result.put("minute", selectedMinute);
                    call.resolve(result);
                },
                hour,
                minute,
                android.text.format.DateFormat.is24HourFormat(getContext())
            );
            dialog.setTitle(title);
            dialog.setOnCancelListener(ignored -> {
                JSObject result = new JSObject();
                result.put("confirmed", false);
                call.resolve(result);
            });
            dialog.show();
        });
    }

    private static final class AppEntry {
        final String packageName;
        final String label;
        final String iconDataUrl;
        final boolean systemApp;
        final boolean selectable;
        AppEntry(String packageName, String label, String iconDataUrl, boolean systemApp, boolean selectable) {
            this.packageName = packageName;
            this.label = label;
            this.iconDataUrl = iconDataUrl;
            this.systemApp = systemApp;
            this.selectable = selectable;
        }
    }
}
