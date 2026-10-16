import { describe, expect, it } from 'vitest';
import { generateQuestions, isValidPracticeRange } from '@/pages/PracticePage';
import { ELEMENTS, formatMass } from '@/lib/periodicTable';

const baseConfig = {
  count: 500,
  infinite: false,
  mode: 'input' as const,
  timerMode: 'off' as const,
  timerSeconds: 9999,
  sequential: true,
  repetitionEnabled: false,
  repetitionByTopic: {},
};

describe('Periodic Table practice property selection', () => {
  it('generates only selected property question types from the 1–10 range', () => {
    const selected = ['atomic-number', 'name', 'mass'] as const;
    const questions = generateQuestions({
      ...baseConfig,
      topics: [{
        id: 'periodic-table',
        label: 'Periodic Table',
        range: { from: 1, to: 10, periodicQuestionTypes: [...selected], periodicMassMode: 'exact' },
      }],
    });
    const selectedLabels = new Set(['Atomic Number', 'Element Name', 'Atomic Mass']);
    const allowedElements = ELEMENTS.slice(0, 10);
    const allowedNames = new Set(allowedElements.map((element) => element.name));
    const allowedNumbers = new Set<number>([
      ...allowedElements.map((element) => element.number),
      ...allowedElements.map((element) => Number(formatMass(element, 'exact').replace(/[\[\]]/g, ''))),
    ]);

    expect(isValidPracticeRange('periodic-table', {
      from: 1, to: 10, periodicQuestionTypes: [...selected], periodicMassMode: 'exact',
    })).toBe(true);
    expect(isValidPracticeRange('periodic-table', {
      from: 1, to: 10, periodicQuestionTypes: [], periodicMassMode: 'exact',
    })).toBe(false);
    expect(questions.length).toBeGreaterThan(0);
    expect(new Set(questions.map((question) => question.topicLabel?.split(' • ').at(-1)))).toEqual(selectedLabels);
    expect(questions.every((question) => {
      if (typeof question.answer === 'number') return allowedNumbers.has(question.answer);
      return allowedNames.has(String(question.answer));
    })).toBe(true);
    expect(questions.every((question) =>
      allowedElements.some((element) =>
        question.text.includes(element.name) ||
        question.text.includes(String(element.number)) ||
        question.text.includes(element.symbol),
      ),
    )).toBe(true);
    expect(questions.some((question) => question.topicLabel?.endsWith(' • Symbol'))).toBe(false);
  });

  it('keeps symbols, answers, and MCQ distractors inside the selected 11–20 range', () => {
    const allowed = ELEMENTS.slice(10, 20);
    const symbols = new Set(allowed.map((element) => element.symbol));
    const names = new Set(allowed.map((element) => element.name));
    const questions = generateQuestions({
      ...baseConfig,
      mode: 'mcq',
      topics: [{
        id: 'periodic-table',
        label: 'Periodic Table',
        range: { from: 11, to: 20, periodicQuestionTypes: ['symbol'], periodicMassMode: 'round' },
      }],
    });

    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every((question) => question.topicLabel?.endsWith(' • Symbol'))).toBe(true);
    expect(questions.every((question) =>
      symbols.has(String(question.answer)) || names.has(String(question.answer)),
    )).toBe(true);
    for (const question of questions) {
      const options = (question.options ?? []).map(String);
      expect(options).toContain(String(question.answer));
      expect(options).toHaveLength(4);
      expect(options.every((option) => symbols.has(option) || names.has(option))).toBe(true);
    }
    expect(questions.some((question) => question.text.includes('Hydrogen'))).toBe(false);
    expect(questions.some((question) => question.text.includes('Neon'))).toBe(false);
  });

  it('supports all four independently selected properties without duplicate question-type selections', () => {
    const selected = [...new Set(['atomic-number', 'name', 'symbol', 'mass'])];
    const questions = generateQuestions({
      ...baseConfig,
      topics: [{
        id: 'periodic-table',
        label: 'Periodic Table',
        range: { from: 21, to: 30, periodicQuestionTypes: selected, periodicMassMode: 'round' },
      }],
    });
    const generatedLabels = new Set(questions.map((question) => question.topicLabel?.split(' • ').at(-1)));

    expect(selected).toHaveLength(4);
    expect(generatedLabels).toEqual(new Set(['Atomic Number', 'Element Name', 'Symbol', 'Atomic Mass']));
    expect(questions.every((question) => {
      const element = ELEMENTS.slice(20, 30).find((entry) =>
        question.text.includes(entry.name) ||
        question.text.includes(entry.symbol) ||
        question.text.includes(String(entry.number)),
      );
      return element !== undefined;
    })).toBe(true);
  });
});
