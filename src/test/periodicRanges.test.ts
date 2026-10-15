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

  it("covers atomic numbers 1–118 exactly once with no overlap or gaps", () => {
    const allNumbers = PERIODIC_RANGES.flatMap((_, index) =>
      getPeriodicRangeElements(index).map((element) => element.number),
    );

    expect(allNumbers).toEqual(Array.from({ length: 118 }, (_, index) => index + 1));
    expect(new Set(allNumbers).size).toBe(118);
    expect(getPeriodicRangeElements(10).map((element) => element.number)).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 101),
    );
    expect(getPeriodicRangeElements(11).map((element) => element.number)).toEqual(
      Array.from({ length: 8 }, (_, index) => index + 111),
    );
  });

  it("preserves known standard weights and isotope mass-number formatting", () => {
    const hydrogen = getPeriodicRangeElements(0)[0];
    const scandium = getPeriodicRangeElements(2)[0];
    const oganesson = getPeriodicRangeElements(11).at(-1);

    expect([hydrogen.name, hydrogen.symbol, hydrogen.mass]).toEqual(["Hydrogen", "H", 1.008]);
    expect([scandium.name, scandium.symbol, scandium.mass]).toEqual(["Scandium", "Sc", 44.956]);
    expect(oganesson && [oganesson.name, oganesson.symbol, oganesson.mass, oganesson.radioactive]).toEqual([
      "Oganesson", "Og", 294, true,
    ]);
  });

  it("moves next and previous without crossing the boundaries", () => {
    expect(movePeriodicRangeIndex(0, -1)).toBe(0);
    expect(movePeriodicRangeIndex(0, 1)).toBe(1);
    expect(movePeriodicRangeIndex(11, 1)).toBe(11);
    expect(movePeriodicRangeIndex(11, -1)).toBe(10);
  });
});
