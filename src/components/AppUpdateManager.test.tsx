import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppUpdateManager from "./AppUpdateManager";
import { UPDATE_AVAILABLE_EVENT } from "@/lib/appUpdateEvents";
import { EXPECTED_APK_URL, EXPECTED_PACKAGE_NAME } from "@/lib/updateFeed";

const mocks = vi.hoisted(() => ({
  checkForAppUpdate: vi.fn(),
  installAppUpdate: vi.fn(),
  downloadAppUpdate: vi.fn(),
  addListener: vi.fn(),
  addAndroidUpdateDownloadListener: vi.fn(),
  downloadStateListener: undefined as ((event: {
    downloadId: number;
    state: "downloading" | "paused" | "verifying" | "installer_opened" | "saved_to_downloads" | "failed";
    progress: number;
    fileName?: string;
    message?: string;
  }) => void) | undefined,
}));

vi.mock("@/lib/appUpdateService", () => ({
  checkForAppUpdate: mocks.checkForAppUpdate,
  installAppUpdate: mocks.installAppUpdate,
  downloadAppUpdate: mocks.downloadAppUpdate,
}));

vi.mock("@/nativeAppUpdater", () => ({
  addAndroidUpdateDownloadListener: mocks.addAndroidUpdateDownloadListener,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
}));

vi.mock("@capacitor/app", () => ({
  App: { addListener: mocks.addListener },
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

const latest = {
  packageName: EXPECTED_PACKAGE_NAME,
  versionCode: 1137,
  versionName: "1.0.2",
  apkUrl: EXPECTED_APK_URL,
  sha256: "a".repeat(64),
  releaseNotes: "Fix update notifications.",
};

function availableResult() {
  return {
    status: "available" as const,
    update: latest,
    latest,
    currentVersionCode: 1136,
    currentVersionName: "1.0.1",
    platform: "android" as const,
  };
}

describe("AppUpdateManager", () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.downloadStateListener = undefined;
    mocks.checkForAppUpdate.mockResolvedValue(availableResult());
    mocks.installAppUpdate.mockResolvedValue({ status: "started", platform: "android", downloadId: 42 });
    mocks.downloadAppUpdate.mockResolvedValue({ status: "started", platform: "android", downloadId: 43, update: latest });
    mocks.addListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
    mocks.addAndroidUpdateDownloadListener.mockImplementation(async (listener) => {
      mocks.downloadStateListener = listener;
      return { remove: vi.fn().mockResolvedValue(undefined) };
    });
  });

  it("shows the latest version and both update choices without redundant copy", async () => {
    render(<AppUpdateManager isQuizActive={false} />);

    expect(await screen.findByText("New Update Available")).toBeInTheDocument();
    expect(screen.getByText("v1.0.2")).toBeInTheDocument();
    expect(screen.queryByText(/Current version:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Fix update notifications.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose how you want to update/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update Now" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Download APK" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Later" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Later" }).className).toContain("col-span-2");
    expect(mocks.checkForAppUpdate).toHaveBeenCalledTimes(1);
  });;

  it("dismisses only for the current app session and rechecks on the next launch", async () => {
    localStorage.setItem("mathmaster.dismissed-update-version-code", "1137");
    const firstLaunch = render(<AppUpdateManager isQuizActive={false} />);

    expect(await screen.findByText("New Update Available")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByText("New Update Available")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT, {
        detail: { update: latest, force: true },
      }));
    });
    expect(screen.queryByText("New Update Available")).not.toBeInTheDocument();

    firstLaunch.unmount();
    render(<AppUpdateManager isQuizActive={false} />);
    expect(await screen.findByText("New Update Available")).toBeInTheDocument();
    await waitFor(() => expect(mocks.checkForAppUpdate).toHaveBeenCalledTimes(2));
  });

  it("does not show an update alert when the installed version is current", async () => {
    mocks.checkForAppUpdate.mockResolvedValue({
      status: "current",
      latest,
      currentVersionCode: latest.versionCode,
      currentVersionName: latest.versionName,
      platform: "android",
    });

    render(<AppUpdateManager isQuizActive={false} />);
    await waitFor(() => expect(mocks.checkForAppUpdate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("New Update Available")).not.toBeInTheDocument();
  });

  it("rechecks on foreground return but does not reopen an update dismissed with Later in the same session", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(100_000);
    render(<AppUpdateManager isQuizActive={false} />);

    expect(await screen.findByText("New Update Available")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    now.mockReturnValue(102_000);

    await act(async () => {
      fireEvent.focus(window);
      await Promise.resolve();
    });

    await waitFor(() => expect(mocks.checkForAppUpdate).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("New Update Available")).not.toBeInTheDocument();
  });

  it("starts Update Now only when selected and waits for verified installer-open status", async () => {
    render(<AppUpdateManager isQuizActive={false} />);
    expect(await screen.findByText("New Update Available")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Update Now" }));
    await waitFor(() => expect(mocks.installAppUpdate).toHaveBeenCalledWith(latest));
    expect(mocks.downloadAppUpdate).not.toHaveBeenCalled();
    expect(screen.getByText(/Downloading the verified update APK/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download APK" })).toBeDisabled();

    act(() => mocks.downloadStateListener?.({
      downloadId: 42, state: "installer_opened", progress: 100,
    }));
    await waitFor(() => expect(screen.queryByText("New Update Available")).not.toBeInTheDocument());
  });

  it("downloads a verified APK to Downloads only when selected and never starts installation", async () => {
    render(<AppUpdateManager isQuizActive={false} />);
    expect(await screen.findByText("New Update Available")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Download APK" }));
    await waitFor(() => expect(mocks.downloadAppUpdate).toHaveBeenCalledWith(latest));
    expect(mocks.installAppUpdate).not.toHaveBeenCalled();
    expect(screen.getByText(/Downloading APK to device storage/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update Now" })).toBeDisabled();

    act(() => mocks.downloadStateListener?.({
      downloadId: 43, state: "saved_to_downloads", progress: 100, fileName: "MathApp-v1.0.2.apk",
    }));
    await waitFor(() => expect(screen.queryByText("New Update Available")).not.toBeInTheDocument());
    expect(mocks.installAppUpdate).not.toHaveBeenCalled();
  });

  it("shows Android-paused download state without falsely marking completion", async () => {
    render(<AppUpdateManager isQuizActive={false} />);
    expect(await screen.findByText("New Update Available")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download APK" }));
    await waitFor(() => expect(mocks.downloadAppUpdate).toHaveBeenCalledWith(latest));

    act(() => mocks.downloadStateListener?.({
      downloadId: 43, state: "paused", progress: 28, message: "Android paused this download.",
    }));
    expect(screen.getByText(/Download paused by Android/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "28");
    expect(screen.getByRole("button", { name: "Update Now" })).toBeDisabled();
    expect(mocks.installAppUpdate).not.toHaveBeenCalled();
  });

  it("shows failures from a background download and keeps retry possible", async () => {
    render(<AppUpdateManager isQuizActive={false} />);
    expect(await screen.findByText("New Update Available")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download APK" }));
    await waitFor(() => expect(mocks.downloadAppUpdate).toHaveBeenCalledWith(latest));

    act(() => mocks.downloadStateListener?.({
      downloadId: 43, state: "failed", progress: 0, message: "The APK download failed. Check the network and retry.",
    }));
    expect(await screen.findByText(/APK download failed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download APK" })).toBeEnabled();
  });
});
