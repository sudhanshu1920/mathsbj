package com.sudhanshu.mathsbj;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.provider.Settings;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Spinner;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.RadioButton;
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
    private Spinner screenTimePeriodSpinner;
    private Spinner screenTimeSortSpinner;
    private Spinner screenTimeCountSpinner;
    private CheckBox screenTimeShowTotalCheck;
    private CheckBox screenTimeShowUsageCheck;
    private CheckBox screenTimeShowPercentCheck;
    private CheckBox screenTimeDetailedCheck;
    private LinearLayout screenTimeControlRoot;
    private TextView screenTimeTitle;
    private TextView studySourceInfo;
    private TextView deviceSourceInfo;
    private Button openStudyAppsButton;
    private Button usageAccessButton;
    private TextView usageAccessStatus;
    private TextView previewSummary;
    private ImageView previewArtwork;
    private int widgetId = INVALID_WIDGET_ID;
    private boolean usageAccessProxy;
    private boolean usageAccessSettingsLaunched;
    private static final int USAGE_ACCESS_REQUEST_CODE = 7813;
    private int surfaceColor;
    private int cardColor;
    private int textColor;
    private int mutedColor;
    private int borderColor;
    private int accentColor = Color.rgb(101, 88, 217);

    private static final String[][] CONTENT_OPTIONS = {
        {"appIdentity", "App Identity"},
        {"target", "Today's Target"},
        {"progress", "Progress"},
        {"remaining", "Remaining Target"},
        {"studyTime", "Study Time"},
        {"streak", "Streak"},
        {"weekly", "Weekly Target Tracker"},
        {"quiz", "Upcoming Quiz"},
        {"updateStatus", "Update Status"},
        {"studyAppsScreenTime", "Study Apps Screen Time"},
        {"deviceAppsScreenTime", "Device Apps Screen Time"}
    };

    private static final String[][] STYLE_OPTIONS = {
        {"neon", "Neon Glass"},
        {"blur", "Transparent Blur"},
        {"transparent", "Full Transparent"}
    };

    private static final String[][] WIDGET_COMPOSITIONS = MathMasterHomeWidgetProvider.getWidgetCompositionOptions();

    @Override
    protected void onResume() {
        super.onResume();
        if (usageAccessProxy) {
            if (WidgetScreenTimeRepository.hasUsageAccess(this)) {
                MathMasterHomeWidgetProvider.refreshScreenTimeWidgets(this);
                finish();
            } else if (usageAccessSettingsLaunched) {
                showUsageAccessProxyState();
            }
            return;
        }
        if (screenTimeControlRoot != null) {
            WidgetScreenTimeRepository.invalidateCaches();
            updatePreview();
            requestScreenTimePreviewRefresh();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (usageAccessProxy && requestCode == USAGE_ACCESS_REQUEST_CODE) {
            if (WidgetScreenTimeRepository.hasUsageAccess(this)) {
                MathMasterHomeWidgetProvider.refreshScreenTimeWidgets(this);
                finish();
            } else {
                showUsageAccessProxyState();
            }
        }
    }

    private void showUsageAccessProxyState() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(24), dp(24), dp(24), dp(24));
        root.setBackgroundColor(surfaceColor);
        TextView message = new TextView(this);
        message.setText("Usage Access is still disabled. Enable it to show real app screen time.");
        message.setTextColor(textColor);
        message.setTextSize(14);
        message.setGravity(Gravity.CENTER);
        root.addView(message, matchWrap());
        Button retry = actionButton("Open Usage Access Settings", true);
        retry.setOnClickListener(view -> launchUsageAccessSettings());
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(46));
        params.topMargin = dp(16);
        root.addView(retry, params);
        Button close = actionButton("Close", false);
        close.setOnClickListener(view -> finish());
        LinearLayout.LayoutParams closeParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        closeParams.topMargin = dp(8);
        root.addView(close, closeParams);
        setContentView(root);
    }

    private void launchUsageAccessSettings() {
        try {
            usageAccessSettingsLaunched = true;
            startActivityForResult(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS), USAGE_ACCESS_REQUEST_CODE);
        } catch (RuntimeException error) {
            Toast.makeText(this, "Android Usage Access settings could not be opened.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setResult(RESULT_CANCELED);
        if (getIntent().getBooleanExtra("openUsageAccessOnly", false)) {
            usageAccessProxy = true;
            resolvePalette();
            launchUsageAccessSettings();
            return;
        }
        if (getIntent().getBooleanExtra("openStudyAppsPickerOnly", false)) {
            if (!StudyModeManager.openStudyAppsSelection(this)) {
                Toast.makeText(this, "Math Master could not open Study Apps settings.", Toast.LENGTH_LONG).show();
            }
            finish();
            return;
        }
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
        scroll.setPadding(0, 0, 0, dp(4));
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(12), dp(6), dp(12), dp(4));
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
        if ((!savedForThisWidget || savedSchema < 4) && !selected.contains("quiz")) selected.add("quiz");
        addContentGrid(content, selected);
        addScreenTimeControls(content, preferences);

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
        previewCard.setPadding(dp(6), dp(6), dp(6), dp(6));
        FrameLayout previewFrame = new FrameLayout(this);
        previewFrame.setBackground(rounded(Color.rgb(35, 43, 58), dp(14), borderColor));
        previewFrame.setClipToOutline(true);
        previewArtwork = new ImageView(this);
        previewArtwork.setScaleType(ImageView.ScaleType.FIT_CENTER);
        previewArtwork.setAdjustViewBounds(true);
        previewArtwork.setMaxHeight(dp(124));
        previewArtwork.setPadding(dp(4), dp(3), dp(4), dp(3));
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
        actions.setPadding(dp(12), dp(6), dp(12), dp(6));
        actions.setBackground(rounded(cardColor, dp(16), borderColor));
        Button cancel = actionButton("Cancel", false);
        cancel.setOnClickListener(view -> finish());
        Button save = actionButton("Save changes", true);
        save.setOnClickListener(view -> saveConfiguration());
        LinearLayout.LayoutParams cancelParams = new LinearLayout.LayoutParams(0, dp(40), 1f);
        cancelParams.setMarginEnd(dp(8));
        actions.addView(cancel, cancelParams);
        actions.addView(save, new LinearLayout.LayoutParams(0, dp(40), 1.25f));
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
        SharedPreferences preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean dark = !"light".equals(preferences.getString("mode", "dark"));
        surfaceColor = dark ? Color.rgb(17, 20, 29) : Color.rgb(245, 247, 252);
        cardColor = dark ? Color.rgb(28, 33, 46) : Color.WHITE;
        textColor = dark ? Color.rgb(239, 242, 250) : Color.rgb(28, 36, 54);
        mutedColor = dark ? Color.rgb(164, 173, 192) : Color.rgb(101, 112, 133);
        borderColor = dark ? Color.rgb(57, 65, 83) : Color.rgb(224, 229, 239);
        String appAccent = preferences.getString("appAccentColor", null);
        if (appAccent != null && appAccent.matches("^#[0-9a-fA-F]{6}$")) {
            accentColor = Color.parseColor(appAccent);
        }
        TypedValue accent = new TypedValue();
        if ((appAccent == null || !appAccent.matches("^#[0-9a-fA-F]{6}$"))
            && getTheme().resolveAttribute(android.R.attr.colorAccent, accent, true)) {
            accentColor = accent.data;
        }
    }

    private void addHeader(LinearLayout parent) {
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        TextView eyebrow = new TextView(this);
        eyebrow.setText("WIDGET STUDIO  /  CUSTOMIZE");
        eyebrow.setTextColor(accentColor);
        eyebrow.setTextSize(10);
        eyebrow.setLetterSpacing(0.08f);
        TextView title = new TextView(this);
        title.setText("Customize Your Widget");
        title.setTextColor(textColor);
        title.setTextSize(18);
        title.setTypeface(null, 1);
        TextView subtitle = new TextView(this);
        subtitle.setText("Widget #" + widgetId + " · settings saved to this instance");
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
        int contentOptionCount = CONTENT_OPTIONS.length;
        for (int i = 0; i < contentOptionCount; i++) {
            if (i % columns == 0) {
                row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                parent.addView(row, sectionParams());
            }
            String[] option = CONTENT_OPTIONS[i];
            String optionId = option[0];
            CheckBox check = new CheckBox(this);
            check.setText(option[1]);
            check.setTextColor(textColor);
            check.setTextSize(10);
            check.setMinHeight(dp(34));
            check.setButtonTintList(android.content.res.ColorStateList.valueOf(accentColor));
            check.setPadding(dp(5), dp(1), dp(5), dp(1));
            check.setBackground(rounded(selected.contains(optionId) ? selectedSurface() : cardColor,
                dp(10), selected.contains(optionId) ? accentColor : borderColor));
            check.setChecked(selected.contains(optionId));
            contentChecks.put(optionId, check);
            check.setOnCheckedChangeListener((button, checked) -> {
                check.setBackground(rounded(checked ? selectedSurface() : cardColor, dp(10),
                    checked ? accentColor : borderColor));
                updatePreview();
                if ("studyAppsScreenTime".equals(optionId) || "deviceAppsScreenTime".equals(optionId)) {
                    requestScreenTimePreviewRefresh();
                }
            });
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(36), 1f);
            params.setMargins(dp(2), dp(2), dp(2), dp(2));
            row.addView(check, params);
        }
        int remainder = contentOptionCount % columns;
        if (remainder != 0 && row != null) {
            for (int i = remainder; i < columns; i++) row.addView(new View(this),
                new LinearLayout.LayoutParams(0, dp(36), 1f));
        }
    }

    private void addScreenTimeControls(LinearLayout parent, SharedPreferences preferences) {
        screenTimeControlRoot = cardContainer();
        screenTimeControlRoot.setPadding(dp(8), dp(5), dp(8), dp(5));
        screenTimeControlRoot.setVisibility(View.GONE);

        screenTimeTitle = new TextView(this);
        screenTimeTitle.setText("SCREEN TIME SETTINGS");
        screenTimeTitle.setTextColor(accentColor);
        screenTimeTitle.setTextSize(10);
        screenTimeTitle.setTypeface(null, 1);
        screenTimeTitle.setLetterSpacing(0.05f);
        screenTimeControlRoot.addView(screenTimeTitle, matchWrap());

        studySourceInfo = sourceInfoText();
        deviceSourceInfo = sourceInfoText();
        screenTimeControlRoot.addView(studySourceInfo, matchWrap());
        screenTimeControlRoot.addView(deviceSourceInfo, matchWrap());

        openStudyAppsButton = actionButton("Select Study Apps", false);
        openStudyAppsButton.setMinHeight(dp(30));
        openStudyAppsButton.setTextSize(10);
        openStudyAppsButton.setOnClickListener(view -> {
            if (!StudyModeManager.openStudyAppsSelection(this)) {
                Toast.makeText(this, "Study Apps settings could not be opened.", Toast.LENGTH_LONG).show();
            }
        });
        LinearLayout.LayoutParams studyAppsActionParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(30));
        studyAppsActionParams.topMargin = dp(3);
        screenTimeControlRoot.addView(openStudyAppsButton, studyAppsActionParams);

        MathMasterHomeWidgetProvider.ScreenTimeConfig saved =
            MathMasterHomeWidgetProvider.readScreenTimeConfig(preferences, widgetId);
        LinearLayout periodSortRow = new LinearLayout(this);
        periodSortRow.setOrientation(LinearLayout.HORIZONTAL);
        screenTimeControlRoot.addView(periodSortRow, matchWrap());
        screenTimePeriodSpinner = addSpinnerRow(periodSortRow, "Period",
            new String[] {"Today", "Yesterday", "Last 7 Days"},
            "yesterday".equals(saved.period) ? 1 : ("last_7_days".equals(saved.period) ? 2 : 0));
        screenTimeSortSpinner = addSpinnerRow(periodSortRow, "Sort",
            new String[] {"Most Used First", "Least Used First", "Name A–Z", "Name Z–A"},
            "least_used".equals(saved.sort) ? 1 : ("name_asc".equals(saved.sort) ? 2 : ("name_desc".equals(saved.sort) ? 3 : 0)));
        screenTimeCountSpinner = addSpinnerRow(screenTimeControlRoot, "Apps to display",
            new String[] {"3 apps", "5 apps", "8 apps", "12 apps"},
            saved.maxEntries <= 3 ? 0 : (saved.maxEntries <= 5 ? 1 : (saved.maxEntries <= 8 ? 2 : 3)));

        LinearLayout flagsFirstRow = new LinearLayout(this);
        flagsFirstRow.setOrientation(LinearLayout.HORIZONTAL);
        screenTimeShowTotalCheck = compactCheck("Show total", saved.showTotal);
        screenTimeShowUsageCheck = compactCheck("Show app time", saved.showUsage);
        flagsFirstRow.addView(screenTimeShowTotalCheck, new LinearLayout.LayoutParams(0, dp(30), 1f));
        flagsFirstRow.addView(screenTimeShowUsageCheck, new LinearLayout.LayoutParams(0, dp(30), 1f));
        screenTimeControlRoot.addView(flagsFirstRow, matchWrap());

        LinearLayout flagsSecondRow = new LinearLayout(this);
        flagsSecondRow.setOrientation(LinearLayout.HORIZONTAL);
        screenTimeShowPercentCheck = compactCheck("Usage bars", saved.showPercent);
        screenTimeDetailedCheck = compactCheck("Detailed rows", saved.detailed);
        flagsSecondRow.addView(screenTimeShowPercentCheck, new LinearLayout.LayoutParams(0, dp(30), 1f));
        flagsSecondRow.addView(screenTimeDetailedCheck, new LinearLayout.LayoutParams(0, dp(30), 1f));
        screenTimeControlRoot.addView(flagsSecondRow, matchWrap());

        usageAccessStatus = sourceInfoText();
        screenTimeControlRoot.addView(usageAccessStatus, matchWrap());
        usageAccessButton = actionButton("Open Usage Access Settings", false);
        usageAccessButton.setMinHeight(dp(30));
        usageAccessButton.setTextSize(10);
        usageAccessButton.setOnClickListener(view -> {
            try {
                startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));
            } catch (RuntimeException error) {
                Toast.makeText(this, "Android Usage Access settings could not be opened.", Toast.LENGTH_LONG).show();
            }
        });
        screenTimeControlRoot.addView(usageAccessButton, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(30)));

        parent.addView(screenTimeControlRoot, sectionParams());
        updateScreenTimeSourceInfo();
        updateUsageAccessLabel();

        screenTimePeriodSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                updatePreview();
                requestScreenTimePreviewRefresh();
            }
            @Override public void onNothingSelected(AdapterView<?> parent) {}
        });
        screenTimeSortSpinner.setOnItemSelectedListener(simpleSelectionListener());
        screenTimeCountSpinner.setOnItemSelectedListener(simpleSelectionListener());
        screenTimeShowTotalCheck.setOnCheckedChangeListener((button, checked) -> updatePreview());
        screenTimeShowUsageCheck.setOnCheckedChangeListener((button, checked) -> updatePreview());
        screenTimeShowPercentCheck.setOnCheckedChangeListener((button, checked) -> updatePreview());
        screenTimeDetailedCheck.setOnCheckedChangeListener((button, checked) -> updatePreview());
    }

    private TextView sourceInfoText() {
        TextView text = new TextView(this);
        text.setTextColor(mutedColor);
        text.setTextSize(10);
        text.setPadding(dp(2), dp(3), dp(2), dp(3));
        return text;
    }

    private AdapterView.OnItemSelectedListener simpleSelectionListener() {
        return new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                updatePreview();
            }
            @Override public void onNothingSelected(AdapterView<?> parent) {}
        };
    }

    private Spinner addSpinnerRow(LinearLayout parent, String label, String[] options, int selected) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(3), 0, dp(3), 0);
        TextView title = new TextView(this);
        title.setText(label);
        title.setTextColor(mutedColor);
        title.setTextSize(10);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, dp(32), 0.82f);
        row.addView(title, titleParams);
        Spinner spinner = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, options);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinner.setAdapter(adapter);
        spinner.setSelection(Math.max(0, Math.min(options.length - 1, selected)));
        spinner.setPadding(dp(4), 0, dp(4), 0);
        row.addView(spinner, new LinearLayout.LayoutParams(0, dp(32), 1.18f));
        LinearLayout.LayoutParams rowParams = parent.getOrientation() == LinearLayout.HORIZONTAL
            ? new LinearLayout.LayoutParams(0, dp(34), 1f)
            : new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(34));
        if (parent.getOrientation() == LinearLayout.HORIZONTAL) {
            rowParams.setMargins(dp(2), dp(2), dp(2), dp(2));
        }
        parent.addView(row, rowParams);
        return spinner;
    }

    private CheckBox compactCheck(String label, boolean checked) {
        CheckBox check = new CheckBox(this);
        check.setText(label);
        check.setTextColor(textColor);
        check.setTextSize(10);
        check.setButtonTintList(android.content.res.ColorStateList.valueOf(accentColor));
        check.setMinHeight(dp(30));
        check.setTextSize(10);
        check.setChecked(checked);
        return check;
    }

    private MathMasterHomeWidgetProvider.ScreenTimeConfig buildScreenTimeConfig() {
        MathMasterHomeWidgetProvider.ScreenTimeConfig config =
            MathMasterHomeWidgetProvider.readScreenTimeConfig(
                getSharedPreferences(PREFS, Context.MODE_PRIVATE), widgetId);
        int period = screenTimePeriodSpinner == null ? 0 : screenTimePeriodSpinner.getSelectedItemPosition();
        config.period = period == 1 ? "yesterday" : (period == 2 ? "last_7_days" : "today");
        int sort = screenTimeSortSpinner == null ? 0 : screenTimeSortSpinner.getSelectedItemPosition();
        config.sort = sort == 1 ? "least_used" : (sort == 2 ? "name_asc" : (sort == 3 ? "name_desc" : "most_used"));
        int count = screenTimeCountSpinner == null ? 1 : screenTimeCountSpinner.getSelectedItemPosition();
        config.maxEntries = count == 0 ? 3 : (count == 2 ? 8 : (count == 3 ? 12 : 5));
        config.showTotal = screenTimeShowTotalCheck == null || screenTimeShowTotalCheck.isChecked();
        config.showUsage = screenTimeShowUsageCheck == null || screenTimeShowUsageCheck.isChecked();
        config.showPercent = screenTimeShowPercentCheck != null && screenTimeShowPercentCheck.isChecked();
        config.detailed = screenTimeDetailedCheck == null || screenTimeDetailedCheck.isChecked();
        return config;
    }

    private void requestScreenTimePreviewRefresh() {
        if (screenTimeControlRoot == null || screenTimeControlRoot.getVisibility() != View.VISIBLE) return;
        MathMasterHomeWidgetProvider.ScreenTimeConfig config = buildScreenTimeConfig();
        WidgetScreenTimeRepository.requestRefresh(this, config.period, () -> {
            if (!isFinishing()) {
                updateUsageAccessLabel();
                updatePreview();
            }
        });
    }

    private void updateUsageAccessLabel() {
        if (usageAccessStatus == null) return;
        boolean granted = WidgetScreenTimeRepository.hasUsageAccess(this);
        usageAccessStatus.setText(granted
            ? "Usage Access enabled · real foreground time stays on this device"
            : "Usage Access required · no sample or estimated usage will be shown");
        if (usageAccessButton != null) usageAccessButton.setVisibility(granted ? View.GONE : View.VISIBLE);
    }

    private void updateScreenTimeSourceInfo() {
        if (studySourceInfo == null || deviceSourceInfo == null || contentChecks.isEmpty()) return;
        CheckBox studyContent = contentChecks.get("studyAppsScreenTime");
        CheckBox deviceContent = contentChecks.get("deviceAppsScreenTime");
        boolean studyEnabled = studyContent != null && studyContent.isChecked();
        boolean deviceEnabled = deviceContent != null && deviceContent.isChecked();
        int selectedStudyCount = studyEnabled
            ? StudyModeManager.getSelectedStudyAppPackages(this).size() : 0;

        if (studyEnabled) {
            studySourceInfo.setVisibility(View.VISIBLE);
            studySourceInfo.setText(selectedStudyCount == 0
                ? "No Study Apps Selected · Select apps in Study Mode to display their screen time."
                : "Source: Study Mode → Study Apps · " + selectedStudyCount + " selected");
            if (openStudyAppsButton != null) {
                openStudyAppsButton.setVisibility(selectedStudyCount == 0 ? View.VISIBLE : View.GONE);
            }
        } else {
            studySourceInfo.setVisibility(View.GONE);
            if (openStudyAppsButton != null) openStudyAppsButton.setVisibility(View.GONE);
        }

        if (deviceEnabled) {
            deviceSourceInfo.setVisibility(View.VISIBLE);
            deviceSourceInfo.setText("Source: Device App Usage · automatically ranked by foreground time");
        } else {
            deviceSourceInfo.setVisibility(View.GONE);
        }
    }

    private void addStyleGrid(LinearLayout parent, String selectedStyle) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        parent.addView(row, sectionParams());
        for (String[] option : STYLE_OPTIONS) {
            LinearLayout tile = cardContainer();
            tile.setGravity(Gravity.CENTER);
            tile.setPadding(dp(4), dp(4), dp(4), dp(3));
            View swatch = new View(this);
            int swatchColor = "neon".equals(option[0]) ? Color.rgb(83, 75, 170)
                : ("blur".equals(option[0]) ? Color.rgb(102, 119, 142) : Color.TRANSPARENT);
            swatch.setBackground(rounded(swatchColor, dp(8), accentColor));
            tile.addView(swatch, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(20)));
            RadioButton choice = compactRadio(option[1], option[0], selectedStyle);
            styleChoices.add(choice);
            tile.addView(choice, matchWrap());
            tile.setOnClickListener(view -> selectChoice(styleChoices, choice));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(60), 1f);
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
            thumbnail.setMaxHeight(dp(32));
            thumbnail.setContentDescription(option[1] + " actual widget preview");
            Bitmap bitmap = renderDesignThumbnail(option[0]);
            if (bitmap != null) thumbnail.setImageBitmap(bitmap);
            tile.addView(thumbnail, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(32)));
            RadioButton choice = compactRadio(option[1], option[0], selectedComposition);
            compositionChoices.add(choice);
            tile.addView(choice, matchWrap());
            tile.setOnClickListener(view -> selectChoice(compositionChoices, choice));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(78), 1f);
            params.setMargins(dp(2), dp(2), dp(2), dp(2));
            row.addView(tile, params);
        }
        int remainder = WIDGET_COMPOSITIONS.length % columns;
        if (remainder != 0 && row != null) {
            for (int i = remainder; i < columns; i++) row.addView(new View(this),
                new LinearLayout.LayoutParams(0, dp(78), 1f));
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
        boolean dark = !"light".equals(
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("mode", "dark"));
        return dark ? Color.rgb(49, 43, 83) : Color.rgb(239, 237, 255);
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
        params.topMargin = dp(4);
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
        boolean studyTimeSelected = selected.contains("studyAppsScreenTime");
        boolean deviceTimeSelected = selected.contains("deviceAppsScreenTime");
        if (screenTimeControlRoot != null) {
            screenTimeControlRoot.setVisibility(studyTimeSelected || deviceTimeSelected ? View.VISIBLE : View.GONE);
            updateScreenTimeSourceInfo();
        }
        updateUsageAccessLabel();
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
                this, composition, style, selected, size[0], size[1], buildScreenTimeConfig());
            previewArtwork.setImageBitmap(preview);
            previewArtwork.setVisibility(preview == null ? View.GONE : View.VISIBLE);
        } catch (RuntimeException | OutOfMemoryError ignored) {
            previewArtwork.setImageDrawable(null);
            previewArtwork.setVisibility(View.GONE);
        }
        String summary = compositionLabel(composition) + "  ·  " + styleLabel(style)
            + "  ·  " + selected.size() + " fields";
        if (studyTimeSelected || deviceTimeSelected) summary += "  ·  real Android UsageStats";
        previewSummary.setText(summary);
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

        MathMasterHomeWidgetProvider.ScreenTimeConfig screenTime = buildScreenTimeConfig();
        String[] screenTimeKeys = {
            "screenTimePeriod", "screenTimeSort", "screenTimeMaxEntries", "screenTimeShowTotal",
            "screenTimeShowUsage", "screenTimeShowPercent", "screenTimeDetailed"
        };
        String[] legacyScreenTimeKeys = {
            "screenTimeHiddenStudyPackages", "screenTimeHiddenDevicePackages"
        };
        boolean saved = preferences.edit()
            .putString(contentKey, selected.toString())
            .putInt(schemaKey, 4)
            .putString(styleKey, style)
            .putString(compositionKey, composition)
            .putString(prefix + "screenTimePeriod", screenTime.period)
            .putString(prefix + "screenTimeSort", screenTime.sort)
            .putInt(prefix + "screenTimeMaxEntries", screenTime.maxEntries)
            .putBoolean(prefix + "screenTimeShowTotal", screenTime.showTotal)
            .putBoolean(prefix + "screenTimeShowUsage", screenTime.showUsage)
            .putBoolean(prefix + "screenTimeShowPercent", screenTime.showPercent)
            .putBoolean(prefix + "screenTimeDetailed", screenTime.detailed)
            // Preserve per-instance hidden-package JSON for backward-compatible restores.
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
            for (String key : screenTimeKeys) {
                String fullKey = prefix + key;
                restoreValue(rollback, fullKey, previousValues.containsKey(fullKey), previousValues.get(fullKey));
            }
            for (String key : legacyScreenTimeKeys) {
                String fullKey = prefix + key;
                restoreValue(rollback, fullKey, previousValues.containsKey(fullKey), previousValues.get(fullKey));
            }
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
