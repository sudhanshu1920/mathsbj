# Widget Screen Time

Math Master home-screen widgets offer two independent local usage sections:

- **Study Apps Screen Time** reads the current Study Mode → Study Apps allowlist. It does not read Blocked Apps.
- **Device Apps Screen Time** reads Android's installed-application catalogue visible to Math Master and does not depend on the Study Apps allowlist.

Both use Android `UsageStatsManager.queryUsageStats(INTERVAL_DAILY, ...)` and the per-package `getTotalTimeInForeground()` aggregate. Widget snapshots are stored in the existing AES/GCM-encrypted `AppUsageAnalyticsStore` payload, under a separate `widgetDays` member so they do not change the semantics or totals of the existing App Usage Analytics history. All collection, filtering, icon lookup and rendering remain on-device.

## Usage Access

The manifest declares `android.permission.PACKAGE_USAGE_STATS`; Android still requires the user to enable Math Master under Settings → Special app access → Usage access. The widget checks the Usage Access AppOp before reading usage. Without access it renders **Usage Access Required** and tapping the widget opens Android's Usage Access settings. Returning to Math Master triggers a refresh.

## Period boundaries

All boundaries use the device's current local time zone and `Calendar` day arithmetic:

- Today: local midnight through the current query time.
- Yesterday: previous local midnight through current local midnight.
- Last 7 Days: today plus the six preceding local calendar days.

The worker queries each local day independently, including partial current day, so day boundaries follow daylight-saving transitions. Time/time-zone broadcasts invalidate the inventory freshness and schedule a new query. The widget provider's 30-minute update interval is still controlled by Android and the launcher; app resume and widget render also refresh stale data. There is no always-running service or continuous polling.

## App inventory

Device Apps includes installed user applications and system-image applications with a launcher-visible, user-facing activity. Background-only/core system packages are excluded. `QUERY_ALL_PACKAGES` is declared because a complete device-app inventory is the purpose of this feature; distribution through Google Play requires the corresponding package-visibility declaration/review and an accurate prominent in-app disclosure. Android package visibility, work profiles, OEM restrictions, hidden packages and managed-device policy can still limit what is returned.

Study Apps uses `StudyModeManager.getSelectedStudyAppPackages()` at render time, so it follows the current Study Apps selection and existing Blocked Apps precedence. Optional per-widget app filters are intersected with that source; they cannot add a package outside the Study Apps selection.

## Accuracy and limitations

The displayed values are Android's reported per-package foreground-duration aggregates, not an exact real-time screen-on clock. Android/OEM reporting can lag app transitions. Multi-window and picture-in-picture usage can produce overlapping per-app durations; combined totals sum the per-app aggregates and can therefore exceed wall-clock elapsed time in those cases. The API does not provide a dependable session count, so session counts are omitted. Apps with no recorded usage are not shown in Device Apps; selected Study Apps remain represented with zero time when other selected apps have usage. When no usage exists for the selected period, the widget displays **No screen time recorded yet** rather than fabricated values.

Usage snapshots are queried off the UI thread and refreshed with a five-minute freshness window. App inventory and icons are cached; package add/remove/update events invalidate those caches. Failed queries retain the last encrypted snapshot and expose a compact unavailable/stale state. Android may defer home-screen widget updates while the app is backgrounded.

## Customization and backup

Each widget instance stores its own period, sort order, visible-app limit, total/app-time/percentage visibility, compact mode and optional app filter. Study Apps and Device Apps settings are independent. The settings are included in validated widget backup/restore fields; malformed package filters and unsupported values are rejected.
