import { describe, expect, it } from "vitest";
import {
  getPeriodicRangeElements,
  movePeriodicRangeIndex,
  PERIODIC_RANGES,
} from "@/lib/periodicRanges";

describe("Periodic Table ranges", () => {
  it("contains the exact required 12 ranges", () => {
    expect(PERIODIC_RANGES.map((range) => range.label)).toEqual([
      "1–10",
      "11–20",
      "21–30",
      "31–40",
      "41–50",
      "51–60",
      "61–70",
      "71–80",
      "81–90",
      "91–100",
      "101–110",
      "111–118",
    ]);
  });

  it("returns only elements from the selected range", () => {
    expect(getPeriodicRangeElements(0).map((el) => el.number)).toEqual(
      Array.from({ length: 10 }, (_, i) => i + 1),
    );
    expect(getPeriodicRangeElements(11).map((el) => el.number)).toEqual(
      Array.from({ length: 8 }, (_, i) => i + 111),
    );
  });

  it("moves next and previous without crossing the boundaries", () => {
    expect(movePeriodicRangeIndex(0, -1)).toBe(0);
    expect(movePeriodicRangeIndex(0, 1)).toBe(1);
    expect(movePeriodicRangeIndex(11, 1)).toBe(11);
    expect(movePeriodicRangeIndex(11, -1)).toBe(10);
  });
});
