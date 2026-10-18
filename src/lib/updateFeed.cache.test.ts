import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const manifest = (versionCode: number) => ({
  packageName: "com.sudhanshu.mathsbj",
  versionCode,
  versionName: "1.0.12",
  apkUrl: "https://github.com/sudhanshu1920/mathsbj-updates/releases/download/latest/MathMaster-release.apk",
  sha256: "a".repeat(64),
});

const responseFor = (payload: unknown) => ({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue(payload),
}) as unknown as Response;

describe("release manifest request cache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T09:00:00.000Z"));
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("coalesces concurrent checks and reuses the validated manifest for a short window", async () => {
    const fetchMock = vi.fn().mockResolvedValue(responseFor(manifest(1147)));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchLatestRelease } = await import("./updateFeed");

    const [first, second] = await Promise.all([fetchLatestRelease(), fetchLatestRelease()]);
    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const cached = await fetchLatestRelease();
    expect(cached).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes the manifest once the short cache lifetime expires", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(responseFor(manifest(1147)))
      .mockResolvedValueOnce(responseFor(manifest(1148)));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchLatestRelease, RELEASE_MANIFEST_CACHE_TTL_MS } = await import("./updateFeed");

    expect((await fetchLatestRelease()).versionCode).toBe(1147);
    await vi.advanceTimersByTimeAsync(RELEASE_MANIFEST_CACHE_TTL_MS - 1);
    expect((await fetchLatestRelease()).versionCode).toBe(1147);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2);
    expect((await fetchLatestRelease()).versionCode).toBe(1148);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("supports forcing a fresh manifest when caller needs an immediate authoritative check", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(responseFor(manifest(1147)))
      .mockResolvedValueOnce(responseFor(manifest(1148)));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchLatestRelease } = await import("./updateFeed");

    expect((await fetchLatestRelease()).versionCode).toBe(1147);
    expect((await fetchLatestRelease(true)).versionCode).toBe(1148);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
