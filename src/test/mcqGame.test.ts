import { describe, expect, it } from "vitest";
import { buildMCQGameOptions } from "@/lib/mcqGame";

describe("MCQ with Game options", () => {
  it("preserves a valid four-option quiz question and its display mapping", () => {
    const options = ["26", "28", "22", "33"];
    const result = buildMCQGameOptions(options, 28);

    expect(result).toHaveLength(4);
    expect(result.map((option) => option.value)).toEqual(options);
    expect(result.map((option) => option.sourceIndex)).toEqual([0, 1, 2, 3]);
    expect(result.filter((option) => String(option.value) === "28")).toHaveLength(1);
  });

  it("repairs duplicate or missing options using the available option pool", () => {
    const result = buildMCQGameOptions(["26", "26", "22"], "28", ["33", "22", "26"]);

    expect(result).toHaveLength(4);
    expect(new Set(result.map((option) => String(option.value))).size).toBe(4);
    expect(result.filter((option) => String(option.value) === "28")).toHaveLength(1);
    expect(result.every((option) => option.sourceIndex === null || option.sourceIndex < 3)).toBe(true);
  });

  it("adds safe numeric distractors when the existing question pool is underspecified", () => {
    const result = buildMCQGameOptions(["7"], 8);

    expect(result).toHaveLength(4);
    expect(new Set(result.map((option) => String(option.value))).size).toBe(4);
    expect(result.filter((option) => String(option.value) === "8")).toHaveLength(1);
  });

  it("keeps repaired option order stable across rerenders of the same question", () => {
    const source = ["7"];
    const first = buildMCQGameOptions(source, 8);
    const second = buildMCQGameOptions(source, 8);

    expect(second).toEqual(first);
    expect(second.map((option) => option.value)).toEqual(first.map((option) => option.value));
  });

  it("keeps nonnumeric answer choices unique when repairing text questions", () => {
    const result = buildMCQGameOptions(["H", "He"], "Li", ["Be"]);

    expect(result).toHaveLength(4);
    expect(new Set(result.map((option) => String(option.value))).size).toBe(4);
    expect(result.filter((option) => String(option.value) === "Li")).toHaveLength(1);
  });
});
