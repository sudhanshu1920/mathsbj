package com.sudhanshu.mathsbj;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.FrameLayout;
import android.widget.ImageView;
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
    private RadioGroup compositionGroup;
    private RadioGroup themeGroup;
    private TextView previewSummary;
    private FrameLayout previewFrame;
    private ImageView previewArtwork;
    private TextView previewDesignTitle;
    private TextView previewMetric;
    private TextView previewSubtitle;
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

    private static final String[][] WIDGET_COMPOSITIONS = {
        {"auto", "Auto (adapts to size)"},
        {"hero_wide", "Hero Wide · Sunset"},
        {"compact_green", "Compact Green · Botanical"},
        {"square_math_bot", "Square Math Bot"},
        {"medium_study", "Medium Study · Scenic"},
        {"square_cosmic", "Square Cosmic"},
        {"extra_wide_weekly", "Extra-Wide Weekly"},
        {"minimal_progress", "Minimal Progress"}
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

        String fixedComposition = MathMasterHomeWidgetProvider.getFixedCompositionForWidget(this, widgetId);
        addSectionLabel(content, fixedComposition == null ? "Design Composition" : "Selected Design");
        compositionGroup = new RadioGroup(this);
        compositionGroup.setOrientation(RadioGroup.VERTICAL);
        String currentComposition = fixedComposition != null ? fixedComposition : preferences.getString(
            "instance_" + widgetId + "_composition", preferences.getString("composition", "auto"));
        if (!isValidComposition(currentComposition)) currentComposition = "auto";
        for (String[] compositionOption : WIDGET_COMPOSITIONS) {
            addRadio(compositionGroup, compositionOption[0], compositionOption[1], currentComposition);
        }
        compositionGroup.setOnCheckedChangeListener((group, checkedId) -> updatePreview());
        if (fixedComposition != null) {
            compositionGroup.setVisibility(View.GONE);
            TextView fixedDesign = new TextView(this);
            fixedDesign.setText(compositionLabel(fixedComposition)
                + " — selected from the launcher widget collection");
            fixedDesign.setTextColor(Color.parseColor("#243149"));
            fixedDesign.setTextSize(13);
            fixedDesign.setPadding(dp(2), dp(3), dp(2), dp(6));
            content.addView(fixedDesign, matchWrap());
        }
        content.addView(compositionGroup, matchWrap());

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
        previewFrame = new FrameLayout(this);
        GradientDrawable previewSurface = new GradientDrawable();
        previewSurface.setColor(Color.parseColor("#211F35"));
        previewSurface.setCornerRadius(dp(16));
        previewSurface.setStroke(dp(1), Color.argb(75, 255, 255, 255));
        previewFrame.setBackground(previewSurface);
        previewFrame.setClipToOutline(true);
        previewFrame.setElevation(dp(2));

        previewArtwork = new ImageView(this);
        previewArtwork.setScaleType(ImageView.ScaleType.CENTER_CROP);
        previewArtwork.setContentDescription("Artwork preview for the selected widget design");
        previewArtwork.setVisibility(View.GONE);
        previewFrame.addView(previewArtwork, new FrameLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT));

        View previewShade = new View(this);
        GradientDrawable shade = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] { Color.argb(20, 0, 0, 0), Color.argb(210, 5, 10, 24) });
        shade.setCornerRadius(dp(16));
        previewShade.setBackground(shade);
        previewShade.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        previewFrame.addView(previewShade, new FrameLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT));

        LinearLayout previewOverlay = new LinearLayout(this);
        previewOverlay.setOrientation(LinearLayout.VERTICAL);
        previewOverlay.setGravity(Gravity.BOTTOM | Gravity.START);
        previewOverlay.setPadding(dp(14), dp(10), dp(14), dp(10));

        previewDesignTitle = new TextView(this);
        previewDesignTitle.setTextColor(Color.parseColor("#D9E8FF"));
        previewDesignTitle.setTextSize(10);
        previewDesignTitle.setTypeface(null, 1);
        previewDesignTitle.setLetterSpacing(0.08f);
        previewDesignTitle.setMaxLines(1);
        previewOverlay.addView(previewDesignTitle, matchWrap());

        previewMetric = new TextView(this);
        previewMetric.setTextColor(Color.WHITE);
        previewMetric.setTextSize(26);
        previewMetric.setTypeface(null, 1);
        previewMetric.setIncludeFontPadding(false);
        previewMetric.setShadowLayer(4, 0, dp(1), Color.argb(150, 0, 0, 0));
        previewOverlay.addView(previewMetric, matchWrap());

        previewSubtitle = new TextView(this);
        previewSubtitle.setTextColor(Color.parseColor("#E8EDFA"));
        previewSubtitle.setTextSize(10);
        previewSubtitle.setMaxLines(1);
        previewSubtitle.setEllipsize(android.text.TextUtils.TruncateAt.END);
        previewOverlay.addView(previewSubtitle, matchWrap());

        previewFrame.addView(previewOverlay, new FrameLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM | Gravity.START));
        content.addView(previewFrame, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(150)));

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
        String composition = selectedRadioValue(compositionGroup, "auto");
        String theme = selectedRadioValue(themeGroup, "app");
        boolean noFieldsSelected = selected.isEmpty();
        if (noFieldsSelected) previewSummary.setText("Select at least one field");

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
            : Color.parseColor(themeBackgroundColor(resolvedTheme, light));
        previewSummary.setTextColor(light ? Color.parseColor("#263247") : Color.parseColor("#F5F3FF"));
        previewSummary.setBackgroundColor(previewBackground);

        GradientDrawable previewSurface = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR, new int[] { previewBackground, previewBackground });
        previewSurface.setCornerRadius(dp(16));
        previewSurface.setStroke(dp(1), Color.argb(75, 255, 255, 255));
        previewFrame.setBackground(previewSurface);

        android.graphics.Bitmap artwork = MathMasterHomeWidgetProvider.getConfigurationPreviewArtwork(
            this, composition, 320, 150);
        previewArtwork.setImageBitmap(artwork);
        previewArtwork.setVisibility(artwork == null ? View.GONE : View.VISIBLE);

        previewDesignTitle.setText(selected.contains("appIdentity")
            ? "MATH MASTER" : compositionLabel(composition).toUpperCase(java.util.Locale.getDefault()));
        String primaryMetric = selected.contains("progress") ? percent + "%"
            : (selected.contains("target") ? targetMinutes + " MIN"
            : (selected.contains("remaining") ? remainingMinutes + " MIN LEFT"
            : (selected.contains("studyTime") ? elapsedMinutes + " MIN STUDIED"
            : (selected.contains("streak") ? streak + "-DAY STREAK" : "YOUR PROGRESS"))));
        previewMetric.setText(primaryMetric);

        List<String> previewDetails = new ArrayList<>();
        if (selected.contains("target")) previewDetails.add("Target " + targetMinutes + " min");
        if (selected.contains("studyTime")) previewDetails.add(elapsedMinutes + " min studied");
        if (selected.contains("remaining")) previewDetails.add(remainingMinutes + " min left");
        if (selected.contains("streak")) previewDetails.add(streak + "-day streak");
        if (selected.contains("weekly")) previewDetails.add("7-day tracker");
        if (selected.contains("updateStatus")) {
            previewDetails.add(preferences.getBoolean("updateAvailable", false) ? "Update available" : "Update status");
        }
        if (previewDetails.isEmpty()) previewDetails.add(capitalize(style) + " glass design");
        previewSubtitle.setText(android.text.TextUtils.join("  ·  ", previewDetails));

        String themeLabel = "random".equals(theme)
            ? "Random Premium Theme" + (isPaletteTheme(resolvedTheme) ? " · " + themeLabel(resolvedTheme) : "")
            : themeLabel(resolvedTheme);
        previewSummary.setText(noFieldsSelected
            ? "Select at least one field\n" + capitalize(style) + "  ·  " + themeLabel
            : "Design: " + compositionLabel(composition) + "\n"
                + android.text.TextUtils.join("\n", rows)
                + "\n" + capitalize(style) + "  ·  " + themeLabel);
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
        String fixedComposition = MathMasterHomeWidgetProvider.getFixedCompositionForWidget(this, widgetId);
        String composition = fixedComposition != null
            ? fixedComposition : selectedRadioValue(compositionGroup, "auto");
        if (!isValidComposition(composition)) composition = "auto";
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
        SharedPreferences.Editor editor = preferences.edit()
            .putString("instance_" + widgetId + "_contentJson", selected.toString())
            .putInt("instance_" + widgetId + "_contentSchemaVersion", 2)
            .putString("instance_" + widgetId + "_style", style)
            .putString("instance_" + widgetId + "_composition", composition)
            .putString("instance_" + widgetId + "_themeMode", themeMode)
            .putString("instance_" + widgetId + "_theme", theme);
        if (fixedComposition != null) {
            editor.putBoolean("instance_" + widgetId + "_catalogLocked", true);
        }
        editor.apply();

        AppWidgetManager manager = AppWidgetManager.getInstance(this);
        manager.updateAppWidget(widgetId, MathMasterHomeWidgetProvider.createViews(this, widgetId));
        Intent result = new Intent();
        result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        setResult(RESULT_OK, result);
        finish();
    }

    private static boolean isValidComposition(String composition) {
        if (composition == null) return false;
        for (String[] option : WIDGET_COMPOSITIONS) if (option[0].equals(composition)) return true;
        return false;
    }

    private static String compositionLabel(String composition) {
        for (String[] option : WIDGET_COMPOSITIONS) if (option[0].equals(composition)) return option[1];
        return "Auto (adapts to size)";
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

    private static String themeBackgroundColor(String theme, boolean light) {
        if (light) {
            if ("emerald".equals(theme)) return "#E3FFF1";
            if ("ocean".equals(theme)) return "#DDF9FF";
            if ("graphite".equals(theme)) return "#E6EBF4";
            if ("rose".equals(theme)) return "#FFE5F0";
            if ("violet".equals(theme)) return "#EEE7FF";
            if ("sapphire".equals(theme)) return "#DEE8FF";
            if ("aurora".equals(theme)) return "#EFFFD9";
            return "#F4F7FC";
        }
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
            values.addAll(Arrays.asList("appIdentity", "target", "progress", "remaining", "studyTime", "streak", "weekly", "updateStatus"));
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
