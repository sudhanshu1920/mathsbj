package com.sudhanshu.mathsbj;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
import java.security.SecureRandom;

public class MathMasterWidgetConfigActivity extends Activity {
    private static final String PREFS = "math_master_home_widget";
    private static final int INVALID_WIDGET_ID = AppWidgetManager.INVALID_APPWIDGET_ID;

    private final Map<String, CheckBox> contentChecks = new LinkedHashMap<>();
    private RadioGroup styleGroup;
    private RadioGroup themeGroup;
    private TextView previewSummary;
    private int widgetId = INVALID_WIDGET_ID;

    private static final String[][] CONTENT_OPTIONS = {
        {"appIdentity", "App Identity"},
        {"target", "Today's Target"},
        {"progress", "Progress"},
        {"remaining", "Remaining Target"},
        {"studyTime", "Study Time"},
        {"streak", "Streak"},
        {"weekly", "Weekly Target Tracker"},
        {"updateStatus", "Update Status"}
    };

    private static final String[][] PREMIUM_THEMES = {
        {"emerald", "Emerald Glass", "#50D9A0"},
        {"ocean", "Ocean Blue Glass", "#58D6F2"},
        {"graphite", "Graphite Glass", "#A9B7C9"},
        {"rose", "Rose Quartz", "#FF83B5"},
        {"violet", "Midnight Violet", "#B8A0FF"},
        {"sapphire", "Sapphire Glass", "#698CFF"},
        {"aurora", "Aurora Glass", "#A8E063"}
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setResult(RESULT_CANCELED);
        widgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, INVALID_WIDGET_ID);
        if (widgetId == INVALID_WIDGET_ID) {
            finish();
            return;
        }

