package com.sudhanshu.mathsbj;

import android.content.Context;
import java.util.Collections;
import java.util.List;
import java.util.Set;

public final class WidgetScreenTimeData {
    public static final class Config {
        public String period = "today", sortOrder = "most_used";
        public int maxApps = 5;
        public boolean showTotal = true, showAppUsage = true, showPercent = false, compact = false;
        public String studyFilterJson, deviceFilterJson;
    }
    public static final class AppChoice {
        public final String packageName, label;
        public AppChoice(String packageName, String label) { this.packageName = packageName; this.label = label; }
    }
    static void populate(Context context, MathMasterWidgetRenderer.Data data, int id,
        Set<String> selected, Config config) {}
    static void maybeRefresh(Context context) {}
    static void onAppResumed(Context context) {}
    static void onStudyAppsChanged(Context context) {}
    static void onPackageInventoryChanged(Context context) {}
    static void onTimeZoneOrClockChanged(Context context) {}
    public static List<AppChoice> getAppChoices(Context context, boolean studyOnly) { return Collections.emptyList(); }
}