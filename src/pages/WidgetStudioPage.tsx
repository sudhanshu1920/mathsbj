import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { useDesktopMode } from "@/hooks/use-desktop-mode";
import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Grid2X2,
  Info,
  Maximize2,
  MonitorSmartphone,
  Move,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
} from "lucide-react";

type NativeWidget = {
  appWidgetId: number;
  composition: string;
  style: "neon" | "blur" | "transparent";
  content: string[];
  widthDp: number;
  heightDp: number;
};

type NativeWidgetsPlugin = {
  getWidgets(): Promise<{ widgets: NativeWidget[]; designs: WidgetDesign[] }>;
  getDesigns(): Promise<{ designs: WidgetDesign[] }>;
  requestAdd(options?: { composition?: string }): Promise<{ requested: boolean; supported: boolean }>;
  configureWidget(options: { appWidgetId: number; composition?: string }): Promise<{ opened: boolean }>;
  renderPreview(options: { appWidgetId: number }): Promise<{ dataUrl: string }>;
  resetWidget(options: { appWidgetId: number }): Promise<{ reset: boolean }>;
};

const NativeWidgets = registerPlugin<NativeWidgetsPlugin>("MathMasterWidgets");

const getWidgetErrorCode = (error: unknown, fallback: string): string => {
  const message = error instanceof Error ? error.message : "";
  return message.match(/^[A-Z][A-Z0-9_]{2,}(?=:)/)?.[0] ?? fallback;
};

type WidgetDesign = {
  id: string;
  name: string;
  previewDataUrl?: string;
  previewWidthDp?: number;
  previewHeightDp?: number;
};

const STYLE_NAMES: Record<NativeWidget["style"], string> = {
  neon: "Neon Glass",
  blur: "Transparent Blur",
  transparent: "Full Transparent",
};

function widgetLabel(widget: NativeWidget, designs: WidgetDesign[]): string {
  return designs.find((design) => design.id === widget.composition)?.name || "Math Master Widget";
}

