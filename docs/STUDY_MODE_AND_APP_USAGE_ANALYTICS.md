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
When Math Master is not Device Owner/Profile Owner, personal-device Focus Shield
uses a user-approved foreground monitoring source and overlay. The preferred
source is an optional Accessibility Service configured only for window-state change events only. It reads the event package name and event timestamp
only; it does not retrieve window content, view hierarchies, text, passwords,
gestures or key events. The user must explicitly enable this service in Android
Accessibility settings, and can disable it there at any time.

Usage Access remains a compatibility fallback when Accessibility is disabled or
disconnected. It polls Android UsageEvents while the display is interactive; this
fallback can miss or delay foreground changes and is not guaranteed instant.
When neither source is available, Focus Shield is not started and the status is
reported as permission-required. Both personal-device sources only display a
user-approved overlay; neither suspends a package at OS level. The interface
labels this mode as **Shield only**, never **Frozen**.

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
On a normal personal phone, Focus Shield requires either the user-enabled,
package-only Accessibility event source or Usage Access fallback, plus the
existing user-approved overlay. Accessibility notifications are event-driven;
UsageStats fallback polls foreground-app events every 1.6 seconds while the
screen is active. The Accessibility service does not retrieve screen text,
window content, view hierarchies, gestures or passwords. Neither personal-device
source is equivalent to OS package suspension; the selected app may appear
briefly before the overlay is displayed. The managed-device Device Owner/Profile
Owner path remains separate and uses verified `DevicePolicyManager` suspension.

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

## Chart definitions

- **Column:** foreground time per app for the selected range.
- **Pie:** top five app totals plus an Others slice, with percentage labels.
- **Line:** daily foreground time, or daily time for one selected app.
- **Bar:** horizontal ranking of app totals.
- **Area:** filled daily usage trend.
- **Column-Line:** daily usage columns plus a seven-day trailing-average line.

All views use the same native usage snapshot and selected date range.
