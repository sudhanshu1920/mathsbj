import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WidgetStudioPage from "./WidgetStudioPage";

const mocks = vi.hoisted(() => ({
  native: true,
  getWidgets: vi.fn(),
  getDesigns: vi.fn(),
  requestAdd: vi.fn(),
  configureWidget: vi.fn(),
  renderPreview: vi.fn(),
  resetWidget: vi.fn(),
  addListener: vi.fn(),
  appStateListener: null as null | ((state: { isActive: boolean }) => void),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mocks.native },
  registerPlugin: () => ({
    getWidgets: mocks.getWidgets,
    getDesigns: mocks.getDesigns,
    requestAdd: mocks.requestAdd,
    configureWidget: mocks.configureWidget,
    renderPreview: mocks.renderPreview,
    resetWidget: mocks.resetWidget,
  }),
}));

vi.mock("@capacitor/app", () => ({
  App: { addListener: mocks.addListener },
}));

const widget = {
  appWidgetId: 42,
  composition: "hero_wide",
  style: "neon" as const,
  content: ["target", "progress", "streak"],
  widthDp: 320,
  heightDp: 146,
};

describe("WidgetStudioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.native = true;
    mocks.getWidgets.mockResolvedValue({ widgets: [] });
    mocks.getDesigns.mockResolvedValue({ designs: [
      { id: "auto", name: "Auto (adapts to size)", previewDataUrl: "data:image/png;base64,YXV0bw==" },
      { id: "hero_wide", name: "Hero Wide · Blue Neon", previewDataUrl: "data:image/png;base64,aGVybw==" },
    ] });
    mocks.requestAdd.mockResolvedValue({ requested: true, supported: true });
    mocks.configureWidget.mockResolvedValue({ opened: true });
    mocks.renderPreview.mockResolvedValue({ dataUrl: "data:image/png;base64,d2lkZ2V0" });
    mocks.resetWidget.mockResolvedValue({ reset: true });
    mocks.appStateListener = null;
    mocks.addListener.mockImplementation(async (
      _event: string,
      listener: (state: { isActive: boolean }) => void,
    ) => {
      mocks.appStateListener = listener;
      return { remove: vi.fn().mockResolvedValue(undefined) };
    });
  });

  it("shows the useful empty state and opens Android's real add confirmation", async () => {
    render(<WidgetStudioPage onBack={vi.fn()} />);

    expect(await screen.findByText("Your workspace is ready")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Widgets" }));

    await waitFor(() => expect(mocks.requestAdd).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent("Android sent the widget pin request");
    expect(screen.getAllByRole("button", { name: "Waiting for Android…" })
      .every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it("verifies a real Android widget ID after the user confirms the pin request", async () => {
    render(<WidgetStudioPage onBack={vi.fn()} />);
    expect(await screen.findByText("Your workspace is ready")).toBeInTheDocument();
    await waitFor(() => expect(mocks.appStateListener).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Add Widgets" }));
    await waitFor(() => expect(mocks.requestAdd).toHaveBeenCalledTimes(1));
    mocks.getWidgets.mockResolvedValue({ widgets: [widget] });
    mocks.appStateListener?.({ isActive: false });
    mocks.appStateListener?.({ isActive: true });

    await waitFor(() => expect(screen.getByRole("status"))
      .toHaveTextContent("widget #42 is now pinned and verified by Android"));
    expect(await screen.findByText(/Widget #42 · Neon Glass/)).toBeInTheDocument();
  });

  it("reports pin cancellation without claiming success and shows the manual picker steps", async () => {
    render(<WidgetStudioPage onBack={vi.fn()} />);
    expect(await screen.findByText("Your workspace is ready")).toBeInTheDocument();
    await waitFor(() => expect(mocks.appStateListener).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Add Widgets" }));
    await waitFor(() => expect(mocks.requestAdd).toHaveBeenCalledTimes(1));
    mocks.appStateListener?.({ isActive: false });
    mocks.appStateListener?.({ isActive: true });

    expect(await screen.findByRole("alert")).toHaveTextContent("Android did not add a new widget");
    expect(screen.getByRole("alert")).toHaveTextContent("long-press an empty Home screen area");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("lets a user choose an available design before pinning the first widget", async () => {
    render(<WidgetStudioPage onBack={vi.fn()} />);

    expect(await screen.findByText("Your workspace is ready")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select Hero Wide · Blue Neon for the new widget" }));
    expect(screen.getByRole("button", {
      name: "Select Hero Wide · Blue Neon for the new widget",
    })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Add Widgets" }));
    await waitFor(() => expect(mocks.requestAdd).toHaveBeenCalledWith({ composition: "hero_wide" }));
    expect(await screen.findByRole("status")).toHaveTextContent("pin request for Hero Wide");
  });

  it("offers the manual widget picker path when the launcher does not support pin requests", async () => {
    mocks.requestAdd.mockResolvedValueOnce({ requested: false, supported: false });
    render(<WidgetStudioPage onBack={vi.fn()} />);

    expect(await screen.findByText("Your workspace is ready")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Widgets" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("does not support in-app widget pinning");
    expect(screen.getByRole("alert")).toHaveTextContent("long-press an empty Home screen area");
    expect(mocks.requestAdd).toHaveBeenCalledTimes(1);
  });

  it("lists pinned instances, shows the native renderer preview and opens the existing editor", async () => {
    mocks.getWidgets.mockResolvedValue({ widgets: [widget], designs: [{ id: "hero_wide", name: "Hero Wide · Blue Neon" }] });
    render(<WidgetStudioPage onBack={vi.fn()} />);

    expect((await screen.findAllByText(/Hero Wide/)).length).toBeGreaterThan(0);
    const preview = await screen.findByRole("img", { name: "Live preview of the selected Math Master widget" });
    expect(preview).toHaveAttribute("src", "data:image/png;base64,d2lkZ2V0");
    expect(await screen.findByRole("img", {
      name: "Hero Wide · Blue Neon preview from the Android widget renderer",
    })).toHaveAttribute("src", "data:image/png;base64,aGVybw==");
    expect(screen.getByText("320 × 146 dp")).toBeInTheDocument();

    const expandPreview = screen.getByRole("button", { name: "Expand widget preview" });
    fireEvent.click(expandPreview);
    expect(screen.getByRole("button", { name: "Collapse widget preview" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Collapse widget preview" }));
    expect(screen.getByRole("button", { name: "Expand widget preview" })).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Customize this widget" }));
    await waitFor(() => expect(mocks.configureWidget).toHaveBeenCalledWith({ appWidgetId: 42 }));
  });

  it("separates discovery failure from a confirmed empty state while keeping the supported design registry", async () => {
    mocks.getWidgets.mockRejectedValueOnce(new Error("Native plugin is not implemented"));
    render(<WidgetStudioPage onBack={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load your widgets");
    expect(screen.getByText("Pinned widget status unavailable")).toBeInTheDocument();
    expect(screen.queryByText("0 pinned instances on this device")).not.toBeInTheDocument();
    expect(screen.queryByText("Your workspace is ready")).not.toBeInTheDocument();
    expect(await screen.findByRole("img", {
      name: "Hero Wide · Blue Neon preview from the Android widget renderer",
    })).toBeInTheDocument();

    mocks.getWidgets.mockResolvedValueOnce({ widgets: [], designs: [] });
    fireEvent.click(screen.getByRole("button", { name: "Retry discovery" }));
    expect(await screen.findByText("Your workspace is ready")).toBeInTheDocument();
    expect(screen.getByText("0 pinned instances on this device")).toBeInTheDocument();
  });

  it("retains the last confirmed widget list after a later discovery failure", async () => {
    mocks.getWidgets
      .mockResolvedValueOnce({ widgets: [widget], designs: [] })
      .mockRejectedValueOnce(new Error("Temporary Android manager failure"));
    render(<WidgetStudioPage onBack={vi.fn()} />);

    expect(await screen.findByText("1 pinned instance on this device")).toBeInTheDocument();
    window.dispatchEvent(new Event("focus"));
    expect(await screen.findByText(/last confirmed instance/)).toBeInTheDocument();
    expect(screen.getByText(/previously confirmed widget list and saved settings are being kept/)).toBeInTheDocument();
    expect(screen.getByText(/Widget #42/)).toBeInTheDocument();
  });

  it("resets only the selected instance after an explicit confirmation", async () => {
    mocks.getWidgets.mockResolvedValue({
      widgets: [widget],
      designs: [{ id: "hero_wide", name: "Hero Wide · Blue Neon" }],
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<WidgetStudioPage onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Reset to default" }));
    await waitFor(() => expect(mocks.resetWidget).toHaveBeenCalledWith({ appWidgetId: 42 }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("restored to its default settings");
    confirm.mockRestore();
  });

  it("explains launcher-owned resize, ordering and removal instead of exposing fake controls", async () => {
    mocks.getWidgets.mockResolvedValue({ widgets: [widget] });
    render(<WidgetStudioPage onBack={vi.fn()} />);

    expect(await screen.findByText(/Resize the widget on your home screen/)).toBeInTheDocument();
    expect(screen.getByText(/Android owns their placement and order/)).toBeInTheDocument();
    expect(screen.getByText(/Android does not expose an in-app unpin API/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove widget/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("consumes nested Back events and reports Widget Studio visibility to the app router", () => {
    const onBack = vi.fn();
    const visibility = vi.fn();
    window.addEventListener("widget-studio-page-state", visibility);
    const { unmount } = render(<WidgetStudioPage onBack={onBack} />);

    expect(visibility).toHaveBeenLastCalledWith(expect.objectContaining({
      detail: { open: true },
    }));
    window.dispatchEvent(new CustomEvent("widget-studio-back"));
    expect(onBack).toHaveBeenCalledTimes(1);

    unmount();
    expect(visibility).toHaveBeenLastCalledWith(expect.objectContaining({
      detail: { open: false },
    }));
    window.removeEventListener("widget-studio-page-state", visibility);
  });

  it("does not call native widget APIs outside Android", async () => {
    mocks.native = false;
    render(<WidgetStudioPage onBack={vi.fn()} />);

    expect(await screen.findByText("Android widgets are managed on your device")).toBeInTheDocument();
    expect(mocks.getWidgets).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add Widget" })).not.toBeInTheDocument();
  });
});
