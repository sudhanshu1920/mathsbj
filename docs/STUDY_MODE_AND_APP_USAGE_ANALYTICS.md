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
When Math Master is not Device Owner/Profile Owner, the available compatibility
mode is Usage Access + an explicitly approved overlay (Focus Shield). That is
best-effort foreground monitoring and is not system-level package suspension.
The interface labels it as **Shield only**, never **Frozen**.

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

Android does not permit an ordinary app to bypass Force Stop. After the user
force-stops Math Master, its receivers/alarms cannot be relied on until the user
launches it again. Math Master does not use root, hidden APIs, or an
Accessibility-service workaround to evade that rule.

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
