package com.sudhanshu.mathsbj;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.BroadcastReceiver;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Build;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class MathMasterWidgetConfigActivity extends Activity {
    private static final String PREFS = "math_master_home_widget";
    private static final int INVALID_WIDGET_ID = AppWidgetManager.INVALID_APPWIDGET_ID;

    private final Map<String, CheckBox> contentChecks = new LinkedHashMap<>();
    private final List<RadioButton> styleChoices = new ArrayList<>();
    private final List<RadioButton> compositionChoices = new ArrayList<>();
    private final Map<String, Spinner> screenTimeSpinners = new LinkedHashMap<>();
    private final Map<String, CheckBox> screenTimeChecks = new LinkedHashMap<>();
    private final Map<String, Button> screenTimeFilterButtons = new LinkedHashMap<>();
    private final Map<String, Set<String>> screenTimeFilterSelections = new LinkedHashMap<>();
    private final Map<String, Boolean> screenTimeFilterEnabled = new LinkedHashMap<>();
    private final Map<String, LinearLayout> screenTimeGroups = new LinkedHashMap<>();
    private TextView previewSummary;
    private ImageView previewArtwork;
    private int widgetId = INVALID_WIDGET_ID;
    private int surfaceColor;
    private int cardColor;
    private int textColor;
    private int mutedColor;
    private int borderColor;
    private int accentColor = Color.rgb(101, 88, 217);
    private BroadcastReceiver screenTimeReceiver;

    private static final String[][] CONTENT_OPTIONS = {
        {"appIdentity", "App Identity"},
        {"target", "Today's Target"},
        {"progress", "Progress"},
        {"remaining", "Remaining Target"},
        {"studyTime", "Study Time"},
        {"streak", "Streak"},
        {"weekly", "Weekly Target Tracker"},
        {"quiz", "Upcoming Quiz"},
        {"updateStatus", "Update Status"}
    };

    private static final String[][] STYLE_OPTIONS = {
        {"neon", "Neon Glass"},
        {"blur", "Transparent Blur"},
        {"transparent", "Full Transparent"}
    };

    private static final String[][] WIDGET_COMPOSITIONS = MathMasterHomeWidgetProvider.getWidgetCompositionOptions();

    @Override
    protected void onStart() {
        super.onStart();
        if (screenTimeReceiver != null) return;
        screenTimeReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (WidgetScreenTimeData.ACTION_DATA_UPDATED.equals(intent == null ? null : intent.getAction())) {
                    updatePreview();
                }
            }
        };
        IntentFilter filter = new IntentFilter(WidgetScreenTimeData.ACTION_DATA_UPDATED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(screenTimeReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(screenTimeReceiver, filter);
        }
    }

    @Override
    protected void onStop() {
        if (screenTimeReceiver != null) {
            try { unregisterReceiver(screenTimeReceiver); } catch (IllegalArgumentException ignored) {}
            screenTimeReceiver = null;
        }
        super.onStop();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setResult(RESULT_CANCELED);
        widgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, INVALID_WIDGET_ID);
        if (widgetId == INVALID_WIDGET_ID || !isActiveWidget(widgetId)) {
            finish();
            return;
        }

        resolvePalette();
        SharedPreferences preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(surfaceColor);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(false);
        scroll.setClipToPadding(false);
        scroll.setPadding(0, 0, 0, dp(8));
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(16), dp(12), dp(16), dp(8));
        scroll.addView(content, new ScrollView.LayoutParams(
            ScrollView.LayoutParams.MATCH_PARENT, ScrollView.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        addHeader(content);
        addSectionLabel(content, "WIDGET CONTENT", "Choose what appears on your home screen");
        String existingJson = preferences.getString(
            "instance_" + widgetId + "_contentJson",
            preferences.getString("contentJson", "[\"appIdentity\",\"target\",\"progress\",\"remaining\",\"studyTime\",\"streak\",\"weekly\",\"quiz\",\"updateStatus\"]")
        );
        List<String> selected = parseContent(existingJson);
        boolean savedForThisWidget = preferences.contains("instance_" + widgetId + "_contentJson");
        int savedSchema = preferences.getInt("instance_" + widgetId + "_contentSchemaVersion", 0);
        if ((!savedForThisWidget || savedSchema < 3) && !selected.contains("quiz")) selected.add("quiz");
        addContentGrid(content, selected);
        addSectionLabel(content, "SCREEN TIME CONTENT", "Live Android UsageStats · local device data");
        addScreenTimeControls(content, preferences);
        updateScreenTimeGroupVisibility();

        addSectionLabel(content, "BACKGROUND EFFECT", "Select the surface that blends with your wallpaper");
        String currentStyle = normalizeWidgetStyle(preferences.getString(
            "instance_" + widgetId + "_style", preferences.getString("style", "neon")));
        addStyleGrid(content, currentStyle);

        addSectionLabel(content, "DESIGN COMPOSITION", "Eight layouts · previews use the real widget renderer");
        String requestedComposition = getIntent().getStringExtra("initialComposition");
        String currentComposition = isValidComposition(requestedComposition)
            ? requestedComposition
            : preferences.getString(
                "instance_" + widgetId + "_composition", preferences.getString("composition", "auto"));
        if (!isValidComposition(currentComposition)) currentComposition = "auto";
        addCompositionGrid(content, currentComposition);

        addSectionLabel(content, "LIVE PREVIEW", "Updates as you change any option");
        LinearLayout previewCard = cardContainer();
        previewCard.setPadding(dp(8), dp(8), dp(8), dp(8));
        FrameLayout previewFrame = new FrameLayout(this);
        previewFrame.setBackground(rounded(Color.rgb(35, 43, 58), dp(14), borderColor));
        previewFrame.setClipToOutline(true);
        previewArtwork = new ImageView(this);
        previewArtwork.setScaleType(ImageView.ScaleType.FIT_CENTER);
        previewArtwork.setAdjustViewBounds(true);
        previewArtwork.setMaxHeight(dp(176));
        previewArtwork.setPadding(dp(6), dp(4), dp(6), dp(4));
        previewArtwork.setContentDescription("Live preview of the selected widget design");
        previewFrame.addView(previewArtwork, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT));
        previewCard.addView(previewFrame, matchWrap());
        previewSummary = new TextView(this);
        previewSummary.setTextColor(mutedColor);
        previewSummary.setTextSize(11);
        previewSummary.setPadding(dp(4), dp(7), dp(4), dp(2));
        previewCard.addView(previewSummary, matchWrap());
        content.addView(previewCard, sectionParams());
        updatePreview();

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER_VERTICAL);
        actions.setPadding(dp(16), dp(9), dp(16), dp(9));
        actions.setBackground(rounded(cardColor, dp(16), borderColor));
        Button cancel = actionButton("Cancel", false);
        cancel.setOnClickListener(view -> finish());
        Button save = actionButton("Save changes", true);
        save.setOnClickListener(view -> saveConfiguration());
        LinearLayout.LayoutParams cancelParams = new LinearLayout.LayoutParams(0, dp(44), 1f);
        cancelParams.setMarginEnd(dp(8));
        actions.addView(cancel, cancelParams);
        actions.addView(save, new LinearLayout.LayoutParams(0, dp(44), 1.25f));
        LinearLayout.LayoutParams actionParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        actionParams.setMargins(dp(12), dp(6), dp(12), dp(10));
        root.addView(actions, actionParams);
        setContentView(root);
    }

    private boolean isActiveWidget(int id) {
        int[] activeIds = AppWidgetManager.getInstance(this).getAppWidgetIds(
            new ComponentName(this, MathMasterHomeWidgetProvider.class));
        if (activeIds == null) return false;
        for (int activeId : activeIds) if (activeId == id) return true;
        return false;
    }

    private void resolvePalette() {
        boolean dark = (getResources().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        surfaceColor = dark ? Color.rgb(17, 20, 29) : Color.rgb(245, 247, 252);
        cardColor = dark ? Color.rgb(28, 33, 46) : Color.WHITE;
        textColor = dark ? Color.rgb(239, 242, 250) : Color.rgb(28, 36, 54);
        mutedColor = dark ? Color.rgb(164, 173, 192) : Color.rgb(101, 112, 133);
        borderColor = dark ? Color.rgb(57, 65, 83) : Color.rgb(224, 229, 239);
        TypedValue accent = new TypedValue();
        if (getTheme().resolveAttribute(android.R.attr.colorAccent, accent, true)) {
            accentColor = accent.data;
        }
    }

    private void addHeader(LinearLayout parent) {
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        TextView eyebrow = new TextView(this);
        eyebrow.setText("MATH MASTER  /  WIDGET STUDIO");
        eyebrow.setTextColor(accentColor);
        eyebrow.setTextSize(10);
        eyebrow.setLetterSpacing(0.08f);
        TextView title = new TextView(this);
        title.setText("Customize Your Widget");
        title.setTextColor(textColor);
        title.setTextSize(21);
        title.setTypeface(null, 1);
        TextView subtitle = new TextView(this);
        subtitle.setText("Personalize widget #" + widgetId);
        subtitle.setTextColor(mutedColor);
        subtitle.setTextSize(11);
        header.addView(eyebrow, matchWrap());
        LinearLayout.LayoutParams titleParams = matchWrap();
        titleParams.topMargin = dp(3);
        header.addView(title, titleParams);
        LinearLayout.LayoutParams subtitleParams = matchWrap();
        subtitleParams.topMargin = dp(2);
        header.addView(subtitle, subtitleParams);
        parent.addView(header, sectionParams());
    }

    private void addContentGrid(LinearLayout parent, List<String> selected) {
        int columns = gridColumns();
        LinearLayout row = null;
        for (int i = 0; i < CONTENT_OPTIONS.length; i++) {
            if (i % columns == 0) {
                row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                parent.addView(row, sectionParams());
            }
            String[] option = CONTENT_OPTIONS[i];
            CheckBox check = new CheckBox(this);
            check.setText(option[1]);
            check.setTextColor(textColor);
            check.setTextSize(11);
            check.setMinHeight(dp(44));
            check.setButtonTintList(android.content.res.ColorStateList.valueOf(accentColor));
            check.setPadding(dp(5), dp(2), dp(5), dp(2));
            check.setBackground(rounded(cardColor, dp(11), borderColor));
            check.setChecked(selected.contains(option[0]));
            contentChecks.put(option[0], check);
            check.setOnCheckedChangeListener((button, checked) -> {
                updatePreview();
                updateScreenTimeGroupVisibility();
                check.setBackground(rounded(checked ? selectedSurface() : cardColor, dp(11),
                    checked ? accentColor : borderColor));
            });
            check.setBackground(rounded(selected.contains(option[0]) ? selectedSurface() : cardColor,
                dp(11), selected.contains(option[0]) ? accentColor : borderColor));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(48), 1f);
            params.setMargins(dp(2), dp(2), dp(2), dp(2));
            row.addView(check, params);
        }
        int remainder = CONTENT_OPTIONS.length % columns;
        if (remainder != 0 && row != null) {
            for (int i = remainder; i < columns; i++) row.addView(new View(this),
                new LinearLayout.LayoutParams(0, dp(48), 1f));
        }
    }

    private void addScreenTimeControls(LinearLayout parent, SharedPreferences preferences) {
        addScreenTimeGroup(parent, "Study Apps Screen Time", "study", preferences);
        addScreenTimeGroup(parent, "Device Apps Screen Time", "device", preferences);
    }

    private void addScreenTimeGroup(LinearLayout parent, String title, String key, SharedPreferences preferences) {
        LinearLayout group = cardContainer();
        group.setOrientation(LinearLayout.VERTICAL);
        group.setPadding(dp(10), dp(8), dp(10), dp(8));
        TextView heading = new TextView(this);
        heading.setText(title);
        heading.setTextColor(textColor);
        heading.setTextSize(12);
        heading.setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD);
        group.addView(heading, matchWrap());
        TextView explanation = new TextView(this);
        explanation.setText("study".equals(key)
            ? "Follows the Study Apps list in Study Mode automatically."
            : "Uses eligible installed apps and keeps usage data on this device.");
        explanation.setTextColor(mutedColor);
        explanation.setTextSize(10);
        explanation.setPadding(0, dp(2), 0, dp(2));
        group.addView(explanation, matchWrap());

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        String prefix = "instance_" + widgetId + "_";
        addScreenTimeSpinner(row, key + "Period", prefix + key + "Period",
            new String[]{"Today", "Yesterday", "Last 7 Days"},
            new String[]{"today", "yesterday", "last_7_days"},
            preferences.getString(prefix + key + "Period", "today"));
        addScreenTimeSpinner(row, key + "Sort", prefix + key + "Sort",
            new String[]{"Most Used", "Least Used", "Name A–Z", "Name Z–A"},
            new String[]{"most_used", "least_used", "name_az", "name_za"},
            preferences.getString(prefix + key + "Sort", "most_used"));
        addScreenTimeSpinner(row, key + "MaxApps", prefix + key + "MaxApps",
            new String[]{"3 apps", "5 apps", "8 apps"},
            new String[]{"3", "5", "8"},
            String.valueOf(preferences.getInt(prefix + key + "MaxApps", 5)));
        group.addView(row, sectionParams());

        LinearLayout toggles = new LinearLayout(this);
        toggles.setOrientation(LinearLayout.HORIZONTAL);
        addScreenTimeCheck(toggles, key + "ShowTotal", "Total", prefix + key + "ShowTotal",
            preferences.getBoolean(prefix + key + "ShowTotal", true));
        addScreenTimeCheck(toggles, key + "ShowUsage", "App time", prefix + key + "ShowUsage",
            preferences.getBoolean(prefix + key + "ShowUsage", true));
        addScreenTimeCheck(toggles, key + "ShowPercent", "Percent", prefix + key + "ShowPercent",
            preferences.getBoolean(prefix + key + "ShowPercent", true));
        addScreenTimeCheck(toggles, key + "Compact", "Compact", prefix + key + "Compact",
            preferences.getBoolean(prefix + key + "Compact", false));
        group.addView(toggles, sectionParams());

        Set<String> savedFilter = new HashSet<>();
        boolean filterEnabled = preferences.getBoolean(prefix + key + "AppFilterEnabled", false);
        if (filterEnabled) {
            try {
                JSONArray values = new JSONArray(preferences.getString(prefix + key + "AppFilterJson", "[]"));
                for (int i = 0; i < values.length(); i++) {
                    String pkg = values.optString(i, "");
                    if (!pkg.isEmpty()) savedFilter.add(pkg);
                }
            } catch (JSONException ignored) {}
        }
        screenTimeFilterSelections.put(key, savedFilter);
        screenTimeFilterEnabled.put(key, filterEnabled);
        Button filterButton = actionButton(filterEnabled ? "Choose apps · selected" : "Choose apps · All", false);
        filterButton.setOnClickListener(view -> showScreenTimeAppPicker(key));
        screenTimeFilterButtons.put(key, filterButton);
        LinearLayout.LayoutParams filterParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(36));
        filterParams.topMargin = dp(3);
        group.addView(filterButton, filterParams);
        screenTimeGroups.put(key, group);
        parent.addView(group, sectionParams());
    }

    private void updateScreenTimeGroupVisibility() {
        for (String key : new String[]{"study", "device"}) {
            LinearLayout group = screenTimeGroups.get(key);
            CheckBox enabled = contentChecks.get(key.equals("study")
                ? "studyAppsScreenTime" : "deviceAppsScreenTime");
            if (group != null) group.setVisibility(enabled != null && enabled.isChecked() ? View.VISIBLE : View.GONE);
        }
    }

    private void showScreenTimeAppPicker(String key) {
        boolean studyOnly = "study".equals(key);
        List<WidgetScreenTimeData.AppChoice> choices = WidgetScreenTimeData.getSelectableApps(this, studyOnly);
        if (choices.isEmpty()) {
            Toast.makeText(this, studyOnly ? "Select Study Apps in Study Mode first." : "No eligible installed apps are visible.", Toast.LENGTH_LONG).show();
            return;
        }
        String[] labels = new String[choices.size()];
        boolean[] checked = new boolean[choices.size()];
        Set<String> previous = screenTimeFilterSelections.get(key);
        boolean filterWasEnabled = Boolean.TRUE.equals(screenTimeFilterEnabled.get(key));
        for (int i = 0; i < choices.size(); i++) {
            WidgetScreenTimeData.AppChoice choice = choices.get(i);
            labels[i] = choice.label;
            checked[i] = !filterWasEnabled || (previous != null && previous.contains(choice.packageName));
        }
        Set<String> selected = new HashSet<>();
        for (int i = 0; i < choices.size(); i++) if (checked[i]) selected.add(choices.get(i).packageName);
        new AlertDialog.Builder(this)
            .setTitle(studyOnly ? "Show Study Apps" : "Show Device Apps")
            .setMultiChoiceItems(labels, checked, (dialog, which, value) -> {
                if (value) selected.add(choices.get(which).packageName);
                else selected.remove(choices.get(which).packageName);
            })
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Apply", (dialog, which) -> {
                boolean enabled = selected.size() != choices.size();
                screenTimeFilterSelections.put(key, new HashSet<>(selected));
                screenTimeFilterEnabled.put(key, enabled);
                Button button = screenTimeFilterButtons.get(key);
                if (button != null) button.setText(enabled
                    ? "Choose apps · " + selected.size() + " selected" : "Choose apps · All");
                updatePreview();
            }).show();
    }

    private void addScreenTimeSpinner(LinearLayout row, String id, String prefKey,
        String[] labels, String[] values, String selectedValue) {
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        TextView label = new TextView(this);
        label.setText(id.endsWith("Period") ? "PERIOD" : (id.endsWith("Sort") ? "SORT" : "SHOW"));
        label.setTextColor(mutedColor);
        label.setTextSize(9);
        column.addView(label, matchWrap());
        Spinner spinner = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, labels);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinner.setAdapter(adapter);
        int selected = 0;
        for (int i = 0; i < values.length; i++) if (values[i].equals(selectedValue)) selected = i;
        spinner.setSelection(selected);
        spinner.setBackground(rounded(cardColor, dp(8), borderColor));
        screenTimeSpinners.put(id, spinner);
        spinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parentView, View view, int position, long itemId) {
                updatePreview();
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parentView) {}
        });
        column.addView(spinner, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(38)));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        params.setMargins(dp(2), dp(2), dp(2), dp(2));
        row.addView(column, params);
    }

    private void addScreenTimeCheck(LinearLayout row, String id, String label, String prefKey, boolean checked) {
        CheckBox check = new CheckBox(this);
        check.setText(label);
        check.setTextColor(textColor);
        check.setTextSize(10);
        check.setMinHeight(dp(34));
        check.setButtonTintList(android.content.res.ColorStateList.valueOf(accentColor));
        check.setChecked(checked);
        screenTimeChecks.put(id, check);
        check.setOnCheckedChangeListener((button, value) -> updatePreview());
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(36), 1f);
        row.addView(check, params);
    }

    private String selectedScreenTimeValue(String id, String[] values, String fallback) {
        Spinner spinner = screenTimeSpinners.get(id);
        if (spinner == null) return fallback;
        int position = spinner.getSelectedItemPosition();
        return position >= 0 && position < values.length ? values[position] : fallback;
    }

    private boolean screenTimeChecked(String id, boolean fallback) {
        CheckBox check = screenTimeChecks.get(id);
        return check == null ? fallback : check.isChecked();
    }

    private org.json.JSONObject screenTimePreviewConfig() {
        org.json.JSONObject result = new org.json.JSONObject();
        try {
            for (String key : new String[]{"study", "device"}) {
                result.put(key + "Period", selectedScreenTimeValue(key + "Period",
                    new String[]{"today", "yesterday", "last_7_days"}, "today"));
                result.put(key + "Sort", selectedScreenTimeValue(key + "Sort",
                    new String[]{"most_used", "least_used", "name_az", "name_za"}, "most_used"));
                result.put(key + "MaxApps", Integer.parseInt(selectedScreenTimeValue(key + "MaxApps",
                    new String[]{"3", "5", "8"}, "5")));
                result.put(key + "ShowTotal", screenTimeChecked(key + "ShowTotal", true));
                result.put(key + "ShowUsage", screenTimeChecked(key + "ShowUsage", true));
                result.put(key + "ShowPercent", screenTimeChecked(key + "ShowPercent", true));
                result.put(key + "Compact", screenTimeChecked(key + "Compact", false));
                result.put(key + "AppFilterEnabled", Boolean.TRUE.equals(screenTimeFilterEnabled.get(key)));
                JSONArray filter = new JSONArray();
                Set<String> packages = screenTimeFilterSelections.get(key);
                if (packages != null) for (String pkg : packages) filter.put(pkg);
                result.put(key + "AppFilterJson", filter);
            }
        } catch (Exception ignored) {}
        return result;
    }

    private void addStyleGrid(LinearLayout parent, String selectedStyle) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        parent.addView(row, sectionParams());
        for (String[] option : STYLE_OPTIONS) {
            LinearLayout tile = cardContainer();
            tile.setGravity(Gravity.CENTER);
            tile.setPadding(dp(4), dp(8), dp(4), dp(7));
            View swatch = new View(this);
            int swatchColor = "neon".equals(option[0]) ? Color.rgb(83, 75, 170)
                : ("blur".equals(option[0]) ? Color.rgb(102, 119, 142) : Color.TRANSPARENT);
            swatch.setBackground(rounded(swatchColor, dp(8), accentColor));
            tile.addView(swatch, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(25)));
            RadioButton choice = compactRadio(option[1], option[0], selectedStyle);
            styleChoices.add(choice);
            tile.addView(choice, matchWrap());
            tile.setOnClickListener(view -> selectChoice(styleChoices, choice));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(76), 1f);
            params.setMargins(dp(2), dp(2), dp(2), dp(2));
            row.addView(tile, params);
        }
        syncChoiceCards(styleChoices);
    }

    private void addCompositionGrid(LinearLayout parent, String selectedComposition) {
        int columns = gridColumns();
        LinearLayout row = null;
        for (int i = 0; i < WIDGET_COMPOSITIONS.length; i++) {
            if (i % columns == 0) {
                row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                parent.addView(row, sectionParams());
            }
            String[] option = WIDGET_COMPOSITIONS[i];
            LinearLayout tile = cardContainer();
            tile.setPadding(dp(5), dp(5), dp(5), dp(4));
            ImageView thumbnail = new ImageView(this);
            thumbnail.setScaleType(ImageView.ScaleType.FIT_CENTER);
            thumbnail.setAdjustViewBounds(true);
            thumbnail.setMaxHeight(dp(54));
            thumbnail.setContentDescription(option[1] + " actual widget preview");
            Bitmap bitmap = renderDesignThumbnail(option[0]);
            if (bitmap != null) thumbnail.setImageBitmap(bitmap);
            tile.addView(thumbnail, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(54)));
            RadioButton choice = compactRadio(option[1], option[0], selectedComposition);
            compositionChoices.add(choice);
            tile.addView(choice, matchWrap());
            tile.setOnClickListener(view -> selectChoice(compositionChoices, choice));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(102), 1f);
            params.setMargins(dp(2), dp(2), dp(2), dp(2));
            row.addView(tile, params);
        }
        int remainder = WIDGET_COMPOSITIONS.length % columns;
        if (remainder != 0 && row != null) {
            for (int i = remainder; i < columns; i++) row.addView(new View(this),
                new LinearLayout.LayoutParams(0, dp(102), 1f));
        }
        syncChoiceCards(compositionChoices);
    }

    private Bitmap renderDesignThumbnail(String composition) {
        try {
            Set<String> sample = new HashSet<>(Arrays.asList("appIdentity", "target", "progress", "streak", "weekly"));
            return MathMasterHomeWidgetProvider.renderConfigurationPreview(
                this, composition, "neon", sample, 190, 92);
        } catch (RuntimeException | OutOfMemoryError ignored) {
            return null;
        }
    }

    private RadioButton compactRadio(String label, String value, String selectedValue) {
        RadioButton radio = new RadioButton(this);
        radio.setId(View.generateViewId());
        radio.setTag(value);
        radio.setText(label);
        radio.setTextColor(textColor);
        radio.setTextSize(10);
        radio.setMinHeight(dp(34));
        radio.setPadding(dp(1), 0, dp(1), 0);
        radio.setButtonTintList(android.content.res.ColorStateList.valueOf(accentColor));
        radio.setChecked(value.equals(selectedValue));
        radio.setOnClickListener(view -> {
            List<RadioButton> choices = styleChoices.contains(radio) ? styleChoices : compositionChoices;
            selectChoice(choices, radio);
        });
        return radio;
    }

    private void selectChoice(List<RadioButton> choices, RadioButton selected) {
        for (RadioButton choice : choices) choice.setChecked(choice == selected);
        syncChoiceCards(choices);
        updatePreview();
    }

    private void syncChoiceCards(List<RadioButton> choices) {
        for (RadioButton choice : choices) {
            if (choice.getParent() instanceof LinearLayout) {
                LinearLayout tile = (LinearLayout) choice.getParent();
                boolean selected = choice.isChecked();
                tile.setBackground(rounded(selected ? selectedSurface() : cardColor,
                    dp(12), selected ? accentColor : borderColor));
            }
        }
    }

    private void addSectionLabel(LinearLayout parent, String label, String helper) {
        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.VERTICAL);
        TextView title = new TextView(this);
        title.setText(label);
        title.setTextColor(textColor);
        title.setTextSize(11);
        title.setTypeface(null, 1);
        title.setLetterSpacing(0.06f);
        TextView hint = new TextView(this);
        hint.setText(helper);
        hint.setTextColor(mutedColor);
        hint.setTextSize(10);
        heading.addView(title, matchWrap());
        LinearLayout.LayoutParams hintParams = matchWrap();
        hintParams.topMargin = dp(1);
        heading.addView(hint, hintParams);
        parent.addView(heading, sectionParams());
    }

    private LinearLayout cardContainer() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(rounded(cardColor, dp(12), borderColor));
        return card;
    }

    private Button actionButton(String label, boolean primary) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(12);
        button.setTypeface(null, 1);
        button.setTextColor(primary ? Color.WHITE : textColor);
        button.setBackground(rounded(primary ? accentColor : cardColor, dp(12), primary ? accentColor : borderColor));
        button.setMinHeight(dp(44));
        button.setPadding(dp(8), 0, dp(8), 0);
        return button;
    }

    private int selectedSurface() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
            == Configuration.UI_MODE_NIGHT_YES ? Color.rgb(49, 43, 83) : Color.rgb(239, 237, 255);
    }

    private int gridColumns() {
        float widthDp = getResources().getDisplayMetrics().widthPixels
            / getResources().getDisplayMetrics().density;
        return widthDp >= 840 ? 4 : (widthDp >= 600 ? 3 : 2);
    }

    private GradientDrawable rounded(int color, int radius, int stroke) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radius);
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private LinearLayout.LayoutParams sectionParams() {
        LinearLayout.LayoutParams params = matchWrap();
        params.topMargin = dp(8);
        return params;
    }

    private int[] previewSizeDp() {
        Bundle options = AppWidgetManager.getInstance(this).getAppWidgetOptions(widgetId);
        int width = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int height = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        if (width < 40 || height < 30) {
            width = 312;
            height = 140;
        }
        return new int[] { width, height };
    }

    private void updatePreview() {
        if (previewSummary == null || previewArtwork == null) return;
        Set<String> selected = new HashSet<>();
        List<String> selectedLabels = new ArrayList<>();
        for (String[] option : CONTENT_OPTIONS) {
            CheckBox check = contentChecks.get(option[0]);
            if (check != null && check.isChecked()) {
                selected.add(option[0]);
                selectedLabels.add(option[1]);
            }
        }
        String style = selectedRadioValue(styleChoices, "neon");
        String composition = selectedRadioValue(compositionChoices, "auto");
        if (selected.isEmpty()) {
            previewArtwork.setImageDrawable(null);
            previewArtwork.setVisibility(View.GONE);
            previewSummary.setText("Select at least one content item to preview this widget.");
            return;
        }
        int[] size = previewSizeDp();
        try {
            Bitmap preview = MathMasterHomeWidgetProvider.renderConfigurationPreview(
                this, composition, style, selected, size[0], size[1], screenTimePreviewConfig().toString());
            previewArtwork.setImageBitmap(preview);
            previewArtwork.setVisibility(preview == null ? View.GONE : View.VISIBLE);
        } catch (RuntimeException | OutOfMemoryError ignored) {
            previewArtwork.setImageDrawable(null);
            previewArtwork.setVisibility(View.GONE);
        }
        previewSummary.setText(compositionLabel(composition) + "  ·  "
            + styleLabel(style) + "  ·  " + selected.size() + " fields");
    }

    private void saveConfiguration() {
        JSONArray selected = new JSONArray();
        for (String[] option : CONTENT_OPTIONS) {
            CheckBox check = contentChecks.get(option[0]);
            if (check != null && check.isChecked()) selected.put(option[0]);
        }
        if (selected.length() == 0) {
            Toast.makeText(this, "Select at least one widget field.", Toast.LENGTH_SHORT).show();
            return;
        }

        String style = normalizeWidgetStyle(selectedRadioValue(styleChoices, "neon"));
        String composition = selectedRadioValue(compositionChoices, "auto");
        if (!isValidComposition(composition)) {
            Toast.makeText(this, "Choose a valid widget design.", Toast.LENGTH_SHORT).show();
            return;
        }
        if (!isActiveWidget(widgetId)) {
            Toast.makeText(this, "This widget is no longer active. Reopen Widget Studio.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        SharedPreferences preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String prefix = "instance_" + widgetId + "_";
        String contentKey = prefix + "contentJson";
        String schemaKey = prefix + "contentSchemaVersion";
        String styleKey = prefix + "style";
        String compositionKey = prefix + "composition";
        boolean hadContent = preferences.contains(contentKey);
        boolean hadSchema = preferences.contains(schemaKey);
        boolean hadStyle = preferences.contains(styleKey);
        boolean hadComposition = preferences.contains(compositionKey);
        Map<String, ?> previousValues = preferences.getAll();
        boolean hadThemeMode = previousValues.containsKey(prefix + "themeMode");
        boolean hadTheme = previousValues.containsKey(prefix + "theme");
        Object oldThemeMode = previousValues.get(prefix + "themeMode");
        Object oldTheme = previousValues.get(prefix + "theme");
        String oldContent = preferences.getString(contentKey, null);
        int oldSchema = preferences.getInt(schemaKey, 0);
        String oldStyle = preferences.getString(styleKey, null);
        String oldComposition = preferences.getString(compositionKey, null);

        boolean saved = preferences.edit()
            .putString(contentKey, selected.toString())
            .putInt(schemaKey, 4)
            .putString(styleKey, style)
            .putString(compositionKey, composition)
            .putString(prefix + "studyPeriod", selectedScreenTimeValue("studyPeriod",
                new String[]{"today", "yesterday", "last_7_days"}, "today"))
            .putString(prefix + "studySort", selectedScreenTimeValue("studySort",
                new String[]{"most_used", "least_used", "name_az", "name_za"}, "most_used"))
            .putInt(prefix + "studyMaxApps", Integer.parseInt(selectedScreenTimeValue("studyMaxApps",
                new String[]{"3", "5", "8"}, "5")))
            .putBoolean(prefix + "studyShowTotal", screenTimeChecked("studyShowTotal", true))
            .putBoolean(prefix + "studyShowUsage", screenTimeChecked("studyShowUsage", true))
            .putBoolean(prefix + "studyShowPercent", screenTimeChecked("studyShowPercent", true))
            .putBoolean(prefix + "studyCompact", screenTimeChecked("studyCompact", false))
            .putString(prefix + "devicePeriod", selectedScreenTimeValue("devicePeriod",
                new String[]{"today", "yesterday", "last_7_days"}, "today"))
            .putString(prefix + "deviceSort", selectedScreenTimeValue("deviceSort",
                new String[]{"most_used", "least_used", "name_az", "name_za"}, "most_used"))
            .putInt(prefix + "deviceMaxApps", Integer.parseInt(selectedScreenTimeValue("deviceMaxApps",
                new String[]{"3", "5", "8"}, "5")))
            .putBoolean(prefix + "deviceShowTotal", screenTimeChecked("deviceShowTotal", true))
            .putBoolean(prefix + "deviceShowUsage", screenTimeChecked("deviceShowUsage", true))
            .putBoolean(prefix + "deviceShowPercent", screenTimeChecked("deviceShowPercent", true))
            .putBoolean(prefix + "deviceCompact", screenTimeChecked("deviceCompact", false))
            .putBoolean(prefix + "studyAppFilterEnabled", Boolean.TRUE.equals(screenTimeFilterEnabled.get("study")))
            .putString(prefix + "studyAppFilterJson", packageFilterJson("study"))
            .putBoolean(prefix + "deviceAppFilterEnabled", Boolean.TRUE.equals(screenTimeFilterEnabled.get("device")))
            .putString(prefix + "deviceAppFilterJson", packageFilterJson("device"))
            .remove(prefix + "themeMode")
            .remove(prefix + "theme")
            .commit();
        if (!saved) {
            Toast.makeText(this, "Could not save widget settings. Previous settings are unchanged.", Toast.LENGTH_LONG).show();
            return;
        }

        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(this);
            manager.updateAppWidget(widgetId, MathMasterHomeWidgetProvider.createViews(this, widgetId));
        } catch (RuntimeException updateError) {
            SharedPreferences.Editor rollback = preferences.edit();
            restoreValue(rollback, contentKey, hadContent, oldContent);
            if (hadSchema) rollback.putInt(schemaKey, oldSchema); else rollback.remove(schemaKey);
            restoreValue(rollback, styleKey, hadStyle, oldStyle);
            restoreValue(rollback, compositionKey, hadComposition, oldComposition);
            restoreValue(rollback, prefix + "themeMode", hadThemeMode, oldThemeMode);
            restoreValue(rollback, prefix + "theme", hadTheme, oldTheme);
            for (String key : new String[]{
                "studyPeriod", "studySort", "studyMaxApps", "studyShowTotal", "studyShowUsage",
                "studyShowPercent", "studyCompact", "devicePeriod", "deviceSort", "deviceMaxApps",
                "deviceShowTotal", "deviceShowUsage", "deviceShowPercent", "deviceCompact",
                "studyAppFilterEnabled", "studyAppFilterJson", "deviceAppFilterEnabled", "deviceAppFilterJson"
            }) restoreValue(rollback, prefix + key, previousValues.containsKey(prefix + key), previousValues.get(prefix + key));
            rollback.commit();
            Toast.makeText(this, "Widget update failed. Previous settings were restored.", Toast.LENGTH_LONG).show();
            return;
        }

        Intent result = new Intent();
        result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        setResult(RESULT_OK, result);
        Toast.makeText(this, "Widget updated successfully.", Toast.LENGTH_SHORT).show();
        finish();
    }

    private String packageFilterJson(String key) {
        JSONArray result = new JSONArray();
        Set<String> values = screenTimeFilterSelections.get(key);
        if (values != null) for (String value : values) result.put(value);
        return result.toString();
    }

    private static void restoreValue(SharedPreferences.Editor editor, String key, boolean existed, Object value) {
        if (!existed || value == null) {
            editor.remove(key);
        } else if (value instanceof String) {
            editor.putString(key, (String) value);
        } else if (value instanceof Boolean) {
            editor.putBoolean(key, (Boolean) value);
        } else if (value instanceof Integer) {
            editor.putInt(key, (Integer) value);
        } else if (value instanceof Long) {
            editor.putLong(key, (Long) value);
        } else if (value instanceof Float) {
            editor.putFloat(key, (Float) value);
        } else if (value instanceof Set<?>) {
            Set<String> strings = new HashSet<>();
            for (Object item : (Set<?>) value) if (item instanceof String) strings.add((String) item);
            editor.putStringSet(key, strings);
        } else {
            editor.remove(key);
        }
    }

    private static String normalizeWidgetStyle(String style) {
        return MathMasterHomeWidgetProvider.normalizeWidgetStyle(style);
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

    private static String styleLabel(String style) {
        for (String[] option : STYLE_OPTIONS) if (option[0].equals(style)) return option[1];
        return "Neon Glass";
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
            values.addAll(Arrays.asList("appIdentity", "target", "progress", "remaining", "studyTime", "streak", "weekly", "quiz", "updateStatus"));
        }
        if (values.isEmpty()) values.add("progress");
        return values;
    }

    private static String selectedRadioValue(List<RadioButton> choices, String fallback) {
        for (RadioButton choice : choices) {
            if (choice.isChecked() && choice.getTag() instanceof String) return (String) choice.getTag();
        }
        return fallback;
    }

    private static LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }
}
