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

vi.mock("@/lib/settings", () => ({
  getSettings: () => ({ sound: true, vibration: false, keyboardShortcuts: true, font: "space-grotesk" }),
  setSound: (sound: boolean) => ({ sound, vibration: false, keyboardShortcuts: true, font: "space-grotesk" }),
  setVibration: (vibration: boolean) => ({ sound: true, vibration, keyboardShortcuts: true, font: "space-grotesk" }),
  setKeyboardShortcuts: (keyboardShortcuts: boolean) => ({ sound: true, vibration: false, keyboardShortcuts, font: "space-grotesk" }),
}));

vi.mock("@/lib/streak", () => ({
  getStreak: () => ({
    enabled: true,
    targetMinutes: 15,
    current: 2,
    best: 4,
    freezeUsedMonth: "2026-10",
    freezesUsed: 0,
    days: {},
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
}));

describe("SettingsPanel compact controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.theme = "arctic-blue";
    mocks.mode = "dark";
    mocks.getBackgroundNotificationsEnabled.mockReturnValue(true);
    mocks.setBackgroundNotificationsEnabled.mockResolvedValue(true);
    mocks.checkForAppUpdate.mockResolvedValue({ status: "current" });
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

  it("uses a compact selectable grid for every existing theme and preserves theme/mode actions", () => {
    render(<SettingsPanel />);

    const themeButtons = screen.getAllByRole("button", { name: /^Select .* theme$/ });
    expect(themeButtons).toHaveLength(THEMES.length);
    expect(screen.getByRole("button", { name: "Select Arctic Blue theme" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Select Mint theme" }));
    expect(mocks.setTheme).toHaveBeenCalledWith("mint");

    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(mocks.setMode).toHaveBeenCalledWith("light");

    const grid = themeButtons[0].parentElement;
    expect(grid).toHaveClass("grid", "grid-cols-3");
  });
});
