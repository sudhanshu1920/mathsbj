# Math Master — Study Mode and App Usage Analytics

## Study Mode enforcement levels

### Fully managed device (Device Owner)

When Android reports Math Master as the Device Owner, the native controller uses
`DevicePolicyManager.setPackagesSuspended()` at scheduled start boundaries.
The returned failure list is not treated as proof of success: every selected
package is checked again with `isPackageSuspended()`. Only packages recorded as
suspended by Math Master are released when selections change, the schedule ends,
or Study Mode is turned off.

Android package suspension prevents activities from starting and hides the
suspended package's notifications. Some critical system packages cannot be
suspended by Android and are reported as failures rather than shown as frozen.

### Managed profile (Profile Owner)

Profile Owner mode applies only to packages in that managed profile. It does not
freeze the same application in the personal profile or on the whole device.
The UI identifies this as managed-profile suspension.

### Normal personal phone

A regular installed app does not automatically have Device Owner authority.
When Math Master is not Device Owner/Profile Owner, Focus Shield uses
**Usage Access + an explicitly approved overlay**. UsageStats foreground events
identify the currently resumed app, and the monitor checks that package against
the Blocked Apps list. This is a foreground-only best-effort shield, not Android
system-level package suspension. It does not independently inspect secondary
split-screen panes or floating-window packages. The interface labels this mode
as **Shield only**, never **Frozen**.

Math Master does not declare or enable an Accessibility Service for Study Mode.
The Android build generator also removes stale Accessibility service declarations
and generated resources from previously configured Android projects. Users with
an older APK may still see the previous service in Android Accessibility Settings;
they should switch off the old Math Master service after installing the updated
build. Usage Access remains the required foreground monitoring source on
unmanaged personal devices.

The current DPC receiver is the policy component used after an authorized
Android/enterprise provisioning flow has already made Math Master the owner.
This app does not silently enroll itself, trigger provisioning, or factory-reset
the device. A full managed-device enrollment flow is not included in this build;
an administrator must use Android's supported managed-device provisioning
process. Enrollment can require a clean device depending on the provisioning
method and Android version.

### Background and Force Stop

Closing the Study Mode screen or removing Math Master from Recents is different
from Android's explicit **Force stop** action. Scheduled boundary alarms and
the boot/time/time-zone receiver reconcile the saved schedule while the package
remains enabled. A successfully suspended target package remains suspended by
Android independently of the Math Master Activity.

### Persistent focus sessions

A focus session is independent of the repeating schedule switch. The native
SQLite database `math_master_study_sessions.db` stores one active session with
a session ID, type, original start timestamp, same-boot monotonic clock anchor,
boot count, finite duration (or zero for unlimited), selected package snapshot,
enforced-session preference, optional DND state and completion status.

The native record is committed **before** the foreground service is started.
Reopening or disposing the Study Mode page only reloads that record and the
native enforcement status; it never sends a stop command. The master switch
shows ON while either the schedule preference is enabled or a focus session is
active. Only an explicit OFF/End Session action or a finite timer completion
ends the session. End Session does not erase the saved schedule configuration.

The timer derives elapsed time from `SystemClock.elapsedRealtime()` while the
device has not rebooted, so wall-clock changes do not reset an in-progress
session. The saved boot count detects a reboot; after reboot, elapsed time is
reconstructed from the persisted wall-clock start timestamp and the session
expiry alarm is recalculated. A manual clock change across a reboot can still
affect this fallback calculation.

The foreground service uses Android's `specialUse` foreground-service type,
an ongoing notification, and `START_STICKY` restoration from the saved session.
Accessibility package events are held only as a bounded, short-lived in-memory
signal to reduce detection latency; they are not written to session history or
uploaded. The popup checks visibility after the initial WindowManager traversal.
On a normal personal phone, Focus Shield requires an enabled foreground
monitoring source and the existing user-approved overlay. Standard uses
Android's UsageStatsManager after Usage Access is granted, polling foreground
events every 1.6 seconds while the screen is active. Advanced can additionally
use its optional Accessibility Service to identify package names and focus
state from accessible interactive app windows; it never traverses view trees
or reads text. The Focus Shield remains best-effort, not guaranteed package
suspension; the selected app can appear briefly before the overlay is shown.
The managed-device Device Owner/Profile Owner path remains separate and uses
verified `DevicePolicyManager` suspension.

Completed sessions are retained in the local SQLite history. The database is
excluded from cloud backup and device-to-device transfer. Optional DND requires
the separate Notification Policy Access grant; the session saves the prior
filter and attempts restoration only if the active filter is still the one the
session applied. Other DND rules or user overrides are not intentionally
disabled.

A boot receiver reconciles saved sessions and schedules, and a session-boundary
alarm handles finite completion. Android and device manufacturers still impose
foreground-service, exact-alarm, battery and background-start restrictions, so
recovery is best effort where the OS does not permit a service start. A normal
app cannot bypass explicit Force Stop.

Android does not permit an ordinary app to bypass Force Stop. After the user
force-stops Math Master, its receivers/alarms cannot be relied on until the user
launches it again. Math Master does not use root, hidden APIs, or mechanisms
intended to evade that rule.

