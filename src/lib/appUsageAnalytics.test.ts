import { describe, expect, it } from "vitest";
import {
  formatUsageDate,
  formatUsageDuration,
  getUsageRangeWindow,
  localDateKey,
} from "@/lib/appUsageAnalytics";

describe("app usage analytics ranges", () => {
  const now = new Date(2026, 10, 5, 14, 35, 0);

  it("uses local midnight boundaries for Today", () => {
    const window = getUsageRangeWindow("today", undefined, undefined, now);
    const tomorrow = new Date(2026, 10, 6, 0, 0, 0, 0);
    expect(window.fromDate).toBe("2026-11-05");
    expect(window.toDate).toBe("2026-11-05");
    expect(window.startTimeMs).toBe(new Date(2026, 10, 5, 0, 0, 0, 0).getTime());
    expect(window.endTimeMs).toBe(tomorrow.getTime());
  });

  it("includes exactly seven and thirty local calendar days", () => {
    const seven = getUsageRangeWindow("7d", undefined, undefined, now);
    const thirty = getUsageRangeWindow("30d", undefined, undefined, now);
    expect(seven.fromDate).toBe("2026-10-30");
    expect(seven.toDate).toBe("2026-11-05");
    expect(thirty.fromDate).toBe("2026-10-07");
    expect(thirty.toDate).toBe("2026-11-05");
  });

  it("treats custom end dates as inclusive and returns an exclusive end timestamp", () => {
    const window = getUsageRangeWindow("custom", "2026-10-31", "2026-11-02", now);
    expect(window.fromDate).toBe("2026-10-31");
    expect(window.toDate).toBe("2026-11-02");
    expect(window.endTimeMs).toBe(new Date(2026, 10, 3, 0, 0, 0, 0).getTime());
  });

  it("validates custom ranges and caps them at 180 days", () => {
    expect(() => getUsageRangeWindow("custom", "", "2026-11-05", now)).toThrow();
    expect(() => getUsageRangeWindow("custom", "2026-11-06", "2026-11-05", now)).toThrow();
    expect(() => getUsageRangeWindow("custom", "2026-01-01", "2026-07-01", now)).toThrow(/180 days/);
  });

  it("counts local calendar dates rather than assuming every day is 24 hours", () => {
    const window = getUsageRangeWindow("custom", "2026-03-07", "2026-03-10", now);
    expect(window.fromDate).toBe("2026-03-07");
    expect(window.toDate).toBe("2026-03-10");
    const start = new Date("2026-03-07T12:00:00");
    const end = new Date("2026-03-10T12:00:00");
    expect(localDateKey(start)).toBe("2026-03-07");
    expect(localDateKey(end)).toBe("2026-03-10");
  });
});

describe("app usage formatting", () => {
  it("formats duration without creating sample values", () => {
    expect(formatUsageDuration(0)).toBe("0m");
    expect(formatUsageDuration(59_999)).toBe("0m");
    expect(formatUsageDuration(60_000)).toBe("1m");
    expect(formatUsageDuration(3_600_000)).toBe("1h");
    expect(formatUsageDuration(5_520_000)).toBe("1h 32m");
    expect(formatUsageDuration(-100)).toBe("0m");
  });

  it("formats a local calendar date for compact chart labels", () => {
    expect(formatUsageDate("2026-11-05")).not.toBe("2026-11-05");
    expect(formatUsageDate("invalid")).toBe("invalid");
  });
});
