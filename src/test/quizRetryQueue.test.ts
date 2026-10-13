import { describe, expect, it } from "vitest";
import {
  enqueueQuestionRetry,
  ensureOutstandingQuestionRetries,
  getQuizCompletionPercent,
  identifyQuizQuestions,
  shouldFinishQuestionQueue,
} from "@/lib/quizRetryQueue";

const makePool = () =>
  identifyQuizQuestions(
    [
      { topicId: "tables", text: "2 × 3", answer: 6 },
      { topicId: "percentage", text: "50% of 20", answer: 10 },
      { topicId: "addition", text: "3 + 4", answer: 7 },
    ],
    1,
  );

describe("Quiz retry queue", () => {
  it("assigns a unique identity to every original pool slot and preserves topic data", () => {
    const source = [
      { topicId: "tables", text: "2 × 3", answer: 6 },
      { topicId: "tables", text: "2 × 3", answer: 6 },
    ];
    const pool = identifyQuizQuestions(source, 7);

    expect(pool.map((question) => question.quizQuestionId)).toEqual(["7:0", "7:1"]);
    expect(pool.every((question) => question.quizIsRetry === false)).toBe(true);
    expect(pool.every((question) => question.topicId === "tables")).toBe(true);
  });

  it("queues a wrong original behind the untouched primary round without changing original count", () => {
    const originals = makePool();
    const queue = enqueueQuestionRetry(originals, 0, originals[0], new Set<string>());

    expect(originals).toHaveLength(3);
    expect(queue).toHaveLength(4);
    expect(queue.slice(0, 3).map((question) => question.quizQuestionId)).toEqual(
      originals.map((question) => question.quizQuestionId),
    );
    expect(queue[3].quizQuestionId).toBe(originals[0].quizQuestionId);
    expect(queue[3].quizIsRetry).toBe(true);
  });

  it("does not create duplicate pending retry entries for the same original", () => {
    const originals = makePool();
    const firstQueue = enqueueQuestionRetry(originals, 0, originals[0], new Set<string>());
    const secondQueue = enqueueQuestionRetry(firstQueue, 0, originals[0], new Set<string>());

    expect(secondQueue).toHaveLength(4);
    expect(secondQueue.filter((question) => question.quizQuestionId === originals[0].quizQuestionId)).toHaveLength(2);
  });

  it("requeues a retry after another wrong attempt once the active retry has been consumed", () => {
    const originals = makePool();
    const firstQueue = enqueueQuestionRetry(originals, 0, originals[0], new Set<string>());
    const retryIndex = firstQueue.findIndex((question) => question.quizIsRetry);
    const nextQueue = enqueueQuestionRetry(firstQueue, retryIndex, firstQueue[retryIndex], new Set<string>());

    expect(nextQueue).toHaveLength(5);
    expect(nextQueue.filter((question) => question.quizQuestionId === originals[0].quizQuestionId)).toHaveLength(3);
    expect(nextQueue[4].quizIsRetry).toBe(true);
  });

  it("does not retry an identity that has already been correctly completed", () => {
    const originals = makePool();
    const completed = new Set([originals[1].quizQuestionId]);
    const queue = enqueueQuestionRetry(originals, 1, originals[1], completed);

    expect(queue).toHaveLength(3);
  });

  it("repairs a missing retry rather than leaving an incomplete finite quiz at the end", () => {
    const originals = makePool();
    const withRetry = enqueueQuestionRetry(originals, 0, originals[0], new Set<string>());
    const ensured = ensureOutstandingQuestionRetries(withRetry, 2, originals, new Set<string>());

    expect(ensured.filter((question) => question.quizQuestionId === originals[0].quizQuestionId)).toHaveLength(2);
    expect(ensured.filter((question) => question.quizQuestionId === originals[1].quizQuestionId)).toHaveLength(2);
    expect(ensured.filter((question) => question.quizQuestionId === originals[2].quizQuestionId)).toHaveLength(2);
  });

  it("uses unique completion for progress and does not finish while originals remain incomplete", () => {
    expect(getQuizCompletionPercent(3, 5)).toBe(60);
    expect(getQuizCompletionPercent(9, 5)).toBe(100);
    expect(getQuizCompletionPercent(0, 0)).toBe(0);

    expect(shouldFinishQuestionQueue(5, 4, true, 3, 5)).toBe(false);
    expect(shouldFinishQuestionQueue(7, 4, true, 3, 5)).toBe(false);
    expect(shouldFinishQuestionQueue(7, 6, true, 5, 5)).toBe(true);
    expect(shouldFinishQuestionQueue(5, 4, false, 3, 5)).toBe(true);
  });
});
