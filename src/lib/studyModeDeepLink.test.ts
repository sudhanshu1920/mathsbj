import { describe, expect, it } from "vitest";
import {
  isStudyModeLearningDeepLink,
  STUDY_MODE_LEARNING_DEEP_LINK,
} from "./studyModeDeepLink";

describe("Study Mode Learning deep link", () => {
  it("accepts only the app's exact Learning destination", () => {
    expect(STUDY_MODE_LEARNING_DEEP_LINK).toBe("mathmaster://learn");
    expect(isStudyModeLearningDeepLink(STUDY_MODE_LEARNING_DEEP_LINK)).toBe(true);
    expect(isStudyModeLearningDeepLink("mathmaster://learn/")).toBe(true);
  });

  it.each([
    "https://example.com/learn",
    "mathmaster://practice",
    "mathmaster://learn/topic",
    "mathmaster://learn?target=practice",
    "mathmaster://learn#practice",
    "mathmaster://user@learn",
    "not a url",
    "",
  ])("rejects unrelated or modified destination %s", (value) => {
    expect(isStudyModeLearningDeepLink(value)).toBe(false);
  });
});
