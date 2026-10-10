import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppUpdateManager from "./AppUpdateManager";
import { UPDATE_AVAILABLE_EVENT } from "@/lib/appUpdateEvents";
import { EXPECTED_APK_URL, EXPECTED_PACKAGE_NAME } from "@/lib/updateFeed";

const mocks = vi.hoisted(() => ({
  checkForAppUpdate: vi.fn(),
  installAppUpdate: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock("@/lib/appUpdateService", () => ({
  checkForAppUpdate: mocks.checkForAppUpdate,
  installAppUpdate: mocks.installAppUpdate,
}));

vi.mock("@capacitor/app", () => ({
  App: { addListener: mocks.addListener },
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
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.checkForAppUpdate.mockResolvedValue(availableResult());
    mocks.installAppUpdate.mockResolvedValue({ status: "started", platform: "android", downloadId: 42 });
    mocks.addListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
  });

  it("shows the actual installed and latest versions from the live release check", async () => {
    render(<AppUpdateManager isQuizActive={false} />);

    expect(await screen.findByText("New Update Available!")).toBeInTheDocument();
    expect(screen.getByText(/v1\.0\.1 \(build 1136\)/)).toBeInTheDocument();
    expect(screen.getByText(/v1\.0\.2 \(build 1137\)/)).toBeInTheDocument();
    expect(screen.getByText("Fix update notifications.")).toBeInTheDocument();
    expect(mocks.checkForAppUpdate).toHaveBeenCalledTimes(1);
  });

  it("dismisses only for the current app session and rechecks on the next launch", async () => {
    // Ignore the persistent dismissal marker left by older versions of the app.
    localStorage.setItem("mathmaster.dismissed-update-version-code", "1137");
    const firstLaunch = render(<AppUpdateManager isQuizActive={false} />);

    expect(await screen.findByText("New Update Available!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByText("New Update Available!")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT, {
        detail: { update: latest, force: true },
      }));
    });
    expect(screen.queryByText("New Update Available!")).not.toBeInTheDocument();

    firstLaunch.unmount();
    render(<AppUpdateManager isQuizActive={false} />);
    expect(await screen.findByText("New Update Available!")).toBeInTheDocument();
    await waitFor(() => expect(mocks.checkForAppUpdate).toHaveBeenCalledTimes(2));
  });

  it("starts the trusted APK update only after Update Now is clicked", async () => {
    render(<AppUpdateManager isQuizActive={false} />);

    expect(await screen.findByText("New Update Available!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update Now" }));

    await waitFor(() => expect(mocks.installAppUpdate).toHaveBeenCalledWith(latest));
    expect(await screen.findByText("Update download started")).toBeInTheDocument();
    expect(screen.queryByText("New Update Available!")).not.toBeInTheDocument();
  });
});
