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
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.SeekBar;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.text.TextWatcher;
import android.text.Editable;
import android.text.InputType;
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
    private RadioGroup surfaceGroup;
    private Spinner fontSpinner;
    private Spinner previewSizeSpinner;
    private SeekBar opacitySeekBar;
    private SeekBar fontScaleSeekBar;
    private SeekBar paddingSeekBar;
    private CheckBox outlineCheck;
    private boolean surfaceSettingsExplicitlySaved;
    private EditText customPrimaryHex;
    private EditText customSecondaryHex;
    private EditText customAccentHex;
    private EditText customBackgroundHex;
    private EditText customOutlineHex;
    private TextView previewSummary;
    private FrameLayout previewFrame;
    private ImageView previewArtwork;
    private View previewShade;
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
        {"updateStatus", "Update Status"},
        {"quiz", "Open Quiz (Practice)"}
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
        {"system", "System Dynamic", "#8FAEFF"},
        {"minimal", "Minimal · Transparent", "#FFFFFF"},
        {"neon", "Neon · Cyan / Magenta", "#00FFFF"},
        {"cockpit", "Cockpit · Digital Green", "#00FF41"},
        {"sunset", "Sunset · Warm Gold", "#FFB432"},
        {"monochrome", "Monochrome · Graphite", "#F0F0F0"},
        {"snowfall", "Snowfall · Icy Blue", "#64AAFF"},
        {"deep_navy", "Premium Deep Navy · Default", "#8FAEFF"},
        {"custom", "Custom RGB Colors", "#AEBBD2"}
    };

    private static final String[] FONT_IDS = {
        "default", "serif", "monospace", "cursive", "condensed", "condensed_light",
        "light", "medium", "black", "thin", "small_caps"
    };

    private static final String[] FONT_LABELS = {
        "Default / Sans Serif", "Serif", "Monospace", "Cursive", "Condensed",
        "Condensed Light", "Light", "Medium", "Black", "Thin", "Small Caps"
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
        GradientDrawable settingsSurface = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[] { Color.parseColor("#0B1528"), Color.parseColor("#17253D") });
        content.setBackground(settingsSurface);

        TextView title = new TextView(this);
        title.setText("Customize Your Widget");
        title.setTextColor(Color.parseColor("#F5F7FF"));
        title.setTextSize(21);
        title.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
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
            checkBox.setTextColor(Color.parseColor("#E6ECF8"));
            checkBox.setTextSize(14);
            checkBox.setButtonTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#8FAEFF")));
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

        addSectionLabel(content, "Design Composition");
        compositionGroup = new RadioGroup(this);
        compositionGroup.setOrientation(RadioGroup.VERTICAL);
        String currentComposition = preferences.getString(
            "instance_" + widgetId + "_composition", preferences.getString("composition", "auto"));
        if (!isValidComposition(currentComposition)) currentComposition = "auto";
        for (String[] compositionOption : WIDGET_COMPOSITIONS) {
            addRadio(compositionGroup, compositionOption[0], compositionOption[1], currentComposition);
        }
        compositionGroup.setOnCheckedChangeListener((group, checkedId) -> updatePreview());
        content.addView(compositionGroup, matchWrap());

        addSectionLabel(content, "Widget Theme");
        themeGroup = new RadioGroup(this);
        themeGroup.setOrientation(RadioGroup.VERTICAL);
        String currentTheme = preferences.getString("instance_" + widgetId + "_theme",
            preferences.getString("theme", MathMasterWidgetStyle.DEFAULT_THEME));
        String currentThemeMode = preferences.getString("instance_" + widgetId + "_themeMode", currentTheme);
        if (!"random".equals(currentThemeMode)) currentThemeMode = MathMasterWidgetStyle.normalizeTheme(currentThemeMode);
        addRadio(themeGroup, "random", "Random Premium Theme", currentThemeMode);
        for (String[] themeOption : PREMIUM_THEMES) {
            addRadio(themeGroup, themeOption[0], themeOption[1], currentThemeMode);
        }
        themeGroup.setOnCheckedChangeListener((group, checkedId) -> {
            String selectedTheme = selectedRadioValue(themeGroup, MathMasterWidgetStyle.DEFAULT_THEME);
            if (!surfaceSettingsExplicitlySaved) {
                if ("minimal".equals(selectedTheme)) {
                    selectRadioValue(surfaceGroup, "transparent");
                    if (opacitySeekBar != null) opacitySeekBar.setProgress(0);
                } else {
                    String selectedSurface = selectedRadioValue(surfaceGroup, "translucent");
                    if ("transparent".equals(selectedSurface)) {
                        selectRadioValue(surfaceGroup, "translucent");
                        if (opacitySeekBar != null) opacitySeekBar.setProgress(
                            MathMasterWidgetStyle.defaultOpacity(selectedTheme));
                    }
                }
            }
            updatePreview();
        });
        content.addView(themeGroup, matchWrap());

        addSectionLabel(content, "Background Surface");
        surfaceGroup = new RadioGroup(this);
        surfaceGroup.setOrientation(RadioGroup.HORIZONTAL);
        String surfaceSettingsKey = "instance_" + widgetId + "_backgroundStyle";
        surfaceSettingsExplicitlySaved = preferences.contains(surfaceSettingsKey);
        String savedSurface = preferences.getString(surfaceSettingsKey,
            "minimal".equals(currentTheme) ? "transparent" : "translucent");
        addRadio(surfaceGroup, "transparent", "Transparent", savedSurface);
        addRadio(surfaceGroup, "translucent", "Translucent", savedSurface);
        addRadio(surfaceGroup, "solid", "Solid", savedSurface);
        surfaceGroup.setOnCheckedChangeListener((group, checkedId) -> {
            surfaceSettingsExplicitlySaved = true;
            updatePreview();
        });
        content.addView(surfaceGroup, matchWrap());

        addSectionLabel(content, "Background Opacity");
        opacitySeekBar = new SeekBar(this);
        opacitySeekBar.setMax(100);
        opacitySeekBar.setProgress(preferences.getInt("instance_" + widgetId + "_backgroundOpacity",
            MathMasterWidgetStyle.defaultOpacity(currentTheme)));
        opacitySeekBar.setOnSeekBarChangeListener(seekBarListener());
        content.addView(opacitySeekBar, matchWrap());

        outlineCheck = new CheckBox(this);
        outlineCheck.setText("Show subtle widget outline");
        outlineCheck.setTextColor(Color.parseColor("#243149"));
        outlineCheck.setChecked(preferences.getBoolean("instance_" + widgetId + "_showOutline", false));
        outlineCheck.setOnCheckedChangeListener((button, checked) -> updatePreview());
        content.addView(outlineCheck, matchWrap());

        addSectionLabel(content, "Typography");
        fontSpinner = new Spinner(this);
        ArrayAdapter<String> fontAdapter = new ArrayAdapter<>(this,
            android.R.layout.simple_spinner_item, FONT_LABELS);
        fontAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        fontSpinner.setAdapter(fontAdapter);
        String savedFont = MathMasterWidgetStyle.normalizeFont(
            preferences.getString("instance_" + widgetId + "_fontStyle", MathMasterWidgetStyle.DEFAULT_FONT));
        fontSpinner.setSelection(indexOf(FONT_IDS, savedFont));
        fontSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) { updatePreview(); }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) {}
        });
        content.addView(fontSpinner, matchWrap());

        addSectionLabel(content, "Font Size (75% – 125%)");
        fontScaleSeekBar = new SeekBar(this);
        fontScaleSeekBar.setMax(50);
        fontScaleSeekBar.setProgress(Math.max(0, Math.min(50,
            preferences.getInt("instance_" + widgetId + "_fontScalePercent", 100) - 75)));
        fontScaleSeekBar.setOnSeekBarChangeListener(seekBarListener());
        content.addView(fontScaleSeekBar, matchWrap());

        addSectionLabel(content, "Inner Padding (0 – 24 dp)");
        paddingSeekBar = new SeekBar(this);
        paddingSeekBar.setMax(24);
        paddingSeekBar.setProgress(Math.max(0, Math.min(24,
            preferences.getInt("instance_" + widgetId + "_widgetPadding", 7))));
        paddingSeekBar.setOnSeekBarChangeListener(seekBarListener());
        content.addView(paddingSeekBar, matchWrap());

        addSectionLabel(content, "Custom RGB / Hex Colors");
        customPrimaryHex = addHexField(content, "Primary text · #F5F7FF",
            preferences.getString("instance_" + widgetId + "_customPrimary", "#F5F7FF"));
        customSecondaryHex = addHexField(content, "Secondary text · #AEBBD2",
            preferences.getString("instance_" + widgetId + "_customSecondary", "#AEBBD2"));
        customAccentHex = addHexField(content, "Accent · #8FAEFF",
            preferences.getString("instance_" + widgetId + "_customAccent", "#8FAEFF"));
        customBackgroundHex = addHexField(content, "Background · #111B30",
            preferences.getString("instance_" + widgetId + "_customBackground", "#111B30"));
        customOutlineHex = addHexField(content, "Outline · #60749D",
            preferences.getString("instance_" + widgetId + "_customOutline", "#60749D"));

        addSectionLabel(content, "Preview Size");
        previewSizeSpinner = new Spinner(this);
        String[] previewSizeLabels = { "Compact", "Medium", "Wide" };
        ArrayAdapter<String> sizeAdapter = new ArrayAdapter<>(this,
            android.R.layout.simple_spinner_item, previewSizeLabels);
        sizeAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        previewSizeSpinner.setAdapter(sizeAdapter);
        previewSizeSpinner.setSelection(Math.max(0, Math.min(2,
            preferences.getInt("instance_" + widgetId + "_previewSize", 1))));
        previewSizeSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) { updatePreview(); }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) {}
        });
        content.addView(previewSizeSpinner, matchWrap());

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

        previewShade = new View(this);
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

    private SeekBar.OnSeekBarChangeListener seekBarListener() {
        return new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (fromUser) updatePreview();
            }
            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        };
    }

    private EditText addHexField(LinearLayout parent, String hint, String value) {
        EditText field = new EditText(this);
        field.setSingleLine(true);
        field.setTextSize(14);
        field.setTextColor(Color.parseColor("#F5F7FF"));
        field.setHintTextColor(Color.parseColor("#7F91AE"));
        field.setInputType(InputType.TYPE_CLASS_TEXT);
        field.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#60749D")));
        field.setHint(hint);
        field.setText(value);
        field.setSelectAllOnFocus(true);
        field.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence text, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence text, int start, int before, int count) { updatePreview(); }
            @Override public void afterTextChanged(Editable editable) {}
        });
        parent.addView(field, matchWrap());
        return field;
    }

    private static String hexValue(EditText field, String fallback) {
        if (field == null || field.getText() == null) return fallback;
        return field.getText().toString().trim().toUpperCase(java.util.Locale.US);
    }

    private static boolean isValidHex(String value) {
        return value != null && value.matches("#[0-9A-F]{6}");
    }

    private static int indexOf(String[] values, String value) {
        for (int i = 0; i < values.length; i++) if (values[i].equals(value)) return i;
        return 0;
    }

    private static void selectRadioValue(RadioGroup group, String value) {
        if (group == null || value == null) return;
        for (int i = 0; i < group.getChildCount(); i++) {
            View child = group.getChildAt(i);
            if (child instanceof RadioButton && value.equals(child.getTag())) {
                group.check(child.getId());
                return;
            }
        }
    }

    private void addRadio(RadioGroup group, String value, String label, String selectedValue) {
        RadioButton radio = new RadioButton(this);
        radio.setId(View.generateViewId());
        radio.setTag(value);
        radio.setText(label);
        radio.setTextSize(12);
        radio.setTextColor(Color.parseColor("#E6ECF8"));
        radio.setButtonTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#8FAEFF")));
        RadioGroup.LayoutParams params = group.getOrientation() == RadioGroup.HORIZONTAL
            ? new RadioGroup.LayoutParams(0, dp(48), 1f)
            : new RadioGroup.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        group.addView(radio, params);
        if (value.equals(selectedValue)) group.check(radio.getId());
    }

    private void addSectionLabel(LinearLayout parent, String label) {
        TextView view = new TextView(this);
        view.setText(label);
        view.setTextColor(Color.parseColor("#AEBBD2"));
        view.setTextSize(12);
        view.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
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
        if (selected.contains("quiz")) rows.add("Quiz shortcut: opens Practice");

        String appMode = preferences.getString("mode", "dark");
        boolean light = "light".equals(appMode);
        String themeMode = selectedRadioValue(themeGroup, MathMasterWidgetStyle.DEFAULT_THEME);
        String resolvedTheme = "random".equals(themeMode)
            ? preferences.getString("instance_" + widgetId + "_theme", MathMasterWidgetStyle.DEFAULT_THEME)
            : themeMode;
        resolvedTheme = MathMasterWidgetStyle.normalizeTheme(resolvedTheme);
        String surfaceStyle = selectedRadioValue(surfaceGroup, "translucent");
        int opacity = opacitySeekBar == null ? MathMasterWidgetStyle.defaultOpacity(resolvedTheme) : opacitySeekBar.getProgress();
        boolean outlined = outlineCheck != null && outlineCheck.isChecked();
        String font = fontSpinner == null ? MathMasterWidgetStyle.DEFAULT_FONT
            : FONT_IDS[Math.max(0, Math.min(FONT_IDS.length - 1, fontSpinner.getSelectedItemPosition()))];
        int textScale = fontScaleSeekBar == null ? 100 : 75 + fontScaleSeekBar.getProgress();
        MathMasterWidgetStyle.Palette palette = MathMasterWidgetStyle.resolvePalette(
            this, resolvedTheme, light, hexValue(customPrimaryHex, "#F5F7FF"),
            hexValue(customSecondaryHex, "#AEBBD2"), hexValue(customAccentHex, "#8FAEFF"),
            hexValue(customBackgroundHex, "#111B30"), hexValue(customOutlineHex, "#60749D"));
        int previewBackground = MathMasterWidgetStyle.surfaceColor(
            palette, surfaceStyle, opacity, resolvedTheme);
        previewSummary.setTextColor(palette.primary);
        previewSummary.setBackgroundColor(previewBackground);

        GradientDrawable previewSurface = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[] { previewBackground, previewBackground });
        previewSurface.setCornerRadius(dp(20));
        previewSurface.setStroke(outlined ? dp(1) : 0, palette.outline);
        previewFrame.setBackground(previewSurface);
        previewShade.setVisibility(Color.alpha(previewBackground) == 0 ? View.GONE : View.VISIBLE);

        int previewSize = previewSizeSpinner == null ? 1 : previewSizeSpinner.getSelectedItemPosition();
        int previewWidth = previewSize == 0 ? 180 : (previewSize == 2 ? 420 : 320);
        int previewHeight = previewSize == 0 ? 100 : (previewSize == 2 ? 132 : 150);
        FrameLayout.LayoutParams previewParams = (FrameLayout.LayoutParams) previewFrame.getLayoutParams();
        if (previewParams != null && previewParams.height != dp(previewHeight)) {
            previewParams.height = dp(previewHeight);
            previewFrame.setLayoutParams(previewParams);
        }
        android.graphics.Bitmap artwork = MathMasterHomeWidgetProvider.getConfigurationPreviewArtwork(
            this, composition, previewWidth, previewHeight);
        boolean showPreviewArtwork = Color.alpha(previewBackground) > 0 && artwork != null
            && !"minimal_progress".equals(composition);
        previewArtwork.setImageBitmap(artwork);
        previewArtwork.setVisibility(showPreviewArtwork ? View.VISIBLE : View.GONE);

        previewDesignTitle.setTextColor(palette.primary);
        previewMetric.setTextColor(palette.accent);
        previewSubtitle.setTextColor(palette.secondary);
        android.graphics.Typeface previewTypeface = MathMasterWidgetStyle.typeface(font);
        previewDesignTitle.setTypeface(previewTypeface);
        previewMetric.setTypeface(previewTypeface);
        previewSubtitle.setTypeface(previewTypeface);
        previewMetric.setTextSize(26f * textScale / 100f);

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
        if (selected.contains("quiz")) previewDetails.add("Practice shortcut");
        if (previewDetails.isEmpty()) previewDetails.add(capitalize(style) + " glass design");
        previewSubtitle.setText(android.text.TextUtils.join("  ·  ", previewDetails));

        String selectedThemeLabel = themeLabel(resolvedTheme);
        String themeLabel = "random".equals(themeMode)
            ? "Random Premium Theme · " + selectedThemeLabel
            : selectedThemeLabel;
        previewSummary.setTextColor(palette.primary);
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
        String composition = selectedRadioValue(compositionGroup, "auto");
        if (!isValidComposition(composition)) composition = "auto";
        String themeMode = selectedRadioValue(themeGroup, MathMasterWidgetStyle.DEFAULT_THEME);
        String surfaceStyle = selectedRadioValue(surfaceGroup, "translucent");
        String fontStyle = fontSpinner == null ? MathMasterWidgetStyle.DEFAULT_FONT
            : FONT_IDS[Math.max(0, Math.min(FONT_IDS.length - 1, fontSpinner.getSelectedItemPosition()))];
        String primaryHex = hexValue(customPrimaryHex, "#F5F7FF");
        String secondaryHex = hexValue(customSecondaryHex, "#AEBBD2");
        String accentHex = hexValue(customAccentHex, "#8FAEFF");
        String backgroundHex = hexValue(customBackgroundHex, "#111B30");
        String outlineHex = hexValue(customOutlineHex, "#60749D");
        if (!isValidHex(primaryHex) || !isValidHex(secondaryHex) || !isValidHex(accentHex)
            || !isValidHex(backgroundHex) || !isValidHex(outlineHex)) {
            Toast.makeText(this, "Enter valid 6-digit hex colors, for example #8FAEFF.", Toast.LENGTH_LONG).show();
            return;
        }
        SharedPreferences preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String previousThemeMode = preferences.getString("instance_" + widgetId + "_themeMode", "");
        String previousTheme = preferences.getString("instance_" + widgetId + "_theme", "");
        String theme;
        if ("random".equals(themeMode)) {
            theme = "random".equals(previousThemeMode) && isPaletteTheme(previousTheme)
                ? MathMasterWidgetStyle.normalizeTheme(previousTheme) : chooseRandomTheme(preferences, widgetId);
        } else {
            theme = isValidTheme(themeMode) ? MathMasterWidgetStyle.normalizeTheme(themeMode) : MathMasterWidgetStyle.DEFAULT_THEME;
        }
        preferences.edit()
            .putString("instance_" + widgetId + "_contentJson", selected.toString())
            .putInt("instance_" + widgetId + "_contentSchemaVersion", 2)
            .putString("instance_" + widgetId + "_style", style)
            .putString("instance_" + widgetId + "_composition", composition)
            .putString("instance_" + widgetId + "_themeMode", themeMode)
            .putString("instance_" + widgetId + "_theme", theme)
            .putString("instance_" + widgetId + "_backgroundStyle", surfaceStyle)
            .putInt("instance_" + widgetId + "_backgroundOpacity", Math.max(0, Math.min(100, opacitySeekBar.getProgress())))
            .putBoolean("instance_" + widgetId + "_showOutline", outlineCheck.isChecked())
            .putString("instance_" + widgetId + "_fontStyle", MathMasterWidgetStyle.normalizeFont(fontStyle))
            .putInt("instance_" + widgetId + "_fontScalePercent", 75 + fontScaleSeekBar.getProgress())
            .putInt("instance_" + widgetId + "_widgetPadding", Math.max(0, Math.min(24, paddingSeekBar.getProgress())))
            .putString("instance_" + widgetId + "_customPrimary", primaryHex)
            .putString("instance_" + widgetId + "_customSecondary", secondaryHex)
            .putString("instance_" + widgetId + "_customAccent", accentHex)
            .putString("instance_" + widgetId + "_customBackground", backgroundHex)
            .putString("instance_" + widgetId + "_customOutline", outlineHex)
            .putInt("instance_" + widgetId + "_previewSize",
                previewSizeSpinner == null ? 1 : Math.max(0, Math.min(2, previewSizeSpinner.getSelectedItemPosition())))
            .apply();

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

    /** Themes eligible for the per-instance random preset selector (never System or Custom). */
    private static boolean isPaletteTheme(String theme) {
        if (theme == null || "system".equals(theme) || "custom".equals(theme)) return false;
        for (String[] option : PREMIUM_THEMES) if (option[0].equals(theme)) return true;
        return false;
    }

    private static boolean isValidTheme(String theme) {
        return "system".equals(theme) || "custom".equals(theme) || isPaletteTheme(theme)
            || "app".equals(theme);
    }

    private static String themeLabel(String theme) {
        if ("app".equals(theme)) return "Match App Theme";
        for (String[] option : PREMIUM_THEMES) if (option[0].equals(theme)) return option[1];
        return "Match App Theme";
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
        for (String[] option : PREMIUM_THEMES) {
            if (isPaletteTheme(option[0]) && !used.contains(option[0])) available.add(option[0]);
        }
        if (available.isEmpty()) {
            for (String[] option : PREMIUM_THEMES) if (isPaletteTheme(option[0])) available.add(option[0]);
        }
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
