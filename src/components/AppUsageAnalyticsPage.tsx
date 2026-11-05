import { useCallback, useEffect, useMemo, useState } from "react";
import { App } from "@capacitor/app";
import {
  ArrowLeft, BarChart3, CalendarDays, Check, ChevronDown, Clock3, PieChart as PieIcon,
  RefreshCw, ShieldCheck, Trash2,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  clearLocalAppUsageHistory,
  formatUsageDate,
  formatUsageDuration,
  getAppUsageAnalytics,
  getUsageRangeWindow,
  openAppUsageAccessSettings,
  setAppUsageRetention,
  type UsageAnalyticsSnapshot,
  type UsageApp,
  type UsageAppFilter,
  type UsageChartType,
  type UsageDailyPoint,
  type UsageRange,
} from "@/lib/appUsageAnalytics";

interface AppUsageAnalyticsPageProps {
  onBack: () => void;
}

const CHARTS: Array<{ id: UsageChartType; label: string }> = [
  { id: "column", label: "Column" },
  { id: "pie", label: "Pie" },
  { id: "line", label: "Line" },
  { id: "bar", label: "Bar" },
  { id: "area", label: "Area" },
  { id: "column-line", label: "Column-Line" },
];

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 190 75% 48%))",
  "hsl(var(--chart-3, 155 55% 42%))",
  "hsl(var(--chart-4, 265 65% 62%))",
  "hsl(var(--chart-5, 35 80% 55%))",
  "hsl(var(--chart-6, 330 65% 58%))",
];

const shortDate = (value: string) => {
  const date = new Date(value + "T12:00:00");
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" }).format(date)
    : value;
};

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: { date?: string; label?: string } }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const heading = payload[0]?.payload?.date ?? payload[0]?.payload?.label ?? label ?? "";
  return (
    <div className="rounded-lg border border-border/70 bg-background/95 px-2.5 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-foreground">{heading}</p>
      {payload.map((item, index) => (
        <p key={String(item.name ?? index)} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.name ?? "Usage"}</span>
          <strong className="ml-auto pl-3 font-mono font-semibold text-foreground">
            {formatUsageDuration(Number(item.value ?? 0))}
          </strong>
        </p>
      ))}
    </div>
  );
};

