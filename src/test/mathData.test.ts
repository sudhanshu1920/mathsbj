import { describe, expect, it } from "vitest";
import { getTable, getPowers } from "@/lib/mathData";
import { ELEMENTS, getElement } from "@/lib/periodicTable";

describe("Learning data", () => {
  it("returns the requested multiplication table length and values", () => {
    expect(getTable(12, 10)).toHaveLength(10);
    expect(getTable(12, 10)[0]).toEqual({ expression: "12 × 1", answer: 12 });
    expect(getTable(12, 10)[9]).toEqual({ expression: "12 × 10", answer: 120 });
  });

  it("returns power rows with increasing exponents", () => {
    const rows = getPowers(5, 5);
    expect(rows.map((row) => row.exponent)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.map((row) => row.answer)).toEqual([5, 25, 125, 625, 3125]);
  });
});

describe("Periodic table data", () => {
  it("contains all 118 elements in atomic-number order", () => {
    expect(ELEMENTS).toHaveLength(118);
    expect(ELEMENTS[0].number).toBe(1);
    expect(ELEMENTS[117].number).toBe(118);
  });

  it("keeps element lookup aligned with atomic number", () => {
    expect(getElement(17)?.symbol).toBe("Cl");
    expect(getElement(29)?.symbol).toBe("Cu");
    expect(getElement(118)?.symbol).toBe("Og");
  });
});
