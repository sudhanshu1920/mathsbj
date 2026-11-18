# Widget screen-time data

Math Master home-screen widgets can show two separate usage views:

- **Study Apps Screen Time** reads the current package allowlist from Study Mode → Study Apps. It never reads the Blocked Apps list.
- **Device Apps Screen Time** reads eligible installed user applications independently of the Study Apps allowlist.

Both views use Android `UsageStatsManager.queryUsageStats(INTERVAL_DAILY, ...)` and `UsageStats.getTotalTimeInForeground()`. They show app-specific foreground duration, not a guaranteed real-time screen-on clock or a count of app sessions.

## Permission

Android does not grant Usage Access automatically. The user must enable Math Master under Android Settings → Special app access → Usage access. Until Android confirms that AppOp is allowed, the widget renders **Usage Access Required** and does not substitute sample or estimated values. Tapping the widget opens the Usage Access settings page; returning to Math Master triggers a refresh.

## Period boundaries

The native collector uses the device's current local time zone and `Calendar` day boundaries:

- Today: local midnight to the current query time.
- Yesterday: the previous local midnight to the current local midnight.
- Last 7 Days: the current local calendar day and the six preceding local calendar days.

Each calendar day is queried separately. This preserves local-day boundaries through daylight-saving changes. A time-zone or wall-clock change invalidates the widget snapshot before recollection. The Android widget refresh cadence remains subject to the launcher/OS update schedule; Math Master also refreshes on app resume and package inventory changes. It does not run an always-on polling service.

## Inventory and Android reporting limitations

Device Apps uses the package catalogue visible to the application. It includes installed user applications and system-image applications that expose a launcher-visible, user-facing activity; background-only/core system packages without such an entry are excluded. This retains visible preinstalled apps while avoiding a list of technical services. Android package-visibility rules, work-profile separation, OEM restrictions, and packages removed or hidden by the operating system can still affect what the app catalogue exposes.

Foreground duration is Android's per-package UsageStats aggregate. It is not a reliable per-window/session count. Multi-window or picture-in-picture usage can cause per-app durations to overlap; the displayed combined total is the sum of the selected apps' reported foreground durations and can therefore exceed elapsed wall-clock time in those cases. Android/OEM reporting may also lag actual app transitions. The widget does not claim exact foreground timing or real-time precision.

Apps with no positive UsageStats duration are not listed in Device Apps for that period. Study Apps retains selected apps with zero-duration entries when at least one selected app has usage; if no selected app has usage, the widget shows the no-usage state. Session counts are deliberately omitted because the supported aggregate API does not provide a dependable session metric.

## Privacy and storage

Usage collection and rendering stay on-device. The widget snapshot is stored inside the existing AES/GCM-encrypted app-usage preferences payload. No usage history is uploaded for widget rendering. Per-widget app filters and layout settings remain in the existing widget preferences and backup/restore validation path.

## Refresh and freshness

The collector runs off the UI thread, coalesces concurrent requests, and reuses a five-minute local snapshot. It refreshes on widget render when stale, app resume after returning from Usage Access settings, Study Apps changes, installed-package changes, boot/app replacement, and time-zone/clock changes. Android may defer launcher widget updates while the app is backgrounded. A stale timestamp is shown when a cached snapshot is older than the collection freshness window.
