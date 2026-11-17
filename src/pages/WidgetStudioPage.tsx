import { useCallback, useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  ArrowLeft,
  ChevronRight,
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
  requestAdd(): Promise<{ requested: boolean; supported: boolean }>;
  configureWidget(options: { appWidgetId: number }): Promise<{ opened: boolean }>;
  renderPreview(options: { appWidgetId: number }): Promise<{ dataUrl: string }>;
};

const NativeWidgets = registerPlugin<NativeWidgetsPlugin>("MathMasterWidgets");

type WidgetDesign = { id: string; name: string };

function widgetLabel(widget: NativeWidget, designs: WidgetDesign[]): string {
  return designs.find((design) => design.id === widget.composition)?.name || "Math Master Widget";
}

const WidgetStudioPage = ({ onBack }: { onBack: () => void }) => {
  const native = Capacitor.isNativePlatform();
  const [widgets, setWidgets] = useState<NativeWidget[]>([]);
  const [designs, setDesigns] = useState<WidgetDesign[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingEditor, setOpeningEditor] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedWidget = widgets.find((widget) => widget.appWidgetId === selectedId) || null;

  const refresh = useCallback(async (quiet = false) => {
    if (!native) {
      setLoading(false);
      return;
    }
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await NativeWidgets.getWidgets();
      const available = Array.isArray(result.widgets) ? result.widgets : [];
      setWidgets(available);
      setDesigns(Array.isArray(result.designs) ? result.designs : []);
      setSelectedId((current) =>
        current !== null && available.some((widget) => widget.appWidgetId === current)
          ? current
          : (available[0]?.appWidgetId ?? null),
      );
    } catch {
      setError("Could not read your Android home-screen widgets. Reopen the page and try again.");
    } finally {
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
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    window.addEventListener("focus", onFocus);
    void App.addListener("appStateChange", (state) => {
      if (state.isActive) void refresh(true);
    }).then((listener) => {
      if (disposed) void listener.remove();
      else appListener = listener;
    }).catch(() => {
      // Window focus remains as a fallback when the native app listener is unavailable.
    });
    return () => {
      disposed = true;
      window.removeEventListener("focus", onFocus);
      if (appListener) void appListener.remove();
    };
  }, [native, refresh]);

  useEffect(() => {
    let cancelled = false;
    setPreviewUrl("");
    if (!native || selectedId === null) return;
    void NativeWidgets.renderPreview({ appWidgetId: selectedId }).then((result) => {
      if (!cancelled) setPreviewUrl(result.dataUrl || "");
    }).catch(() => {
      if (!cancelled) setPreviewUrl("");
    });
    return () => {
      cancelled = true;
    };
  }, [native, selectedId, widgets]);

  const handleAdd = async () => {
    setError("");
    setNotice("");
    try {
      const result = await NativeWidgets.requestAdd();
      if (result.requested) {
        setNotice("Android has opened its Add Widget confirmation. Finish the system prompt, then return here to see the new widget.");
      } else {
        setError(result.supported
          ? "Android could not start the widget confirmation. Add Math Master from the home-screen widget picker."
          : "This Android version does not support in-app pin requests. Add Math Master from the home-screen widget picker.");
      }
    } catch {
      setError("Android could not open the widget confirmation. Add Math Master from the home-screen widget picker.");
    }
  };

  const handleCustomize = async () => {
    if (selectedId === null) return;
    setOpeningEditor(true);
    setError("");
    try {
      await NativeWidgets.configureWidget({ appWidgetId: selectedId });
    } catch {
      setError("Could not open this widget's Android customization screen. Refresh and try again.");
    } finally {
      setOpeningEditor(false);
    }
  };

  return (
    <main className="min-w-0 space-y-5 pb-6 text-foreground">
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

          <section className="rounded-2xl border border-border/70 bg-card/45 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Grid2X2 size={16} className="text-primary" />
                  <h2 className="text-sm font-semibold">My Widgets</h2>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {widgets.length} pinned {widgets.length === 1 ? "instance" : "instances"} on this device
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleAdd()}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.98]"
              >
                <Plus size={15} />
                Add Widget
              </button>
            </div>

            {loading ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-background/60 p-4 text-xs text-muted-foreground">
                <RefreshCw size={14} className="animate-spin" />
                Reading widgets from Android…
              </div>
            ) : widgets.length === 0 ? (
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
                  className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground"
                >
                  <Plus size={15} />
                  Add Widgets
                </button>
              </div>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
            )}
          </section>

          {selectedWidget && (
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
              <section className="min-w-0 rounded-2xl border border-border/70 bg-card/45 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">Live Preview</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">Rendered by the Android widget engine</p>
                  </div>
                  <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                    {selectedWidget.widthDp > 0 && selectedWidget.heightDp > 0
                      ? selectedWidget.widthDp + " × " + selectedWidget.heightDp + " dp"
                      : "Launcher size"}
                  </span>
                </div>
                <div className="mt-3 flex min-h-[150px] items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background/75 p-3">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Live preview of the selected Math Master widget"
                      className="block h-auto max-h-64 w-full max-w-[520px] object-contain"
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
                  className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
                >
                  <Settings2 size={15} />
                  {openingEditor ? "Opening Android editor…" : "Customize this widget"}
                </button>
              </section>

              <section className="min-w-0 space-y-3">
                <div className="rounded-2xl border border-border/70 bg-card/45 p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-primary" />
                    <h2 className="text-sm font-semibold">Personalization</h2>
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
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
                </div>

                <div className="rounded-2xl border border-border/70 bg-card/45 p-4">
                  <h2 className="text-sm font-semibold">Launcher controls</h2>
                  <div className="mt-3 space-y-3">
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

          <section className="rounded-2xl border border-border/70 bg-card/35 p-4">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-primary" />
              <h2 className="text-sm font-semibold">Available Designs</h2>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {Math.max(0, designs.length - 1)} layouts + Auto
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              These are layouts of the existing Math Master widget, not separate providers. Choose a layout in Customize.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {designs.map((design) => (
                <div key={design.id} className="min-w-0 rounded-xl border border-border/60 bg-background/50 p-2.5">
                  <p className="truncate text-[11px] font-semibold">{design.name}</p>
                  <p className="mt-1 min-h-8 text-[10px] leading-4 text-muted-foreground">
                    {design.id === "auto" ? "Adapts to the available size" : "Available in Customize"}
                  </p>
                </div>
              ))}
            </div>
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
