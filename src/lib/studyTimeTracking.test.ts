import { describe, expect, it } from "vitest";
import { shouldCountLearningStudySecond } from "./studyTimeTracking";

describe("Learning Mode daily study-time tracking policy", () => {
  it("counts only a visible, opened learning topic", () => {
    expect(shouldCountLearningStudySecond({
      activeTopic: "tables",
      practiceSelectorOpen: false,
      visibilityState: "visible",
    })).toBe(true);
  });

  it.each([
    [null, false, "visible"],
    ["tables", true, "visible"],
    ["tables", false, "hidden"],
  ] as const)("does not count topic=%s selector=%s visibility=%s", (
    activeTopic,
    practiceSelectorOpen,
    visibilityState,
  ) => {
    expect(shouldCountLearningStudySecond({
      activeTopic,
      practiceSelectorOpen,
      visibilityState,
    })).toBe(false);
  });
});