        SharedPreferences preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(20), dp(18), dp(20), dp(16));
        content.setBackgroundColor(Color.parseColor("#F4F6FB"));

        TextView title = new TextView(this);
        title.setText("Customize Your Widget");
        title.setTextColor(Color.parseColor("#192235"));
        title.setTextSize(21);
        title.setTypeface(null, 1);
        content.addView(title, matchWrap());

        addSectionLabel(content, "Widget Content");
        String existingJson = preferences.getString(
            "instance_" + widgetId + "_contentJson",
            preferences.getString("contentJson", "[\"appIdentity\",\"target\",\"progress\",\"remaining\",\"studyTime\",\"streak\",\"weekly\",\"updateStatus\"]")
        );
        List<String> selected = parseContent(existingJson);
        for (String[] option : CONTENT_OPTIONS) {
            CheckBox checkBox = new CheckBox(this);
            checkBox.setText(option[1]);
            checkBox.setTextColor(Color.parseColor("#243149"));
            checkBox.setTextSize(14);
            checkBox.setButtonTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#6558D9")));
            checkBox.setChecked(selected.contains(option[0]));
            contentChecks.put(option[0], checkBox);
            checkBox.setOnCheckedChangeListener((button, checked) -> updatePreview());
            content.addView(checkBox, matchWrap());
        }

        addSectionLabel(content, "Widget Style");
        styleGroup = new RadioGroup(this);
        styleGroup.setOrientation(RadioGroup.HORIZONTAL);
        addRadio(styleGroup, "glass", "Glass", preferences.getString("instance_" + widgetId + "_style", preferences.getString("style", "glass")));
        addRadio(styleGroup, "compact", "Compact", preferences.getString("instance_" + widgetId + "_style", preferences.getString("style", "glass")));
        addRadio(styleGroup, "minimal", "Minimal", preferences.getString("instance_" + widgetId + "_style", preferences.getString("style", "glass")));
        styleGroup.setOnCheckedChangeListener((group, checkedId) -> updatePreview());
        content.addView(styleGroup, matchWrap());

        addSectionLabel(content, "Widget Theme");
        themeGroup = new RadioGroup(this);
        themeGroup.setOrientation(RadioGroup.VERTICAL);
        String currentTheme = preferences.getString("instance_" + widgetId + "_theme", preferences.getString("theme", "app"));
        String currentThemeMode = preferences.getString("instance_" + widgetId + "_themeMode", currentTheme);
        addRadio(themeGroup, "app", "Match App Theme", currentThemeMode);
        addRadio(themeGroup, "random", "Random Premium Theme", currentThemeMode);
        for (String[] themeOption : PREMIUM_THEMES) {
            addRadio(themeGroup, themeOption[0], themeOption[1], currentThemeMode);
        }
        themeGroup.setOnCheckedChangeListener((group, checkedId) -> updatePreview());
        content.addView(themeGroup, matchWrap());

        addSectionLabel(content, "Preview");
        previewSummary = new TextView(this);
        previewSummary.setTextColor(Color.parseColor("#F5F3FF"));
        previewSummary.setTextSize(12);
        previewSummary.setPadding(dp(14), dp(12), dp(14), dp(12));
        previewSummary.setBackgroundColor(Color.parseColor("#211F35"));
        content.addView(previewSummary, matchWrap());
        updatePreview();

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.END);
        actions.setPadding(0, dp(16), 0, 0);
        Button cancel = new Button(this);
        cancel.setText("Cancel");
        cancel.setOnClickListener(view -> finish());
        Button save = new Button(this);
        save.setText("Save");
        save.setOnClickListener(view -> saveConfiguration());
        actions.addView(cancel);
        actions.addView(save);
        content.addView(actions, matchWrap());

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(content);
        setContentView(scroll);
    }

    private void addRadio(RadioGroup group, String value, String label, String selectedValue) {
        RadioButton radio = new RadioButton(this);
        radio.setId(View.generateViewId());
        radio.setTag(value);
        radio.setText(label);
        radio.setTextSize(12);
        radio.setTextColor(Color.parseColor("#243149"));
        radio.setButtonTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#6558D9")));
        RadioGroup.LayoutParams params = group.getOrientation() == RadioGroup.HORIZONTAL
            ? new RadioGroup.LayoutParams(0, dp(48), 1f)
            : new RadioGroup.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        group.addView(radio, params);
        if (value.equals(selectedValue)) group.check(radio.getId());
    }

    private void addSectionLabel(LinearLayout parent, String label) {
        TextView view = new TextView(this);
        view.setText(label);
        view.setTextColor(Color.parseColor("#526078"));
        view.setTextSize(12);
        view.setTypeface(null, 1);
        view.setPadding(0, dp(14), 0, dp(4));
        parent.addView(view, matchWrap());
    }

    private void updatePreview() {
        if (previewSummary == null) return;
        List<String> selected = new ArrayList<>();
        for (String[] option : CONTENT_OPTIONS) {
            CheckBox checkBox = contentChecks.get(option[0]);
            if (checkBox != null && checkBox.isChecked()) selected.add(option[0]);
        }
        String style = selectedRadioValue(styleGroup, "glass");
        String theme = selectedRadioValue(themeGroup, "app");
        if (selected.isEmpty()) {
            previewSummary.setText("Select at least one field");
            return;
        }

        SharedPreferences preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int targetMinutes = Math.max(1, preferences.getInt("targetMinutes", 5));
        long elapsedSeconds = Math.max(0L, preferences.getLong("elapsedSeconds", 0L));
        String savedDay = preferences.getString("dayKey", "");
        String today = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Calendar.getInstance().getTime());
        if (!today.equals(savedDay)) elapsedSeconds = 0L;
        long targetSeconds = targetMinutes * 60L;
        int elapsedMinutes = (int) Math.min(Integer.MAX_VALUE, elapsedSeconds / 60L);
        long progressSeconds = Math.min(elapsedSeconds, targetSeconds);
        int percent = (int) Math.max(0L, Math.min(100L, progressSeconds * 100L / targetSeconds));
        int remainingMinutes = (int) Math.max(0L, (targetSeconds - elapsedSeconds + 59L) / 60L);
        int streak = Math.max(0, preferences.getInt("currentStreak", 0));

        List<String> rows = new ArrayList<>();
        if (selected.contains("appIdentity")) rows.add("Math Master");
        if (selected.contains("target")) rows.add("Target: " + targetMinutes + " min");
        if (selected.contains("progress")) rows.add("Progress: " + percent + "%");
        if (selected.contains("remaining")) rows.add(remainingMinutes + " min remaining");
        if (selected.contains("studyTime")) rows.add("Study time: " + elapsedMinutes + " min");
        if (selected.contains("streak")) rows.add("Streak: " + streak + " days");
        if (selected.contains("weekly")) {
            Set<String> completedDays = new HashSet<>();
            try {
                JSONArray savedDays = new JSONArray(preferences.getString("completedDaysJson", "[]"));
                for (int i = 0; i < Math.min(savedDays.length(), 7); i++) {
                    String day = savedDays.optString(i, "");
                    if (day.matches("\\d{4}-\\d{2}-\\d{2}")) completedDays.add(day);
                }
            } catch (JSONException ignored) {
                // Empty history is shown as incomplete, never fabricated as completed.
            }
            java.util.Calendar date = java.util.Calendar.getInstance();
            date.set(java.util.Calendar.HOUR_OF_DAY, 12);
            date.set(java.util.Calendar.MINUTE, 0);
            date.set(java.util.Calendar.SECOND, 0);
            date.set(java.util.Calendar.MILLISECOND, 0);
            date.add(java.util.Calendar.DAY_OF_MONTH, -6);
            java.text.SimpleDateFormat dateKeyFormat = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
            java.text.SimpleDateFormat dayLabelFormat = new java.text.SimpleDateFormat("EEEEE", java.util.Locale.getDefault());
            rows.add("THIS WEEK · LAST 7 DAYS");
            for (int i = 0; i < 7; i++) {
                String dateKey = dateKeyFormat.format(date.getTime());
                rows.add(dayLabelFormat.format(date.getTime()) + " " + date.get(java.util.Calendar.DAY_OF_MONTH)
                    + " " + (completedDays.contains(dateKey) ? "✓" : "·"));
                date.add(java.util.Calendar.DAY_OF_MONTH, 1);
            }
        }
        if (selected.contains("updateStatus")) {
            boolean updateAvailable = preferences.getBoolean("updateAvailable", false);
            rows.add(updateAvailable ? "Update available" : "Update status");
        }

        String appMode = preferences.getString("mode", "dark");
        boolean light = "light".equals(appMode);
        String resolvedTheme = "random".equals(theme)
            ? preferences.getString("instance_" + widgetId + "_theme", "violet") : theme;
        boolean appTheme = "app".equals(resolvedTheme);
        int previewBackground = appTheme
            ? (light ? Color.parseColor("#F4F7FC") : Color.parseColor("#211F35"))
            : Color.parseColor(themeBackgroundColor(resolvedTheme));
        previewSummary.setTextColor(light && appTheme ? Color.parseColor("#263247") : Color.parseColor("#F5F3FF"));
        previewSummary.setBackgroundColor(previewBackground);
        String themeLabel = "random".equals(theme)
            ? "Random Premium Theme" + (isPaletteTheme(resolvedTheme) ? " · " + themeLabel(resolvedTheme) : "")
            : themeLabel(resolvedTheme);
        previewSummary.setText(android.text.TextUtils.join("\\n", rows)
            + "\\n" + capitalize(style) + "  ·  " + themeLabel);
    }

    private void saveConfiguration() {
        JSONArray selected = new JSONArray();
        for (String[] option : CONTENT_OPTIONS) {
            CheckBox checkBox = contentChecks.get(option[0]);
            if (checkBox != null && checkBox.isChecked()) selected.put(option[0]);
        }
        if (selected.length() == 0) {
            Toast.makeText(this, "Select at least one widget field.", Toast.LENGTH_SHORT).show();
            return;
        }

        String style = selectedRadioValue(styleGroup, "glass");
        String themeMode = selectedRadioValue(themeGroup, "app");
        SharedPreferences preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String previousThemeMode = preferences.getString("instance_" + widgetId + "_themeMode", "");
        String previousTheme = preferences.getString("instance_" + widgetId + "_theme", "");
        String theme;
        if ("random".equals(themeMode)) {
            theme = "random".equals(previousThemeMode) && isPaletteTheme(previousTheme)
                ? previousTheme : chooseRandomTheme(preferences, widgetId);
        } else {
            theme = isValidTheme(themeMode) ? themeMode : "app";
        }
        preferences.edit()
            .putString("instance_" + widgetId + "_contentJson", selected.toString())
            .putString("instance_" + widgetId + "_style", style)
            .putString("instance_" + widgetId + "_themeMode", themeMode)
            .putString("instance_" + widgetId + "_theme", theme)
            .apply();

        AppWidgetManager manager = AppWidgetManager.getInstance(this);
        manager.updateAppWidget(widgetId, MathMasterHomeWidgetProvider.createViews(this, widgetId));
        Intent result = new Intent();
        result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        setResult(RESULT_OK, result);
        finish();
    }

    private static boolean isPaletteTheme(String theme) {
        if (theme == null) return false;
        for (String[] option : PREMIUM_THEMES) if (option[0].equals(theme)) return true;
        return false;
    }

    private static boolean isValidTheme(String theme) {
        return "app".equals(theme) || isPaletteTheme(theme);
    }

    private static String themeLabel(String theme) {
        if ("app".equals(theme)) return "Match App Theme";
        for (String[] option : PREMIUM_THEMES) if (option[0].equals(theme)) return option[1];
        return "Match App Theme";
    }

    private static String themeBackgroundColor(String theme) {
        if ("emerald".equals(theme)) return "#1C5A42";
        if ("ocean".equals(theme)) return "#15596B";
        if ("graphite".equals(theme)) return "#323D4B";
        if ("rose".equals(theme)) return "#6E294E";
        if ("violet".equals(theme)) return "#41326D";
        if ("sapphire".equals(theme)) return "#1D3978";
        if ("aurora".equals(theme)) return "#355A23";
        return "#211F35";
    }

    private static String chooseRandomTheme(SharedPreferences preferences, int widgetId) {
        Set<String> used = new HashSet<>();
        for (Map.Entry<String, ?> entry : preferences.getAll().entrySet()) {
            String key = entry.getKey();
            if (!key.startsWith("instance_") || !key.endsWith("_theme")) continue;
            String idPart = key.substring("instance_".length(), key.length() - "_theme".length());
            try {
                if (Integer.parseInt(idPart) == widgetId) continue;
            } catch (NumberFormatException ignored) {
                continue;
            }
            Object value = entry.getValue();
            if (value instanceof String && isPaletteTheme((String) value)) used.add((String) value);
        }
        List<String> available = new ArrayList<>();
        for (String[] option : PREMIUM_THEMES) if (!used.contains(option[0])) available.add(option[0]);
        if (available.isEmpty()) for (String[] option : PREMIUM_THEMES) available.add(option[0]);
        return available.get(new SecureRandom().nextInt(available.size()));
    }

    private static List<String> parseContent(String json) {
        List<String> values = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(json);
            for (int i = 0; i < array.length(); i++) {
                String item = array.optString(i, "");
                for (String[] option : CONTENT_OPTIONS) {
                    if (option[0].equals(item) && !values.contains(item)) values.add(item);
                }
            }
        } catch (JSONException ignored) {
            values.addAll(Arrays.asList("appIdentity", "target", "progress", "remaining", "studyTime", "streak", "updateStatus"));
        }
        if (values.isEmpty()) values.add("progress");
        return values;
    }

    private static String selectedRadioValue(RadioGroup group, String fallback) {
        if (group == null || group.getCheckedRadioButtonId() == -1) return fallback;
        RadioButton selected = group.findViewById(group.getCheckedRadioButtonId());
        Object value = selected == null ? null : selected.getTag();
        return value instanceof String ? (String) value : fallback;
    }

    private static LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private static String capitalize(String value) {
        if (value == null || value.isEmpty()) return value;
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }
}
