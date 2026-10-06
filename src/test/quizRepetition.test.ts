import { describe, expect, it } from "vitest";
import { buildQuestionPool, sanitizeRepetition } from "@/lib/quizRepetition";

const makeQuestions = (topicId: string, count: number) =>
  Array.from({ length: count }, (_, index) => ({
    topicId,
    id: index + 1,
  }));

describe("Quiz repetition", () => {
  it("keeps repetition off identical to the existing question-count behavior", () => {
    const result = buildQuestionPool(makeQuestions("square", 20), {
      enabled: false,
      repetitionByTopic: { square: 5 },
      sequential: true,
      count: 10,
      infinite: false,
    });

    expect(result).toHaveLength(10);
    expect(result.map((q) => q.id)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
  });

  it("applies repetition after selecting the base question count in sequential mode", () => {
    const result = buildQuestionPool(makeQuestions("square", 20), {
      enabled: true,
      repetitionByTopic: { square: 5 },
      sequential: true,
      count: 20,
      infinite: false,
    });

    expect(result).toHaveLength(100);
    for (let id = 1; id <= 20; id += 1) {
      const group = result.slice((id - 1) * 5, id * 5);
      expect(group.every((q) => q.id === id)).toBe(true);
    }
  });

  it("preserves exact repetition counts after randomization", () => {
    const result = buildQuestionPool(makeQuestions("square", 20), {
      enabled: true,
      repetitionByTopic: { square: 5 },
      sequential: false,
      count: 20,
      infinite: false,
    });

    expect(result).toHaveLength(100);
    for (let id = 1; id <= 20; id += 1) {
      expect(result.filter((q) => q.id === id)).toHaveLength(5);
    }
  });

  it("keeps different repetition values independent per topic", () => {
    const base = [
      ...makeQuestions("square", 2),
      ...makeQuestions("cube", 2),
    ];

    const result = buildQuestionPool(base, {
      enabled: true,
      repetitionByTopic: { square: 2, cube: 3 },
      sequential: true,
      count: 4,
      infinite: false,
    });

    expect(result).toHaveLength(10);
    expect(result.filter((q) => q.topicId === "square")).toHaveLength(4);
    expect(result.filter((q) => q.topicId === "cube")).toHaveLength(6);
  });

  it("normalizes unsafe repetition values to the supported range", () => {
    expect(sanitizeRepetition(0)).toBe(1);
    expect(sanitizeRepetition(-4)).toBe(1);
    expect(sanitizeRepetition("invalid")).toBe(1);
    expect(sanitizeRepetition(999)).toBe(10);
  });

  it("does not multiply an already-expanded result when generating a fresh pool", () => {
    const base = makeQuestions("square", 2);
    const first = buildQuestionPool(base, {
      enabled: true,
      repetitionByTopic: { square: 5 },
      sequential: true,
      count: 2,
      infinite: false,
    });
    const second = buildQuestionPool(base, {
      enabled: true,
      repetitionByTopic: { square: 5 },
      sequential: true,
      count: 2,
      infinite: false,
    });

    expect(first).toHaveLength(10);
    expect(second).toHaveLength(10);
  });
});