const WidgetStudioPage = ({ onBack }: { onBack: () => void }) => {
  const native = Capacitor.isNativePlatform();
  const desktopMode = useDesktopMode();
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const pendingAddRef = useRef<{ existingWidgetIds: Set<number> } | null>(null);
  const pinRequestBackgroundedRef = useRef(false);
  const pinReturnCheckInFlightRef = useRef(false);
  const [widgets, setWidgets] = useState<NativeWidget[]>([]);
  const [designs, setDesigns] = useState<WidgetDesign[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingDesignId, setPendingDesignId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<"loading" | "success" | "error">("loading");
  const [discoveryError, setDiscoveryError] = useState("");
  const [hasConfirmedDiscovery, setHasConfirmedDiscovery] = useState(false);
  const [designRegistryLoading, setDesignRegistryLoading] = useState(true);
  const [designRegistryError, setDesignRegistryError] = useState("");
  const [openingEditor, setOpeningEditor] = useState(false);
  const [addingWidget, setAddingWidget] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedWidget = widgets.find((widget) => widget.appWidgetId === selectedId) || null;

  useLayoutEffect(() => {
    window.dispatchEvent(new CustomEvent("widget-studio-page-state", { detail: { open: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent("widget-studio-page-state", { detail: { open: false } }));
    };
  }, []);

  useEffect(() => {
    const onBackRequest = () => onBack();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onBack();
    };
    window.addEventListener("widget-studio-back", onBackRequest);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("widget-studio-back", onBackRequest);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onBack]);


  const refresh = useCallback(async (quiet = false) => {
    if (!native) {
      setLoading(false);
      setDiscoveryStatus("success");
      return;
    }
    if (refreshInFlightRef.current) {
      await refreshInFlightRef.current;
      return;
    }

    if (quiet) setRefreshing(true);
    else setLoading(true);
    setDiscoveryStatus("loading");
    setDiscoveryError("");
    setDesignRegistryLoading(true);
    setDesignRegistryError("");
    setError("");

    const request = (async () => {
      const [widgetResult, designResult] = await Promise.allSettled([
        NativeWidgets.getWidgets(),
        NativeWidgets.getDesigns(),
      ]);

      if (designResult.status === "fulfilled" && Array.isArray(designResult.value.designs)) {
        setDesigns(designResult.value.designs);
      } else {
        const reason = designResult.status === "rejected" ? designResult.reason : null;
        setDesignRegistryError(getWidgetErrorCode(reason, "WIDGET_DESIGN_REGISTRY_FAILED"));
      }
      setDesignRegistryLoading(false);

      if (widgetResult.status === "fulfilled" && Array.isArray(widgetResult.value?.widgets)) {
        const available = widgetResult.value.widgets;
        setWidgets(available);
        if (designResult.status !== "fulfilled" && Array.isArray(widgetResult.value.designs)) {
          setDesigns(widgetResult.value.designs);
        }
        setSelectedId((current) =>
          current !== null && available.some((widget) => widget.appWidgetId === current)
            ? current
            : (available[0]?.appWidgetId ?? null),
        );
        setHasConfirmedDiscovery(true);
        setDiscoveryStatus("success");
      } else {
        const reason = widgetResult.status === "rejected"
          ? widgetResult.reason
          : new Error("INVALID_WIDGET_DISCOVERY_RESPONSE: Native response is missing the widgets array.");
        const code = getWidgetErrorCode(reason, "WIDGET_DISCOVERY_FAILED");
        console.warn("[WidgetStudio] getWidgets failed", { operation: "getWidgets", code });
        setDiscoveryError(code);
        setDiscoveryStatus("error");
      }
    })();

    refreshInFlightRef.current = request;
    try {
      await request;
    } finally {
      if (refreshInFlightRef.current === request) refreshInFlightRef.current = null;
      setLoading(false);
      setRefreshing(false);
    }
  }, [native]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!native) return;
    let disposed = false;
    let appListener: { remove: () => Promise<void> } | null = null;

    const finishPinRequest = async () => {
      const pending = pendingAddRef.current;
      if (!pending || !pinRequestBackgroundedRef.current || pinReturnCheckInFlightRef.current) return;
      pinReturnCheckInFlightRef.current = true;
      pendingAddRef.current = null;
      pinRequestBackgroundedRef.current = false;
      setAddingWidget(false);
      setNotice("");
      try {
        const snapshot = await NativeWidgets.getWidgets();
        const added = snapshot.widgets
          .filter((widget) => !pending.existingWidgetIds.has(widget.appWidgetId))
          .sort((left, right) => right.appWidgetId - left.appWidgetId);
        await refresh(true);
        if (added.length > 0) {
          setError("");
          setNotice(
            `Math Master widget #${added[0].appWidgetId} is now pinned and verified by Android. Its native settings are saved for this widget ID.`,
          );
        } else {
          setError(
            "Android did not add a new widget. The pin prompt may have been cancelled or declined. " +
            "To add manually: long-press an empty Home screen area, open Widgets, find Math Master, then drag it onto the Home screen.",
          );
        }
      } catch {
        await refresh(true);
        setError(
          "Returned from Android, but the new widget could not be verified. Refresh the widget list or add Math Master manually from Home screen → Widgets.",
        );
      } finally {
        pinReturnCheckInFlightRef.current = false;
      }
    };

    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (pendingAddRef.current && pinRequestBackgroundedRef.current) void finishPinRequest();
      else void refresh(true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (pendingAddRef.current) pinRequestBackgroundedRef.current = true;
      } else if (pendingAddRef.current && pinRequestBackgroundedRef.current) {
        void finishPinRequest();
      }
    };
    const onAppStateChange = (state: { isActive: boolean }) => {
      if (!state.isActive) {
        if (pendingAddRef.current) pinRequestBackgroundedRef.current = true;
        return;
      }
      if (pendingAddRef.current && pinRequestBackgroundedRef.current) void finishPinRequest();
      else void refresh(true);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    void App.addListener("appStateChange", onAppStateChange).then((listener) => {
      if (disposed) void listener.remove();
      else appListener = listener;
    }).catch(() => {
      // Browser focus and visibility remain as fallbacks when the native app listener is unavailable.
    });
    return () => {
      disposed = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (appListener) void appListener.remove();
    };
  }, [native, refresh]);

  useEffect(() => {
    let cancelled = false;
    setPreviewUrl("");
    const renderPreview = () => {
      if (!native || selectedId === null) return;
      void NativeWidgets.renderPreview({ appWidgetId: selectedId }).then((result) => {
        if (!cancelled) setPreviewUrl(result.dataUrl || "");
      }).catch(() => {
        if (!cancelled) setPreviewUrl("");
      });
    };
    renderPreview();
    window.addEventListener("widget-appearance-updated", renderPreview);
    return () => {
      cancelled = true;
      window.removeEventListener("widget-appearance-updated", renderPreview);
    };
  }, [native, selectedId, widgets]);

  const handleAdd = async (composition = pendingDesignId ?? undefined) => {
    // The ref prevents two rapid taps before React commits the disabled button state.
    if (pendingAddRef.current || addingWidget) return;
    setError("");
    setNotice("");
    setAddingWidget(true);
    pinRequestBackgroundedRef.current = false;
    pendingAddRef.current = {
      existingWidgetIds: new Set(widgets.map((widget) => widget.appWidgetId)),
    };
    try {
      const result = await NativeWidgets.requestAdd(composition ? { composition } : undefined);
      if (result.requested) {
        setNotice(composition
          ? `Android sent the pin request for ${designs.find((design) => design.id === composition)?.name ?? "the selected design"}. Confirm it in the Android launcher; the native customization screen will open with the new widget ID.`
          : "Android sent the widget pin request. Confirm it in the launcher; the native customization screen will open with the new widget ID.");
      } else {
        pendingAddRef.current = null;
        setAddingWidget(false);
        setError(result.supported
          ? "Android could not start the widget pin confirmation. " +
            "To add manually: long-press an empty Home screen area, open Widgets, find Math Master, then drag it onto the Home screen."
          : "This launcher or Android version does not support in-app widget pinning. " +
            "To add manually: long-press an empty Home screen area, open Widgets, find Math Master, then drag it onto the Home screen.");
      }
    } catch {
      pendingAddRef.current = null;
      setAddingWidget(false);
      setError(
        "Android could not open the widget pin confirmation. " +
        "To add manually: long-press an empty Home screen area, open Widgets, find Math Master, then drag it onto the Home screen.",
      );
    }
  };

  const handleCustomize = async (composition?: string) => {
    if (selectedId === null) return;
    setOpeningEditor(true);
    setError("");
    try {
      await NativeWidgets.configureWidget({
        appWidgetId: selectedId,
        ...(composition ? { composition } : {}),
      });
    } catch {
      setError("Could not open this widget's Android customization screen. Refresh and try again.");
    } finally {
      setOpeningEditor(false);
    }
  };

  const handleReset = async () => {
    if (selectedId === null) return;
    const confirmed = window.confirm(
      "Reset only this widget to its original default design, Neon Glass appearance and standard content? Screen Time stays opt-in."
    );
    if (!confirmed) return;
    setResetting(true);
    setError("");
    setNotice("");
    try {
      await NativeWidgets.resetWidget({ appWidgetId: selectedId });
      setNotice("This widget has been restored to its default settings.");
      await refresh(true);
    } catch {
      setError("Android could not confirm the reset. Refresh the widget list and check its saved settings.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <main className={`mx-auto min-w-0 w-full ${desktopMode ? "max-w-6xl" : "max-w-3xl"} space-y-3.5 pb-5 text-foreground`}>
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Settings"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/60 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-primary" />
            <h1 className="text-lg font-bold tracking-tight">Widget Studio</h1>
          </div>
          <p className="text-xs text-muted-foreground">Personalize your home-screen widgets</p>
        </div>
        {native && (
          <button
            type="button"
            onClick={() => void refresh(true)}
            disabled={refreshing}
            aria-label="Refresh widgets"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/60 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
        )}
      </header>

      {!native ? (
        <section className="rounded-2xl border border-border/70 bg-card/50 p-5 text-center">
          <MonitorSmartphone size={28} className="mx-auto mb-3 text-primary" />
          <h2 className="text-sm font-semibold">Android widgets are managed on your device</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Install and open Math Master on Android to add and customize home-screen widgets.
          </p>
        </section>
      ) : (
        <>
          {error && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs text-foreground">
              {notice}
            </div>
          )}

          <section className="rounded-2xl border border-border/70 bg-card/45 p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Grid2X2 size={16} className="text-primary" />
                  <h2 className="text-sm font-semibold">My Widgets</h2>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {discoveryStatus === "loading"
                    ? "Checking Android widget status…"
                    : discoveryStatus === "success"
                      ? `${widgets.length} pinned ${widgets.length === 1 ? "instance" : "instances"} on this device`
                      : hasConfirmedDiscovery
                        ? `${widgets.length} last confirmed ${widgets.length === 1 ? "instance" : "instances"} · current status unavailable`
                        : "Pinned widget status unavailable"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={addingWidget}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={15} />
                {addingWidget ? "Waiting for Android…" : "Add Widget"}
              </button>
            </div>

            {loading && !hasConfirmedDiscovery && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-background/60 p-4 text-xs text-muted-foreground">
                <RefreshCw size={14} className="animate-spin" />
                Reading widgets from Android…
              </div>
            )}
            {discoveryStatus === "error" && (
              <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <p className="font-semibold">Unable to load your widgets</p>
                <p className="mt-1 leading-5">
                  {hasConfirmedDiscovery
                    ? "Android discovery failed. The previously confirmed widget list and saved settings are being kept; displayed instances may be out of date."
                    : "Android did not confirm whether any Math Master widgets are pinned. No empty state or zero count will be assumed."}
                </p>
                <p className="mt-1 font-mono text-[10px] opacity-80">Diagnostic: {discoveryError}</p>
                <button
                  type="button"
                  onClick={() => void refresh(true)}
                  disabled={refreshing}
                  className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-destructive/25 px-2.5 font-semibold disabled:opacity-50"
                >
                  <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                  Retry discovery
                </button>
              </div>
            )}
            {discoveryStatus === "success" && widgets.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-background/45 px-4 py-7 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Grid2X2 size={20} />
                </div>
                <h3 className="text-sm font-semibold">Your workspace is ready</h3>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                  Add a Math Master widget from Android's confirmation flow to personalize your home screen.
                </p>
                <button
                  type="button"
                  onClick={() => void handleAdd()}
                  disabled={addingWidget}
                  className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={15} />
                  {addingWidget ? "Waiting for Android…" : "Add Widgets"}
                </button>
              </div>
            ) : hasConfirmedDiscovery && widgets.length > 0 ? (
              <div className={`mt-4 grid gap-2 ${desktopMode ? "sm:grid-cols-2" : "grid-cols-1"}`} data-widget-layout="instances">
                {widgets.map((widget) => {
                  const active = selectedId === widget.appWidgetId;
                  return (
                    <button
                      type="button"
                      key={widget.appWidgetId}
                      onClick={() => setSelectedId(widget.appWidgetId)}
                      aria-pressed={active}
                      className={
                        "flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors " +
                        (active
                          ? "border-primary/60 bg-primary/5 shadow-sm"
                          : "border-border/70 bg-background/45 hover:border-primary/35")
                      }
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Grid2X2 size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{widgetLabel(widget, designs)}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          Widget #{widget.appWidgetId} · {STYLE_NAMES[widget.style]}
                        </span>
                      </span>
                      <ChevronRight size={15} className="shrink-0 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>

          {selectedWidget && (
            <div className={`grid min-w-0 gap-3 ${desktopMode ? "md:grid-cols-[minmax(0,1.1fr)_minmax(250px,0.9fr)]" : "grid-cols-1"}`}>
              <section className="min-w-0 rounded-2xl border border-border/70 bg-card/45 p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold">Live Preview</h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Actual Android widget renderer</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full border border-border bg-background/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                      {selectedWidget.widthDp > 0 && selectedWidget.heightDp > 0
                        ? selectedWidget.widthDp + " × " + selectedWidget.heightDp + " dp"
                        : "Launcher size"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewExpanded((value) => !value)}
                      aria-expanded={previewExpanded}
                      aria-label={previewExpanded ? "Collapse widget preview" : "Expand widget preview"}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/70 text-muted-foreground hover:text-foreground"
                    >
                      {previewExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>
                <div className={"mt-2.5 flex items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background/75 p-2 " + (previewExpanded ? "min-h-[210px]" : "min-h-[112px]")}>
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Live preview of the selected Math Master widget"
                      className={"block h-auto w-full object-contain " + (previewExpanded ? "max-h-80 max-w-[620px]" : "max-h-40 max-w-[440px]")}
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <RefreshCw size={14} className="animate-spin" />
                      Preparing live preview…
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void handleCustomize()}
                  disabled={openingEditor}
                  className="mt-2.5 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
                >
                  <Settings2 size={15} />
                  {openingEditor ? "Opening Android editor…" : "Customize this widget"}
                </button>
              </section>

              <section className="min-w-0 space-y-3">
                <div className="rounded-2xl border border-border/70 bg-card/45 p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-primary" />
                    <h2 className="text-sm font-semibold">Personalization</h2>
                  </div>
                  <div className="mt-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Design</span>
                      <span className="font-medium">{widgetLabel(selectedWidget, designs)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Appearance</span>
                      <span className="font-medium">{STYLE_NAMES[selectedWidget.style]}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Visible content</span>
                      <span className="font-medium">{selectedWidget.content.length} fields</span>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                    The Android editor provides the supported design, background and content controls. Changes are saved for this widget instance only.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleReset()}
                    disabled={resetting}
                    className="mt-2.5 inline-flex min-h-8 items-center gap-2 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                  >
                    {resetting ? "Resetting…" : "Reset to default"}
                  </button>
                </div>

                <div className="rounded-2xl border border-border/70 bg-card/45 p-3">
                  <h2 className="text-sm font-semibold">Launcher controls</h2>
                  <div className="mt-2.5 space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <Maximize2 size={15} className="mt-0.5 shrink-0 text-primary" />
                      <p className="text-xs leading-5 text-muted-foreground">
                        Resize the widget on your home screen. The preview reports the size chosen by the launcher.
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Move size={15} className="mt-0.5 shrink-0 text-primary" />
                      <p className="text-xs leading-5 text-muted-foreground">
                        Move and arrange widgets directly on the launcher; Android owns their placement and order.
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Info size={15} className="mt-0.5 shrink-0 text-primary" />
                      <p className="text-xs leading-5 text-muted-foreground">
                        To remove a widget, long-press it on the home screen and choose Remove. Android does not expose an in-app unpin API.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          <section className="rounded-2xl border border-border/70 bg-card/35 p-3">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-primary" />
              <h2 className="text-sm font-semibold">Available Designs</h2>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {designRegistryLoading
                  ? "Loading native designs…"
                  : designRegistryError && designs.length === 0
                    ? "Design registry unavailable"
                    : `${designs.filter((design) => design.id !== "auto").length} layouts${designs.some((design) => design.id === "auto") ? " + Auto" : ""}`}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              These are layouts of the existing Math Master widget, not separate providers. Choose a layout in Customize.
            </p>
            {designRegistryError && designs.length === 0 && (
              <p role="status" className="mt-2 text-[11px] text-warning">
                Native design metadata could not be loaded ({designRegistryError}). Retry to restore the supported catalogue.
              </p>
            )}
            {designs.length > 0 ? (
              <div className={`mt-3 grid gap-2 ${desktopMode ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`} data-widget-layout="designs">
                {designs.map((design) => (
                  <button
                    type="button"
                    key={design.id}
                    onClick={() => {
                      if (selectedWidget) {
                        void handleCustomize(design.id);
                      } else {
                        setPendingDesignId(design.id);
                      }
                    }}
                    disabled={openingEditor}
                    aria-pressed={!selectedWidget && pendingDesignId === design.id}
                    aria-label={selectedWidget ? `Customize ${design.name}` : `Select ${design.name} for the new widget`}
                    className={`min-w-0 overflow-hidden rounded-xl border p-2 text-left transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60 ${!selectedWidget && pendingDesignId === design.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/60 bg-background/50"}`}
                  >
                    {design.previewDataUrl ? (
                      <img
                        src={design.previewDataUrl}
                        alt={`${design.name} preview from the Android widget renderer`}
                        loading="lazy"
                        className="mb-1.5 aspect-[2/1] w-full rounded-lg bg-background/70 object-contain"
                      />
                    ) : (
                      <span className="mb-1.5 flex aspect-[2/1] w-full items-center justify-center rounded-lg bg-background/70 text-[10px] text-muted-foreground">
                        Native preview unavailable
                      </span>
                    )}
                    <span className="block truncate text-[11px] font-semibold">{design.name}</span>
                    <span className="mt-1 block min-h-7 text-[10px] leading-4 text-muted-foreground">
                      {design.id === "auto"
                        ? selectedWidget ? "Adapts to the available size" : pendingDesignId === design.id ? "Selected for your new widget" : "Tap to use Auto"
                        : selectedWidget
                          ? "Tap to customize this layout"
                          : pendingDesignId === design.id ? "Selected for your new widget" : "Tap to use this layout"}
                    </span>
                  </button>
                ))}
              </div>
            ) : !designRegistryLoading && !designRegistryError ? (
              <p className="mt-3 text-xs text-muted-foreground">The native provider reports no supported designs.</p>
            ) : null}
            {widgets.length > 0 && (
              <button
                type="button"
                onClick={() => void handleCustomize()}
                disabled={openingEditor || selectedId === null}
                className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium transition-colors hover:border-primary/40 disabled:opacity-50"
              >
                Open design selector
                <ChevronRight size={14} />
              </button>
            )}
          </section>

          <p className="flex items-start gap-2 px-1 text-[11px] leading-5 text-muted-foreground">
            <Info size={13} className="mt-0.5 shrink-0" />
            Widget settings are stored per Android widget ID. Existing widgets and their saved settings are not changed when another instance is added.
          </p>
        </>
      )}
    </main>
  );
};

export default WidgetStudioPage;
