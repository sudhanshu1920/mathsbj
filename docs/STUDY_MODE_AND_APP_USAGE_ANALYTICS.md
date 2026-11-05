# Math Master — Study Mode and App Usage Analytics

## Study Mode on ordinary Android phones

Study Mode is designed for a personal Android phone without root, factory
reset, Device Owner, Profile Owner, or enterprise enrollment. It uses only
permissions that the user explicitly grants in Android Settings:
Accessibility (optional primary detector), Usage Access (fallback), and
Display over other apps (for the restriction overlay).

### What app restriction actually does

Before opening Android Accessibility Settings, Math Master displays a prominent
in-app disclosure and requires the user to tap **Agree & Open Settings**.
Acceptance is recorded locally on the device; Accessibility itself is still
enabled only by the user in Android Settings. Math Master does not mark the
permission granted based on disclosure acceptance.

When the user manually enables Math Master's optional Accessibility service,
it listens only for `TYPE_WINDOW_STATE_CHANGED` and
`TYPE_WINDOWS_CHANGED` events and reads the event's foreground package name.
It does not retrieve window content, view hierarchies, screen text, passwords,
or perform gestures or hidden taps. Selected package membership is checked
against an immutable in-memory snapshot; the event handler does not query
SQLite or PackageManager for every window event.

A selected app transition displays the existing full-screen Focus Shield using
the user-granted overlay permission. The overlay takes focus and blocks ordinary
touch interaction while visible. It is a practical interruption layer, not an
Android package suspension. The selected app can appear briefly before the
overlay, and Android system gestures or other system surfaces may still be
available. The target app may continue background work, notifications,
picture-in-picture, media playback, or external-intent behavior. Math Master
does not claim every launch is prevented or that this is equivalent to a
system freeze.

The shield's **Back to Math Master** action opens the Math Master Learning
landing page. It only dismisses the overlay: it does not end the focus session,
turn off the schedule, clear selected apps, reset the clock, or stop the
foreground service. Reopening the same restricted app is detected as a new
package transition and the shield is shown again.

### Monitoring fallback

Accessibility is the primary event-driven source when the user has enabled it
and Android has connected the service. If it is disabled or disconnected,
UsageStatsManager event history is the fallback after the user grants Usage
Access. The fallback checks the active screen at a 1.6-second interval while
the screen is interactive. It is best effort and may expose the selected app
briefly before the shield appears.

If both monitoring sources are unavailable, or overlay permission is revoked,
the saved session remains active while the status reports the missing capability.
The UI must not report blocking as active in this state. The user can restore
permissions from the explicit Android Settings actions.

Declaring an Accessibility service can trigger additional Play Protect or app
distribution review. It is optional and user-enabled; this implementation
requests no window-content access or gesture capability. Sideloading warnings
must not be bypassed. Any Google Play release needs its own Accessibility API
eligibility/policy review and truthful disclosure before distribution.

### App discovery and package visibility

The private sideload build queries the installed-app inventory and filters it
to enabled applications with launcher, leanback-launcher, or app-info entry
points. Package names are de-duplicated, Math Master and critical phone/system
roles are protected, and unavailable or uninstalled selections are removed
when the saved configuration is reconciled. A package replacement broadcast
does not prune the selected package while an app update is in progress.

Full installed-app inventory access on Android 11+ requires the broad
`QUERY_ALL_PACKAGES` permission. This is included for the app's core
user-selected app-restriction feature in the private sideload build; a Google
Play release requires a separate eligibility and policy review before
distribution. Work-profile package visibility is controlled by Android and is
not guaranteed from the personal profile. Apps without a discoverable
launchable/info activity are not selectable in this picker.

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
an ongoing notification, and `START_STICKY` restoration from the saved
session. It runs independently of the Study Mode screen and is not stopped by
page navigation, Back, or normal Activity task removal. The boot/time/time-zone
receiver reconciles saved sessions and schedules, while a session-boundary
alarm handles finite completion.

Android and device manufacturers still impose foreground-service, exact-alarm,
battery, process-reclamation, and background-start restrictions. A service
restart or boot recovery is therefore best effort where the operating system
does not permit the app to start. Battery optimization guidance is optional and
is opened only when the user chooses it. Notification permission is checked
separately; denying it may hide the ongoing Focus Shield notification from the
notification drawer.

Normal app closure, removal from Recents, Android process termination, reboot,
and explicit **Force stop** are different events. A normal task removal does
not intentionally stop the foreground service. Android can still reclaim a
process and OEM battery policies can restrict recovery. After explicit Force
stop, Android prevents the app's receivers/alarms from being relied on until
the user launches Math Master again. The app does not bypass Force Stop.

Exact alarms are used when Android grants the capability. When they are not
available, an inexact fallback is scheduled and study schedule/session
boundaries may be delayed.

### Permissions and local privacy

Accessibility, Usage Access, overlay, notification, DND, exact-alarm, and
battery-optimization states are read from Android at runtime. Permissions are
never silently enabled. Notification and battery settings actions only open
the relevant Settings pages; they do not silently request exemptions. Apps
targeting Android 15 (API 35) and higher cannot change the device-wide DND
filter through the legacy API; Math Master disables its DND session toggle for
that target/runtime combination and directs users to Android Quick Settings.

Selected apps, schedules, Accessibility disclosure version/acceptance timestamp,
focus sessions, and session history are stored locally. The private
`math_master_study_mode.xml` preferences, session database, and encrypted
usage aggregates are excluded from cloud backup and device-to-device transfer. Usage Analytics encrypts its local
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
