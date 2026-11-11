package com.sudhanshu.mathsbj;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.os.SystemClock;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Durable native focus-session state. The session row is committed before any
 * foreground service is started, so Activity/WebView lifetime is irrelevant.
 */
public final class StudyModeSessionStore extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "math_master_study_sessions.db";
    private static final int DATABASE_VERSION = 1;
    private static final String TABLE = "focus_sessions";
    private static final String ACTIVE = "active";

    public StudyModeSessionStore(Context context) {
        super(context.getApplicationContext(), DATABASE_NAME, null, DATABASE_VERSION);
        setWriteAheadLoggingEnabled(true);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE " + TABLE + " ("
            + "id TEXT PRIMARY KEY NOT NULL,"
            + "session_type TEXT NOT NULL,"
            + "start_time_ms INTEGER NOT NULL,"
            + "start_elapsed_ms INTEGER NOT NULL,"
            + "boot_count INTEGER NOT NULL,"
            + "duration_seconds INTEGER NOT NULL,"
            + "selected_apps TEXT NOT NULL,"
            + "enforced INTEGER NOT NULL DEFAULT 0,"
            + "should_enable_dnd INTEGER NOT NULL DEFAULT 0,"
            + "original_dnd_filter INTEGER NOT NULL DEFAULT -1,"
            + "dnd_applied INTEGER NOT NULL DEFAULT 0,"
            + "end_time_ms INTEGER NOT NULL DEFAULT 0,"
            + "elapsed_seconds INTEGER NOT NULL DEFAULT 0,"
            + "status TEXT NOT NULL"
            + ")");
        db.execSQL("CREATE INDEX idx_focus_sessions_status_start ON " + TABLE + "(status, start_time_ms)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Schema migrations are added here without deleting existing session history.
    }

    public synchronized Session getActiveSession(Context context) {
        SQLiteDatabase db = getReadableDatabase();
        try (Cursor cursor = db.query(TABLE, null, "status=?", new String[]{ACTIVE}, null, null,
            "start_time_ms DESC", "1")) {
            return cursor.moveToFirst() ? readSession(context, cursor) : null;
        }
    }

    public synchronized Session startSession(
        Context context,
        String sessionType,
        int durationSeconds,
        List<String> selectedPackages,
        boolean enforced,
        boolean shouldEnableDnd
    ) {
        Session current = getActiveSession(context);
        if (current != null) return current;

        String id = UUID.randomUUID().toString();
        long now = System.currentTimeMillis();
        long elapsed = SystemClock.elapsedRealtime();
        int bootCount = getBootCount(context);
        ContentValues values = new ContentValues();
        values.put("id", id);
        values.put("session_type", normalizeSessionType(sessionType));
        values.put("start_time_ms", now);
        values.put("start_elapsed_ms", elapsed);
        values.put("boot_count", bootCount);
        values.put("duration_seconds", Math.max(0, durationSeconds));
        values.put("end_time_ms", durationSeconds > 0
            ? now + (long) durationSeconds * 1000L : 0L);
        values.put("selected_apps", toJson(selectedPackages));
        values.put("enforced", enforced ? 1 : 0);
        values.put("should_enable_dnd", shouldEnableDnd ? 1 : 0);
        values.put("status", ACTIVE);

        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            // Serialize starts: only one active session can be committed.
            try (Cursor cursor = db.query(TABLE, new String[]{"id"}, "status=?",
                new String[]{ACTIVE}, null, null, "start_time_ms DESC", "1")) {
                if (cursor.moveToFirst()) {
                    db.setTransactionSuccessful();
                    return getActiveSession(context);
                }
            }
            db.insertOrThrow(TABLE, null, values);
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        return getActiveSession(context);
    }

    public synchronized boolean updateActivePackages(String sessionId, List<String> packages) {
        ContentValues values = new ContentValues();
        values.put("selected_apps", toJson(packages));
        return getWritableDatabase().update(TABLE, values, "id=? AND status=?",
            new String[]{sessionId, ACTIVE}) == 1;
    }

    public synchronized boolean saveDndState(String sessionId, int originalFilter, boolean applied) {
        ContentValues values = new ContentValues();
        values.put("original_dnd_filter", originalFilter);
        values.put("dnd_applied", applied ? 1 : 0);
        return getWritableDatabase().update(TABLE, values, "id=? AND status=?",
            new String[]{sessionId, ACTIVE}) == 1;
    }

    public synchronized boolean finishSession(Context context, String sessionId, String completionStatus) {
        Session active = getActiveSession(context);
        if (active == null || sessionId == null || !sessionId.equals(active.id)) return false;

        ContentValues values = new ContentValues();
        values.put("status", "completed".equals(completionStatus) ? "completed" : "ended");
        values.put("end_time_ms", System.currentTimeMillis());
        values.put("elapsed_seconds", getElapsedSeconds(context, active));
        return getWritableDatabase().update(TABLE, values, "id=? AND status=?",
            new String[]{sessionId, ACTIVE}) == 1;
    }

    public synchronized boolean finishIfExpired(Context context) {
        Session active = getActiveSession(context);
        if (active == null || active.durationSeconds <= 0) return false;
        long elapsed = getElapsedSeconds(context, active);
        if (elapsed < active.durationSeconds) return false;

        ContentValues values = new ContentValues();
        values.put("status", "completed");
        values.put("end_time_ms", System.currentTimeMillis());
        values.put("elapsed_seconds", active.durationSeconds);
        return getWritableDatabase().update(TABLE, values, "id=? AND status=?",
            new String[]{active.id, ACTIVE}) == 1;
    }

    public synchronized List<JSObject> getHistory(int limit) {
        int safeLimit = Math.max(1, Math.min(50, limit));
        List<JSObject> result = new ArrayList<>();
        try (Cursor cursor = getReadableDatabase().query(TABLE, null, "status<>?",
            new String[]{ACTIVE}, null, null, "start_time_ms DESC", String.valueOf(safeLimit))) {
            while (cursor.moveToNext()) {
                Session session = readSession(null, cursor);
                result.add(toJson(session, session.elapsedSeconds, 0));
            }
        }
        return result;
    }

    public synchronized void clearHistory() {
        getWritableDatabase().delete(TABLE, "status<>?", new String[]{ACTIVE});
    }

    private Session readSession(Context context, Cursor cursor) {
        Session session = new Session();
        session.id = cursor.getString(cursor.getColumnIndexOrThrow("id"));
        session.type = cursor.getString(cursor.getColumnIndexOrThrow("session_type"));
        session.startTimeMs = cursor.getLong(cursor.getColumnIndexOrThrow("start_time_ms"));
        session.startElapsedMs = cursor.getLong(cursor.getColumnIndexOrThrow("start_elapsed_ms"));
        session.bootCount = cursor.getInt(cursor.getColumnIndexOrThrow("boot_count"));
        session.durationSeconds = cursor.getInt(cursor.getColumnIndexOrThrow("duration_seconds"));
        session.selectedPackages = parseJson(cursor.getString(cursor.getColumnIndexOrThrow("selected_apps")));
        session.enforced = cursor.getInt(cursor.getColumnIndexOrThrow("enforced")) == 1;
        session.shouldEnableDnd = cursor.getInt(cursor.getColumnIndexOrThrow("should_enable_dnd")) == 1;
        session.originalDndFilter = cursor.getInt(cursor.getColumnIndexOrThrow("original_dnd_filter"));
        session.dndApplied = cursor.getInt(cursor.getColumnIndexOrThrow("dnd_applied")) == 1;
        session.endTimeMs = cursor.getLong(cursor.getColumnIndexOrThrow("end_time_ms"));
        session.elapsedSeconds = cursor.getLong(cursor.getColumnIndexOrThrow("elapsed_seconds"));
        session.status = cursor.getString(cursor.getColumnIndexOrThrow("status"));
        if (context != null && ACTIVE.equals(session.status)) {
            session.elapsedSeconds = getElapsedSeconds(context, session);
        }
        return session;
    }

    private long getElapsedSeconds(Context context, Session session) {
        long nowElapsed = SystemClock.elapsedRealtime();
        int currentBootCount = context == null ? -1 : getBootCount(context);
        long millis;
        if (session.bootCount >= 0 && currentBootCount >= 0 && currentBootCount == session.bootCount
            && nowElapsed >= session.startElapsedMs) {
            millis = nowElapsed - session.startElapsedMs;
        } else if (session.endTimeMs > 0L && session.durationSeconds > 0) {
            // Across reboot the monotonic clock resets. Use the persisted absolute
            // expiry boundary, then derive elapsed time from the original duration.
            long remainingMillis = Math.max(0L, session.endTimeMs - System.currentTimeMillis());
            millis = Math.max(0L, (long) session.durationSeconds * 1000L - remainingMillis);
        } else {
            millis = Math.max(0L, System.currentTimeMillis() - session.startTimeMs);
        }
        return Math.max(0L, millis / 1000L);
    }

    private int getBootCount(Context context) {
        try {
            return Settings.Global.getInt(context.getContentResolver(), Settings.Global.BOOT_COUNT, -1);
        } catch (Exception ignored) {
            return -1;
        }
    }

    private String normalizeSessionType(String value) {
        if ("practice".equals(value) || "work".equals(value) || "custom".equals(value)) return value;
        return "study";
    }

    private String toJson(List<String> values) {
        JSONArray array = new JSONArray();
        if (values != null) {
            for (String value : values) if (value != null && !value.isEmpty()) array.put(value);
        }
        return array.toString();
    }

    private List<String> parseJson(String value) {
        if (value == null) return Collections.emptyList();
        List<String> result = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(value);
            for (int i = 0; i < array.length(); i++) {
                String app = array.optString(i, "");
                if (!app.isEmpty() && !result.contains(app)) result.add(app);
            }
        } catch (JSONException ignored) {
            return Collections.emptyList();
        }
        return result;
    }

    private JSObject toJson(Session session, long elapsedSeconds, long remainingSeconds) {
        JSObject result = new JSObject();
        result.put("id", session.id);
        result.put("sessionType", session.type);
        result.put("startTimestamp", session.startTimeMs);
        result.put("durationSeconds", session.durationSeconds);
        result.put("elapsedSeconds", elapsedSeconds);
        result.put("remainingSeconds", remainingSeconds);
        JSArray selectedPackages = new JSArray();
        for (String packageName : session.selectedPackages) selectedPackages.put(packageName);
        result.put("selectedPackageNames", selectedPackages);
        result.put("isEnforced", session.enforced);
        result.put("shouldEnableDnd", session.shouldEnableDnd);
        result.put("dndApplied", session.dndApplied);
        result.put("status", session.status);
        result.put("active", ACTIVE.equals(session.status));
        result.put("endTimestamp", session.endTimeMs);
        return result;
    }

    public synchronized JSObject getActiveSessionJson(Context context) {
        Session session = getActiveSession(context);
        if (session == null) return null;
        long elapsed = getElapsedSeconds(context, session);
        long remaining = session.durationSeconds > 0 ? Math.max(0L, session.durationSeconds - elapsed) : 0L;
        return toJson(session, elapsed, remaining);
    }

    public static final class Session {
        public String id;
        public String type;
        public long startTimeMs;
        public long startElapsedMs;
        public int bootCount;
        public int durationSeconds;
        public List<String> selectedPackages = Collections.emptyList();
        public boolean enforced;
        public boolean shouldEnableDnd;
        public int originalDndFilter = -1;
        public boolean dndApplied;
        public long endTimeMs;
        public long elapsedSeconds;
        public String status;
    }
}
