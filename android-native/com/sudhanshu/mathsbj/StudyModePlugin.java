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
        call.resolve(StudyModeManager.getStatus(getContext()));
    }

    @PluginMethod
    public void acceptAccessibilityDisclosure(PluginCall call) {
        try {
            StudyModeManager.acceptAccessibilityDisclosure(getContext());
            call.resolve(StudyModeManager.getStatus(getContext()));
        } catch (Exception error) {
            call.reject("Accessibility disclosure consent could not be saved.", error);
        }
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
    public void startSession(PluginCall call) {
        try {
            String type = call.getString("sessionType", "study");
            Integer duration = call.getInt("durationSeconds", 1500);
            Boolean enforced = call.getBoolean("enforced", false);
            Boolean dnd = call.getBoolean("shouldEnableDnd", false);
            if (duration == null || duration < 0 || duration > 24 * 60 * 60) {
                call.reject("Choose a focus duration between 0 and 24 hours.");
                return;
            }
            if (Boolean.TRUE.equals(dnd) && !StudyModeManager.isDndControlSupported(getContext())) {
                call.reject("Android 15+ restricts this app from changing global Do Not Disturb. Use Android Quick Settings instead.");
                return;
            }
            if (Boolean.TRUE.equals(dnd) && !StudyModeManager.hasNotificationPolicyAccess(getContext())) {
                call.reject("Allow Do Not Disturb access before starting a session with DND enabled.");
                return;
            }
            call.resolve(StudyModeManager.startSession(
                getContext(), type, duration, Boolean.TRUE.equals(enforced), Boolean.TRUE.equals(dnd)
            ));
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage(), error);
        } catch (Exception error) {
            call.reject("Android could not start the saved focus session.", error);
        }
    }

    @PluginMethod
    public void endSession(PluginCall call) {
        try {
            String sessionId = call.getString("sessionId", "");
            call.resolve(StudyModeManager.endSession(getContext(), sessionId));
        } catch (Exception error) {
            call.reject("Android could not end the focus session.", error);
        }
    }

    @PluginMethod
    public void getSessionHistory(PluginCall call) {
        JSObject result = new JSObject();
        result.put("sessions", StudyModeManager.getSessionHistory(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void saveStudyApps(PluginCall call) {
        try {
            JSONArray rawPackages = call.getData().optJSONArray("packageNames");
            if (rawPackages == null) {
                call.reject("Study Apps selection is required.");
                return;
            }
            List<String> packages = new ArrayList<>();
            for (int i = 0; i < rawPackages.length(); i++) {
                String name = rawPackages.optString(i, "");
                if (!name.isEmpty()) packages.add(name);
            }
            call.resolve(StudyModeManager.setStudyAppPackages(getContext(), packages));
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage(), error);
        } catch (Exception error) {
            call.reject("Android could not save Study Apps.", error);
        }
    }

    @PluginMethod
    public void setOverlayAppearance(PluginCall call) {
        try {
            String mode = call.getString("mode", "dark");
            String theme = call.getString("theme", "arctic-blue");
            StudyModeManager.saveOverlayAppearance(getContext(), mode, theme);
            call.resolve();
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage(), error);
        } catch (Exception error) {
            call.reject("Android could not update the Study Mode popup appearance.", error);
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
    public void openPermissionSettings(PluginCall call) {
        String permission = call.getString("permission", "");
        Intent intent;
        switch (permission) {
            case "usage":
                intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                break;
            case "accessibility":
                intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
                break;
            case "notifications":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
                } else {
                    intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        android.net.Uri.parse("package:" + getContext().getPackageName()));
                }
                break;
            case "battery":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                } else {
                    intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        android.net.Uri.parse("package:" + getContext().getPackageName()));
                }
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
            case "dnd":
                if (!StudyModeManager.isDndControlSupported(getContext())) {
                    call.reject("Android 15+ restricts this app from changing global Do Not Disturb. Use Android Quick Settings instead.");
                    return;
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
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
