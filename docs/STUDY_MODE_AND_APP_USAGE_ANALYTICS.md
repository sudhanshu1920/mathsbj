# Math Master — Study Mode and App Usage Analytics

## Study Mode on ordinary Android phones

Study Mode is designed for a personal Android phone without root, factory reset,
Device Owner, Profile Owner, or enterprise enrollment. It uses only user-granted
Accessibility, Usage Access, and display-over-other-apps access.

### What the blocking layer actually does

When the user enables the optional Accessibility service, Math Master listens
for window transition events and reads only the event's foreground package
name. It does not retrieve screen text, window contents, view hierarchies,
passwords, perform gestures, or simulate hidden taps.

The event is checked against a cached snapshot of the active schedule/session
and selected package names. A selected app causes the existing Focus Shield
overlay to cover the screen. The overlay takes focus and blocks ordinary touch
interaction while it is visible. Its **Back to Math Master** action removes only
the overlay and opens Math Master; it does not end the session, clear the
selection, reset the timer, or stop the foreground service.

When Accessibility is unavailable, UsageStatsManager event history is used as
a fallback after the user grants Usage Access. The fallback checks the active
screen at a 1.6-second interval while the screen is interactive. It is less
immediate than Accessibility and may briefly show the selected app before the
overlay appears.

This is a best-effort restriction, not Android package suspension. A selected
app can appear briefly before the shield, can continue background work, and
may behave differently across Android versions and manufacturers. The overlay
does not universally disable that app's notifications, background execution,
picture-in-picture, or external intents. Math Master does not claim that every
launch is prevented or that Focus Shield is equivalent to system-level
freezing.

### App discovery and package visibility

The private sideload build queries the installed-app inventory and filters it
to enabled applications with launcher, leanback-launcher, or app-info entry
points. Package names are de-duplicated, Math Master and critical phone/system
roles are protected, and unavailable or uninstalled selections are removed
when the saved configuration is reconciled.

Full installed-app inventory access on Android 11+ requires the broad
`QUERY_ALL_PACKAGES` permission. This is included for the app's core
user-selected app-restriction feature in private sideload builds; a Google Play
release requires a separate eligibility and policy review before distribution.
Work-profile package visibility is controlled by Android and is not guaranteed
from the personal profile. Apps without a discoverable launchable/info activity
are not selectable in this picker.

### Persistent state, navigation, and timer

A focus session is independent of the repeating schedule switch. The native
SQLite database `math_master_study_sessions.db` stores one active session
with a session ID, type, original start timestamp, same-boot monotonic clock
anchor, boot count, finite duration (or zero for unlimited), selected package
snapshot, end-confirmation preference, optional DND state, and completion
status.

The native record is committed **before** the foreground service is started.
Reopening or disposing the Study Mode page only reloads the saved record and
actual native enforcement status; it never sends a stop command. The master
switch shows ON while either the schedule preference is enabled or a focus
session is active. Only an explicit user OFF/End Session action or a finite
timer completion ends the session. End Session does not erase the saved
schedule configuration.

The timer derives elapsed time from `SystemClock.elapsedRealtime()` while the
device has not rebooted, so wall-clock changes do not reset an in-progress
session. The saved boot count detects a reboot; after reboot, elapsed time is
reconstructed from the persisted wall-clock start timestamp and the session
expiry alarm is recalculated. A manual clock change across a reboot can affect
this fallback calculation.

### Background service and recovery

The foreground service uses Android's `specialUse` foreground-service type,
an ongoing notification, and `START_STICKY` restoration from the saved session.
It runs independently of the Study Mode screen and is not stopped by page
navigation, Back, or normal Activity task removal. The boot/time/time-zone
receiver reconciles saved schedules and sessions, while a session-boundary
alarm handles finite completion.

Android and device manufacturers still impose foreground-service, exact-alarm,
battery, process-reclamation, and background-start restrictions. A service
restart or boot recovery is therefore best-effort where the operating system
does not permit the app to start. Battery optimization guidance is optional and
is opened only when the user chooses it. Notification permission is checked
separately; denying it may hide the ongoing notification from the notification
drawer even though Android still shows foreground-service status elsewhere.

Normal app closure, removal from Recents, Android process termination, reboot,
and explicit **Force stop** are different events. A normal task removal does
not intentionally stop the service. Android can still reclaim a process and
OEM battery policies can restrict recovery. After explicit Force stop,
Android prevents the app's receivers/alarms from being relied on until the user
launches Math Master again. The app does not bypass Force Stop.

Exact alarms are used when Android grants the capability. When they are not
available, an inexact fallback is scheduled and study schedule/session
boundaries may be delayed.

### Permissions and local privacy

Accessibility, Usage Access, overlay, notification, DND, exact-alarm, and
battery-optimization states are read from Android at runtime. Permissions are
never silently enabled. If monitoring or overlay access is revoked, the saved
session remains active while enforcement status reports the missing capability.
The user can restore access from the corresponding Android Settings screen.

Selected apps, schedules, focus sessions, and session history are stored
locally. The session database and encrypted usage aggregates are excluded from
cloud backup and device-to-device transfer. Usage Analytics encrypts its local
daily aggregates with AES-GCM using a key held by Android Keystore. Its native
reader has no network client and does not send package usage records to the
existing account/cloud features.

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
