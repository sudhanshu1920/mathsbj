import { describe, expect, it } from "vitest";
import {
  getStudyModeStatus,
  setStudyModeScreenTimeIsland,
} from "./studyMode";

describe("Screen Time Island settings bridge", () => {
  it("defaults to enabled at five minutes without native Android", async () => {
    const status = await getStudyModeStatus();
    expect(status.screenTimeIslandEnabled).toBe(true);
    expect(status.screenTimeIslandIntervalMinutes).toBe(5);
  });

  it.each([0, -1, 11, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid interval before invoking the native bridge (%s)",
    async (minutes) => {
      await expect(setStudyModeScreenTimeIsland(true, minutes))
        .rejects.toThrow("integer from 1 to 10 minutes");
    },
  );

  it("rejects a non-boolean enabled value", async () => {
    await expect(setStudyModeScreenTimeIsland(1 as unknown as boolean, 5))
      .rejects.toThrow("enabled state must be a boolean");
  });

  it("requires Android for valid setting writes", async () => {
    await expect(setStudyModeScreenTimeIsland(false, 5))
      .rejects.toThrow("requires the Android app");
  });
});
