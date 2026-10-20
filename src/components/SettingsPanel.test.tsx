import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPanel from "./SettingsPanel";
import { THEMES } from "@/lib/theme";

const mocks = vi.hoisted(() => ({
  theme: "arctic-blue",
  mode: "dark",
  setTheme: vi.fn(),
  setMode: vi.fn(),
  setGuest: vi.fn(),
  checkForAppUpdate: vi.fn(),
  announceUpdateAvailable: vi.fn(),
  getBackgroundNotificationsEnabled: vi.fn(),
  setBackgroundNotificationsEnabled: vi.fn(),
}));

vi.mock("@/lib/appVersion", () => ({ APP_VERSION_NAME: "1.0.0", APP_VERSION_CODE: 1 }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}));

vi.mock("@/lib/settings", () => {
  const base = () => ({
    sound: true,
    vibration: false,
    keyboardShortcuts: true,
    font: "space-grotesk",
  });
  return {
    getSettings: base,
    setSound: (sound: boolean) => ({ ...base(), sound }),
    setVibration: (vibration: boolean) => ({ ...base(), vibration }),
    setKeyboardShortcuts: (keyboardShortcuts: boolean) => ({ ...base(), keyboardShortcuts }),
    setHomeScreenWidgetsEnabled: (enabled: boolean) => ({ ...base(), homeScreenWidgetsEnabled: enabled }),
    setHomeWidgetContent: (homeWidgetContent: string[]) => ({ ...base(), homeWidgetContent }),
    setHomeWidgetStyle: (homeWidgetStyle: string) => ({ ...base(), homeWidgetStyle }),
    setHomeWidgetTheme: (homeWidgetTheme: string) => ({ ...base(), homeWidgetTheme }),
    setHomeWidgetComposition: (homeWidgetComposition: string) => {
      mocks.setHomeWidgetComposition(homeWidgetComposition);
      return { ...base(), homeWidgetComposition };
    },
    HOME_WIDGET_COMPOSITIONS: [
      { id: "auto", label: "Auto Responsive" },
      { id: "hero_wide", label: "Hero Wide · Sunset" },
      { id: "compact_green", label: "Compact Green" },
      { id: "square_math_bot", label: "Square Math Bot" },
      { id: "medium_study", label: "Medium Study" },
      { id: "square_cosmic", label: "Square Cosmic" },
      { id: "extra_wide_weekly", label: "Extra-Wide Weekly" },
      { id: "minimal_progress", label: "Minimal Progress" },
    ],
  };
});

vi.mock("@/lib/streak", () => ({
  todayStr: () => "2026-10-18",
  getStreak: () => ({
    enabled: true,
    targetMinutes: 15,
    current: 2,
    best: 4,
    freezeUsedMonth: "2026-10",
    freezesUsed: 0,
    days: { "2026-10-18": { seconds: 120 } },
    lastEvalDate: "2026-10-18",
  }),
  setTarget: vi.fn(() => ({
    enabled: true,
    targetMinutes: 15,
    current: 2,
    best: 4,
    freezeUsedMonth: "2026-10",
    freezesUsed: 0,
    days: {},
    lastEvalDate: "2026-10-18",
  })),
}));

vi.mock("@/lib/guest", () => ({
  isGuest: () => true,
  setGuest: mocks.setGuest,
}));

vi.mock("@/lib/theme", async () => {
  const actual = await vi.importActual<typeof import("@/lib/theme")>("@/lib/theme");
  return {
    ...actual,
    setTheme: mocks.setTheme,
    setMode: mocks.setMode,
    useTheme: () => mocks.theme,
    useMode: () => mocks.mode,
  };
});

vi.mock("@/lib/appUpdateService", () => ({
  checkForAppUpdate: mocks.checkForAppUpdate,
}));

vi.mock("@/lib/appUpdateEvents", () => ({
  announceUpdateAvailable: mocks.announceUpdateAvailable,
}));

vi.mock("@/lib/dailyTargetReminders", () => ({
  getBackgroundNotificationsEnabled: mocks.getBackgroundNotificationsEnabled,
  setBackgroundNotificationsEnabled: mocks.setBackgroundNotificationsEnabled,
  syncHomeWidgetPreferences: mocks.syncHomeWidgetPreferences,
  refreshHomeWidget: mocks.refreshHomeWidget,
}));

describe("SettingsPanel compact controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.theme = "arctic-blue";
    mocks.mode = "dark";
    mocks.getBackgroundNotificationsEnabled.mockReturnValue(true);
    mocks.setBackgroundNotificationsEnabled.mockResolvedValue(true);
    mocks.syncHomeWidgetPreferences.mockResolvedValue(true);
    mocks.checkForAppUpdate.mockResolvedValue({ status: "current" });
  });

  it("does not expose home-screen widget controls", () => {
    render(<SettingsPanel />);

    expect(screen.queryByText("Home Screen Widgets")).not.toBeInTheDocument();
    expect(screen.queryByText("Widget Content")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Preview/ })).not.toBeInTheDocument();
  });

  it("removes the font selector without removing the normal settings controls", () => {
    const { container } = render(<SettingsPanel />);

    expect(container.querySelector("[data-font-selector]")).toBeNull();
    expect(screen.queryByText("Font")).not.toBeInTheDocument();
    expect(screen.getByText("Sound")).toBeInTheDocument();
    expect(screen.getByText("Vibration")).toBeInTheDocument();
    expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument();
  });

  it("keeps the notification toggle and removes its supporting paragraphs", async () => {
    render(<SettingsPanel />);

    const toggle = screen.getByRole("switch", { name: "Enable background notifications" });
    expect(toggle).toBeInTheDocument();
    expect(screen.queryByText(/Daily study reminders start at noon/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Permission is requested only when you turn this on/)).not.toBeInTheDocument();

    fireEvent.click(toggle);
    await waitFor(() => expect(mocks.setBackgroundNotificationsEnabled).toHaveBeenCalledWith(false));
  });

  it("renders every theme in a compact responsive selector and preserves theme/mode actions", () => {
    const { container, rerender } = render(<SettingsPanel />);

    const themeButtons = screen.getAllByRole("button", { name: /^Select .* theme$/ });
    expect(themeButtons).toHaveLength(THEMES.length);
    expect(screen.getByRole("button", { name: "Select Arctic Blue theme" })).toHaveAttribute("aria-pressed", "true");

    for (const theme of THEMES) {
      expect(screen.getByText(theme.name)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: `Select ${theme.name} theme` })).toHaveAttribute("aria-pressed");
    }

    const grid = container.querySelector("[data-theme-selector-grid]");
    expect(grid).toHaveClass("grid", "grid-cols-2", "min-[420px]:grid-cols-3", "md:grid-cols-4");
    expect(grid?.querySelectorAll("[data-theme-option]")).toHaveLength(THEMES.length);
    expect(grid?.querySelectorAll("[data-theme-swatch]")).toHaveLength(THEMES.length * 3);

    fireEvent.click(screen.getByRole("button", { name: "Select Mint theme" }));
    expect(mocks.setTheme).toHaveBeenCalledWith("mint");

    mocks.theme = "mint";
    rerender(<SettingsPanel />);
    expect(screen.getByRole("button", { name: "Select Mint theme" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Select Arctic Blue theme" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(mocks.setMode).toHaveBeenCalledWith("light");
  });
});
