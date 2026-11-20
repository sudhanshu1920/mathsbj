package com.sudhanshu.mathsbj;
import android.app.Activity;
import android.content.Context;
import java.util.Arrays;
import java.util.List;
public final class StudyModeManager {
    public static List<String> getSelectedStudyAppPackages(Context context) {
        return Arrays.asList("com.fixture.0","com.fixture.1","com.fixture.2");
    }
    public static boolean openStudyAppsSelection(Activity activity) { return true; }
}