const AppUsageAnalyticsPage = ({ onBack }: AppUsageAnalyticsPageProps) => {
  const [range, setRange] = useState<UsageRange>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [chartType, setChartType] = useState<UsageChartType>("column");
  const [appFilter, setAppFilter] = useState<UsageAppFilter>("all");
  const [snapshot, setSnapshot] = useState<UsageAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [retentionDays, setRetentionDays] = useState<30 | 90 | 180>(90);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const window = getUsageRangeWindow(range, customStart, customEnd);
      const result = await getAppUsageAnalytics(window);
      setSnapshot(result);
      setRetentionDays(result.retentionDays === 30 || result.retentionDays === 180 ? result.retentionDays : 90);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load app usage data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range, customStart, customEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let disposed = false;
    let resumeListener: { remove: () => Promise<void> } | null = null;
    const refresh = () => {
      if (!disposed && document.visibilityState === "visible") void load(true);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    void App.addListener("resume", () => {
      if (!disposed) void load(true);
    }).then((listener) => {
      if (disposed) void listener.remove();
      else resumeListener = listener;
    }).catch(() => undefined);
    return () => {
      disposed = true;
      if (resumeListener) void resumeListener.remove();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  const apps = snapshot?.apps ?? [];
  const selectedApp = appFilter !== "all" && appFilter !== "top"
    ? apps.find((app) => app.packageName === appFilter) ?? null
    : null;
  const chartApps = useMemo(() => {
    if (appFilter === "all") return apps;
    if (appFilter === "top") return apps.slice(0, 6);
    return apps.filter((app) => app.packageName === appFilter);
  }, [apps, appFilter]);

  const trendRows = useMemo(() => {
    const totals = selectedApp
      ? selectedApp.dailyUsage
      : appFilter === "top"
        ? (snapshot?.dailyUsage ?? []).map((point) => ({
            date: point.date,
            usageMillis: chartApps.reduce((sum, app) => {
              const appPoint = app.dailyUsage.find((item) => item.date === point.date);
              return sum + (appPoint?.usageMillis ?? 0);
            }, 0),
          }))
        : snapshot?.dailyUsage ?? [];
    return totals.map((point, index) => {
      const window = totals.slice(Math.max(0, index - 6), index + 1);
      const average = window.reduce((sum, item) => sum + item.usageMillis, 0) / Math.max(1, window.length);
      return {
        date: point.date,
        label: shortDate(point.date),
        usageMillis: point.usageMillis,
        average7d: average,
      };
    });
  }, [selectedApp, appFilter, snapshot?.dailyUsage, chartApps]);

  const pieRows = useMemo(() => {
    const sorted = chartApps.slice().sort((a, b) => b.usageMillis - a.usageMillis);
    const top = sorted.slice(0, 5).map((app) => ({
      packageName: app.packageName,
      label: app.label,
      usageMillis: app.usageMillis,
    }));
    const rest = sorted.slice(5).reduce((sum, app) => sum + app.usageMillis, 0);
    if (rest > 0) top.push({ packageName: "__others__", label: "Others", usageMillis: rest });
    return top;
  }, [chartApps]);

  const chartAppsForBars = useMemo(
    () => chartApps.slice().sort((a, b) => b.usageMillis - a.usageMillis),
    [chartApps],
  );

  const handleRetentionChange = async (value: string) => {
    const days = Number(value);
    if (days !== 30 && days !== 90 && days !== 180) return;
    try {
      const saved = await setAppUsageRetention(days);
      setRetentionDays(saved as 30 | 90 | 180);
      setError("");
    } catch {
      setError("Could not update local data retention.");
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Clear Math Master’s encrypted local usage history? Android’s own system usage records are not deleted.")) return;
    setClearing(true);
    try {
      await clearLocalAppUsageHistory();
      setSnapshot((previous) => previous ? {
        ...previous,
        apps: [],
        dailyUsage: [],
        totalUsageMillis: 0,
        mostUsedPackage: "",
        mostUsedMillis: 0,
        historyStartDate: "",
        lastUpdatedAt: 0,
        dataAvailable: false,
      } : previous);
      setAppFilter("all");
      setError("Local analytics history cleared. Android may provide system usage figures again on the next refresh.");
    } catch {
      setError("Could not clear local usage history.");
    } finally {
      setClearing(false);
    }
  };

  const selectPieApp = (entry: { packageName?: string }) => {
    if (entry.packageName && entry.packageName !== "__others__") setAppFilter(entry.packageName);
  };

  const chartHeight = chartType === "bar"
    ? Math.max(240, Math.min(620, chartAppsForBars.length * 34 + 50))
    : 260;
  const isEmpty = !loading && (!snapshot?.permissionGranted || !snapshot?.apps.length);

  return (
    <div className="min-w-0 space-y-3">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Settings"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground hover:bg-secondary"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-foreground">App Usage</h2>
          <p className="text-[10px] text-muted-foreground">On-device analytics</p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing || loading}
          aria-label="Refresh app usage"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-muted-foreground hover:text-primary disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-xl border border-border/70 bg-card/35 px-2.5 py-2">
          <p className="text-[9px] text-muted-foreground">Total usage</p>
          <p className="truncate text-sm font-bold tabular-nums text-foreground">
            {formatUsageDuration(snapshot?.totalUsageMillis ?? 0)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-border/70 bg-card/35 px-2.5 py-2">
          <p className="text-[9px] text-muted-foreground">Most used</p>
          <p className="truncate text-xs font-bold text-foreground">
            {apps.find((app) => app.packageName === snapshot?.mostUsedPackage)?.label ?? "—"}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-border/70 bg-card/35 px-2.5 py-2">
          <p className="text-[9px] text-muted-foreground">Apps used</p>
          <p className="text-sm font-bold tabular-nums text-foreground">{apps.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {([
          ["today", "Today"],
          ["7d", "7 Days"],
          ["30d", "30 Days"],
          ["custom", "Custom"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setRange(id)}
            aria-pressed={range === id}
            className={range === id
              ? "rounded-full bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground"
              : "rounded-full bg-secondary/70 px-3 py-1.5 text-[10px] font-medium text-muted-foreground"}
          >
            {label}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="min-w-0 text-[10px] text-muted-foreground">
            From
            <input
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"
            />
          </label>
          <label className="min-w-0 text-[10px] text-muted-foreground">
            To
            <input
              type="date"
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"
            />
          </label>
        </div>
      )}

      <div className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1" role="group" aria-label="Usage chart type">
        {CHARTS.map((chart) => (
          <button
            key={chart.id}
            type="button"
            onClick={() => setChartType(chart.id)}
            aria-pressed={chartType === chart.id}
            aria-label={chart.label + " chart"}
            className={chartType === chart.id
              ? "shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-semibold text-primary-foreground"
              : "shrink-0 rounded-lg bg-secondary/70 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground"}
          >
            {chart.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <label className="shrink-0 text-[10px] font-medium text-muted-foreground" htmlFor="usage-app-filter">Apps</label>
        <select
          id="usage-app-filter"
          value={appFilter}
          onChange={(event) => setAppFilter(event.target.value)}
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
        >
          <option value="all">All Apps</option>
          <option value="top">Top Apps</option>
          {apps.map((app) => <option key={app.packageName} value={app.packageName}>{app.label}</option>)}
        </select>
        {appFilter !== "all" && (
          <button
            type="button"
            onClick={() => setAppFilter("all")}
            className="text-[10px] text-primary"
          >
            Clear
          </button>
        )}
      </div>

      <section className="overflow-hidden rounded-xl border border-border/70 bg-card/30 p-2.5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">{CHARTS.find((chart) => chart.id === chartType)?.label}</p>
          <p className="truncate text-[9px] text-muted-foreground">
            {snapshot?.fromDate && snapshot?.toDate ? snapshot.fromDate + " – " + snapshot.toDate : "Usage trend"}
          </p>
        </div>
        {loading ? (
          <div className="flex h-60 items-center justify-center text-xs text-muted-foreground">Reading Android usage data…</div>
        ) : !snapshot?.permissionGranted ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
            <Clock3 size={26} className="text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground">Usage Access required</p>
            <button
              type="button"
              onClick={() => void openAppUsageAccessSettings().catch(() => setError("Android Usage Access settings could not be opened."))}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              Grant Usage Access
            </button>
          </div>
        ) : snapshot.apps.length === 0 ? (
          <div className="flex h-56 items-center justify-center px-6 text-center text-xs text-muted-foreground">
            No app usage records are available for this range yet. Android may return delayed or limited history.
          </div>
        ) : chartType === "pie" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="h-56 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie
                    data={pieRows}
                    dataKey="usageMillis"
                    nameKey="label"
                    innerRadius="48%"
                    outerRadius="82%"
                    paddingAngle={2}
                    onClick={(entry) => selectPieApp(entry as { packageName?: string })}
                  >
                    {pieRows.map((entry, index) => <Cell key={entry.packageName} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid content-center gap-1.5">
              {pieRows.map((entry, index) => (
                <button
                  key={entry.packageName}
                  type="button"
                  onClick={() => selectPieApp(entry)}
                  disabled={entry.packageName === "__others__"}
                  className="flex min-w-0 items-center gap-2 text-left text-[10px] disabled:cursor-default"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.label}</span>
                  <span className="shrink-0 font-mono text-foreground">{formatUsageDuration(entry.usageMillis)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : chartType === "column" ? (
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(320, chartAppsForBars.length * 58), height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartAppsForBars} margin={{ top: 8, right: 10, bottom: 38, left: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" angle={-35} textAnchor="end" interval={0} height={62} tick={{ fontSize: 9 }} />
                  <YAxis width={42} tick={{ fontSize: 9 }} tickFormatter={(value) => formatUsageDuration(Number(value))} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="usageMillis" name="Usage" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : chartType === "bar" ? (
          <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 430 }}>
            <div style={{ minWidth: 280, height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={chartAppsForBars} margin={{ top: 4, right: 32, bottom: 4, left: 2 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(value) => formatUsageDuration(Number(value))} />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 9 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="usageMillis" name="Usage" fill="hsl(var(--primary))" radius={[0, 5, 5, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : chartType === "line" ? (
          <div className="h-60 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendRows} margin={{ top: 8, right: 10, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} minTickGap={16} />
                <YAxis width={42} tick={{ fontSize: 9 }} tickFormatter={(value) => formatUsageDuration(Number(value))} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="usageMillis" name="Usage" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : chartType === "area" ? (
          <div className="h-60 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendRows} margin={{ top: 8, right: 10, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="usage-area-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} minTickGap={16} />
                <YAxis width={42} tick={{ fontSize: 9 }} tickFormatter={(value) => formatUsageDuration(Number(value))} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="usageMillis" name="Usage" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#usage-area-fill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-60 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendRows} margin={{ top: 8, right: 10, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} minTickGap={16} />
                <YAxis width={42} tick={{ fontSize: 9 }} tickFormatter={(value) => formatUsageDuration(Number(value))} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="usageMillis" name="Daily usage" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Line type="monotone" dataKey="average7d" name="7-day rolling average" stroke="hsl(var(--chart-2, 190 75% 48%))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        {selectedApp && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2">
            {selectedApp.iconDataUrl ? <img src={selectedApp.iconDataUrl} alt="" className="h-7 w-7 rounded-lg object-contain" /> : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{selectedApp.label}</p>
              <p className="text-[9px] text-muted-foreground">Last used {selectedApp.lastUsedTimestamp > 0 ? new Date(selectedApp.lastUsedTimestamp).toLocaleString() : "not reported by Android"}</p>
            </div>
            <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">{formatUsageDuration(selectedApp.usageMillis)}</p>
          </div>
        )}
      </section>

      <section className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">App usage</p>
          <p className="text-[9px] text-muted-foreground">Tap an app to inspect its trend</p>
        </div>
        {apps.map((app) => (
          <button
            key={app.packageName}
            type="button"
            onClick={() => setAppFilter(app.packageName)}
            className={appFilter === app.packageName
              ? "flex w-full items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5 text-left"
              : "flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left hover:bg-secondary/50"}
          >
            {app.iconDataUrl
              ? <img src={app.iconDataUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg object-contain" />
              : <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold">{app.label.slice(0, 1)}</span>}
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{app.label}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{app.percent.toFixed(1)}%</span>
            <span className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">{formatUsageDuration(app.usageMillis)}</span>
          </button>
        ))}
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/25 px-2.5 py-2">
        <ShieldCheck size={14} className="shrink-0 text-success" />
        <span className="min-w-0 flex-1 text-[10px] text-muted-foreground">Encrypted on device · excluded from cloud backup and device transfer</span>
        <label className="flex shrink-0 items-center gap-1 text-[9px] text-muted-foreground">
          Keep
          <select
            value={retentionDays}
            onChange={(event) => { void handleRetentionChange(event.target.value); }}
            className="h-7 rounded-md border border-border bg-background px-1 text-[10px] text-foreground"
            aria-label="Local usage retention"
          >
            <option value={30}>30d</option>
            <option value={90}>90d</option>
            <option value={180}>180d</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void handleClear()}
          disabled={clearing || !snapshot?.lastUpdatedAt}
          aria-label="Clear local usage history"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] text-destructive hover:bg-destructive/10 disabled:opacity-40"
        >
          <Trash2 size={12} /> Clear
        </button>
      </section>

      {(error || (snapshot?.status === "system_data_unavailable")) && (
        <p role="status" className="rounded-lg bg-secondary/70 px-3 py-2 text-[10px] text-muted-foreground">
          {error || "Android did not return usage aggregates. Unlock the device and refresh to retry."}
        </p>
      )}
      {snapshot?.historyStartDate && (
        <p className="text-[9px] text-muted-foreground">
          Local history from {formatUsageDate(snapshot.historyStartDate)} · OS usage reports may be delayed or interval-aggregated.
        </p>
      )}
    </div>
  );
};

export default AppUsageAnalyticsPage;
