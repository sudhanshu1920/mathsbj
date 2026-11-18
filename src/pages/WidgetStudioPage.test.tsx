import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WidgetStudioPage from "./WidgetStudioPage";

const mocks = vi.hoisted(() => ({
  native: true,
  getWidgets: vi.fn(),
  requestAdd: vi.fn(),
  configureWidget: vi.fn(),
  renderPreview: vi.fn(),
  resetWidget: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mocks.native },
  registerPlugin: () => ({
    getWidgets: mocks.getWidgets,
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
    mocks.requestAdd.mockResolvedValue({ requested: true, supported: true });
    mocks.configureWidget.mockResolvedValue({ opened: true });
    mocks.renderPreview.mockResolvedValue({ dataUrl: "data:image/png;base64,d2lkZ2V0" });
    mocks.resetWidget.mockResolvedValue({ reset: true });
    mocks.addListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
  });

  it("shows the useful empty state and opens Android's real add confirmation", async () => {
    render(<WidgetStudioPage onBack={vi.fn()} />);

    expect(await screen.findByText("Your workspace is ready")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Widgets" }));

    await waitFor(() => expect(mocks.requestAdd).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent("Android has opened its Add Widget confirmation");
  });

  it("lists pinned instances, shows the native renderer preview and opens the existing editor", async () => {
    mocks.getWidgets.mockResolvedValue({ widgets: [widget], designs: [{ id: "hero_wide", name: "Hero Wide · Blue Neon" }] });
    render(<WidgetStudioPage onBack={vi.fn()} />);

    expect((await screen.findAllByText(/Hero Wide/)).length).toBeGreaterThan(0);
    const preview = await screen.findByRole("img", { name: "Live preview of the selected Math Master widget" });
    expect(preview).toHaveAttribute("src", "data:image/png;base64,d2lkZ2V0");
    expect(screen.getByText("320 × 146 dp")).toBeInTheDocument();

    const expandPreview = screen.getByRole("button", { name: "Expand widget preview" });
    fireEvent.click(expandPreview);
    expect(screen.getByRole("button", { name: "Collapse widget preview" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Collapse widget preview" }));
    expect(screen.getByRole("button", { name: "Expand widget preview" })).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Customize this widget" }));
    await waitFor(() => expect(mocks.configureWidget).toHaveBeenCalledWith({ appWidgetId: 42 }));
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
