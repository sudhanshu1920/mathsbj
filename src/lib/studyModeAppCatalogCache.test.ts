import { describe, expect, it, vi } from "vitest";
import { createAsyncCache } from "./studyModeAppCatalogCache";

describe("createAsyncCache", () => {
  it("reuses a value until its TTL expires", async () => {
    let now = 100;
    const load = vi.fn(async () => ["apps"]);
    const cache = createAsyncCache(load, 500, () => now);

    await expect(cache.get()).resolves.toEqual(["apps"]);
    await expect(cache.get()).resolves.toEqual(["apps"]);
    expect(load).toHaveBeenCalledTimes(1);

    now = 601;
    await cache.get();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent loads", async () => {
    let resolveLoad!: (value: string[]) => void;
    const load = vi.fn(() => new Promise<string[]>((resolve) => { resolveLoad = resolve; }));
    const cache = createAsyncCache(load, 1_000);

    const first = cache.get();
    const second = cache.get();
    expect(load).toHaveBeenCalledTimes(0);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);

    resolveLoad(["shared"]);
    await expect(Promise.all([first, second])).resolves.toEqual([["shared"], ["shared"]]);
  });

  it("does not cache a result invalidated while loading", async () => {
    let resolveFirst!: (value: string[]) => void;
    const load = vi.fn()
      .mockImplementationOnce(() => new Promise<string[]>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(["fresh"]);
    const cache = createAsyncCache(load, 1_000);

    const staleRequest = cache.get();
    await Promise.resolve();
    cache.clear();
    resolveFirst(["stale"]);
    await staleRequest;

    await expect(cache.get()).resolves.toEqual(["fresh"]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not cache rejected loads", async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(["recovered"]);
    const cache = createAsyncCache(load, 1_000);

    await expect(cache.get()).rejects.toThrow("temporary");
    await expect(cache.get()).resolves.toEqual(["recovered"]);
  });
});