Exact alarms are used when Android grants the capability. When they are not
available, the app uses an inexact fallback and reports that schedule boundaries
may be delayed.

## App Usage Analytics data source

Usage Analytics reads Android `UsageStatsManager.queryUsageStats(INTERVAL_DAILY)`
after the user grants Usage Access. It displays package foreground-time
aggregates returned by Android; it does not synthesize missing values. Android
may expand a query to interval boundaries or return no data when its usage
service is unavailable/locked, so dates without collected records remain empty.

The app encrypts its local daily aggregate payload with AES-GCM using a key held
by Android Keystore. The encrypted payload is stored in Math Master's private
SharedPreferences file `app_usage_analytics_local.xml`. The native analytics
plugin has no network client and does not pass package usage records to the
existing account/cloud features.

Android backup configuration excludes this private usage file from both cloud
backup and device-to-device transfer. Default retention is 90 days; the user can
choose 30, 90, or 180 days. The selected date range cannot exceed the configured
local retention period.

Refreshing Analytics queries Android's current aggregate stats when the page is
opened, refreshed, or resumed. There is no permanent foreground service or
continuous polling just for charts. Clearing Math Master's local cache does not
erase Android's own system UsageStats database; a later refresh may read the
system-provided statistics again.

## Screen Time Island

Screen Time Island is a compact OLED-black overlay owned by the existing
Study Mode Focus Service. It is enabled by default with a five-minute cadence;
the setting accepts one through ten minutes. The interval is independent of
the existing Periodic Reminder interval and is held only in memory. The second
`StudyModeUsageAccumulator` instance samples the same one-second foreground
monitor tick and carries its eligible time globally across non-study apps.
Changing the interval, disabling the island, or ending Study Mode resets this
in-memory interval.

The island is eligible only while `shouldEnforceNow()` is true, the screen is
interactive and unlocked, Usage Access and overlay permission are available,
and the current focused package passes the Periodic Reminder exclusions. In
particular, selected Study Apps, Math Master itself, exempt system surfaces,
shielded apps and Pro Strict Mode are excluded. An active call is also excluded
using the current audio mode. The island never changes Shield enforcement,
Periodic Reminder timing, Pro Strict Mode, session/schedule state or foreground
service policy.

A visible island is removed immediately when the foreground package changes,
the screen turns off/locks, a Shield is requested, Study Mode ends, overlay
permission is lost, or the display configuration changes. The full-screen
Periodic Reminder and Shield always have priority. A due island waits behind a
pending/visible popup for at most ten seconds; after that it is dropped and the
island accumulator resets. The island window is limited to the capsule bounds,
does not take focus, and is made non-touchable during its morph/dismiss
animations. The settled compact/expanded capsule remains touchable to support
tap-to-toggle, swipe-up dismissal and long-press navigation.

### Today's usage calculation

The displayed total is the foreground usage of the current package from local
device midnight through the current time. The service queries Android
`UsageEvents` on the existing monitor HandlerThread, maps activity resume/pause
events (or the older foreground/background event types on pre-29 Android),
and closes all open activities on screen-non-interactive, keyguard-shown and
device-shutdown events. Open sessions are closed at the query time, so the
currently running session is included. Sessions spanning midnight are clipped
to the portion after today's local midnight.

The pure-Java `StudyModeDayUsage` aggregator uses `Calendar` and the device
`TimeZone`, not fixed 24-hour millisecond windows. A local day can therefore
be 23 or 25 hours when daylight-saving rules change. The 24 visual buckets are
wall-clock labels from 12 AM through 11 PM; during a repeated fall-back hour,
both occurrences contribute to the same wall-clock bucket.

If the event stream is empty or unavailable, the service falls back to
`queryUsageStats(INTERVAL_DAILY)` and adds the currently observed live
foreground session. In this fallback only, the live-adjusted aggregate is
placed in the current hour bucket because the daily aggregate does not provide
hour-level event boundaries. If neither source provides a usable value, the
island is skipped silently and a stage-only diagnostic is recorded; package
names and usage totals are not logged.

The daily event result follows the same Android system foreground-time source
used by App Usage Analytics, but includes the currently running session that
`INTERVAL_DAILY` typically does not expose until the app leaves foreground.
Consequently, its total can be higher than the Analytics page while the app is
still open. All event processing, aggregation and caching remain on-device;
no usage events or package usage data are sent over the network.

### Settings and preview

The Study Mode card below Reminder Interval controls the enable switch and
one-to-ten-minute cadence. Its Preview action uses the same overlay renderer
for Math Master itself, requires the existing overlay permission and does not
require Study Mode to be active. Usage Access is needed for real app totals;
without it, a preview uses a zero-value sample. No new Android permission,
service, worker thread, timer or third-party animation library is added.

## Chart definitions

- **Column:** foreground time per app for the selected range.
- **Pie:** top five app totals plus an Others slice, with percentage labels.
- **Line:** daily foreground time, or daily time for one selected app.
- **Bar:** horizontal ranking of app totals.
- **Area:** filled daily usage trend.
- **Column-Line:** daily usage columns plus a seven-day trailing-average line.

All views use the same native usage snapshot and selected date range.
