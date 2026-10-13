import { afterEach, describe, expect, it, vi } from "vitest";

describe("offline-only build configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not initialize Supabase even when valid cloud credentials are present", async () => {
    vi.stubEnv("VITE_OFFLINE_MODE", "true");
    vi.stubEnv("VITE_SUPABASE_URL", "https://offline-test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key-long-enough");

    const client = await import("./client");

    expect(client.offlineOnlyMode).toBe(true);
    expect(client.supabaseConfigured).toBe(false);
    expect(client.supabase).toBeNull();
  });
});
