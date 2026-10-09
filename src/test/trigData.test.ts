import { describe, expect, it } from 'vitest';
import {
  NOT_DEFINED,
  TRIG_ANGLES,
  TRIG_FUNCTIONS,
  TRIG_RADIANS,
  buildTrigOptions,
  getAllTrigQuestions,
  getTrigQuestions,
  isTrigAnswerCorrect,
  trigValue,
  type TrigAngle,
  type TrigFunction,
} from '@/lib/trigData';

type ExpectedRow = {
  angle: TrigAngle;
  radians: string;
  values: Record<TrigFunction, string>;
};

// Independently recorded textbook values protect every displayed cell from regressions.
const expectedRows: ExpectedRow[] = [
  { angle: 0, radians: '0', values: { sin: '0', cos: '1', tan: '0', cot: NOT_DEFINED, sec: '1', cosec: NOT_DEFINED } },
  { angle: 30, radians: 'π/6', values: { sin: '1/2', cos: '√3/2', tan: '1/√3', cot: '√3', sec: '2/√3', cosec: '2' } },
  { angle: 45, radians: 'π/4', values: { sin: '1/√2', cos: '1/√2', tan: '1', cot: '1', sec: '√2', cosec: '√2' } },
  { angle: 60, radians: 'π/3', values: { sin: '√3/2', cos: '1/2', tan: '√3', cot: '1/√3', sec: '2', cosec: '2/√3' } },
  { angle: 90, radians: 'π/2', values: { sin: '1', cos: '0', tan: NOT_DEFINED, cot: '0', sec: NOT_DEFINED, cosec: '1' } },
  { angle: 120, radians: '2π/3', values: { sin: '√3/2', cos: '-1/2', tan: '-√3', cot: '-1/√3', sec: '-2', cosec: '2/√3' } },
  { angle: 135, radians: '3π/4', values: { sin: '1/√2', cos: '-1/√2', tan: '-1', cot: '-1', sec: '-√2', cosec: '√2' } },
  { angle: 150, radians: '5π/6', values: { sin: '1/2', cos: '-√3/2', tan: '-1/√3', cot: '-√3', sec: '-2/√3', cosec: '2' } },
  { angle: 180, radians: 'π', values: { sin: '0', cos: '-1', tan: '0', cot: NOT_DEFINED, sec: '-1', cosec: NOT_DEFINED } },
  { angle: 210, radians: '7π/6', values: { sin: '-1/2', cos: '-√3/2', tan: '1/√3', cot: '√3', sec: '-2/√3', cosec: '-2' } },
  { angle: 225, radians: '5π/4', values: { sin: '-1/√2', cos: '-1/√2', tan: '1', cot: '1', sec: '-√2', cosec: '-√2' } },
  { angle: 240, radians: '4π/3', values: { sin: '-√3/2', cos: '-1/2', tan: '√3', cot: '1/√3', sec: '-2', cosec: '-2/√3' } },
  { angle: 270, radians: '3π/2', values: { sin: '-1', cos: '0', tan: NOT_DEFINED, cot: '0', sec: NOT_DEFINED, cosec: '-1' } },
  { angle: 300, radians: '5π/3', values: { sin: '-√3/2', cos: '1/2', tan: '-√3', cot: '-1/√3', sec: '2', cosec: '-2/√3' } },
  { angle: 315, radians: '7π/4', values: { sin: '-1/√2', cos: '1/√2', tan: '-1', cot: '-1', sec: '√2', cosec: '-√2' } },
  { angle: 330, radians: '11π/6', values: { sin: '-1/2', cos: '√3/2', tan: '-1/√3', cot: '-√3', sec: '2/√3', cosec: '-2' } },
  { angle: 360, radians: '2π', values: { sin: '0', cos: '1', tan: '0', cot: NOT_DEFINED, sec: '1', cosec: NOT_DEFINED } },
];

describe('textbook table of standard angles', () => {
  it('lists all standard angles in increasing degree order', () => {
    expect(TRIG_ANGLES).toEqual(expectedRows.map(({ angle }) => angle));
  });

  it('matches the correct radians and all six exact ratios at every angle', () => {
    for (const row of expectedRows) {
      expect(TRIG_RADIANS[row.angle]).toBe(row.radians);
      for (const fn of TRIG_FUNCTIONS) {
        expect(trigValue(fn, row.angle)).toBe(row.values[fn]);
      }
    }
  });
});

describe('trigonometry practice data', () => {
  it('does not create practice questions for undefined ratios', () => {
    const questions = getAllTrigQuestions();
    expect(questions).toHaveLength(92);
    expect(questions.every((question) => question.answer !== NOT_DEFINED)).toBe(true);
  });

  it('generates only selected functions and keeps undefined table cells answerable', () => {
    const sineQuestions = getTrigQuestions(['sin']);
    expect(sineQuestions).toHaveLength(17);
    expect(sineQuestions.every((question) => question.fn === 'sin')).toBe(true);
    expect(sineQuestions.every((question) => question.id === `trig-sin-${question.angle}`)).toBe(true);

    const tangentQuestions = getTrigQuestions(['tan']);
    expect(tangentQuestions).toHaveLength(17);
    expect(tangentQuestions.find((question) => question.angle === 90)?.answer).toBe(NOT_DEFINED);
    expect(tangentQuestions.find((question) => question.angle === 270)?.answer).toBe(NOT_DEFINED);

    const allQuestions = getTrigQuestions();
    expect(allQuestions).toHaveLength(102);
    expect(allQuestions.filter((question) => question.answer === NOT_DEFINED)).toHaveLength(10);
    expect(new Set(allQuestions.map((question) => question.id)).size).toBe(102);
  });

  it('provides four unique options including the correct answer even for undefined values', () => {
    const questions = [
      ...getAllTrigQuestions().slice(0, 12),
      ...getTrigQuestions(['tan']).filter((question) => question.answer === NOT_DEFINED),
    ];
    for (const question of questions) {
      const options = buildTrigOptions(question);
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(options).toContain(question.answer);
    }
  });

  it('accepts decimal, fraction, radical and undefined aliases without changing meaning', () => {
    expect(isTrigAnswerCorrect('0.5', '1/2')).toBe(true);
    expect(isTrigAnswerCorrect('-0.5', '-1/2')).toBe(true);
    expect(isTrigAnswerCorrect('0.8660254', '√3/2')).toBe(true);
    expect(isTrigAnswerCorrect('Undefined', NOT_DEFINED)).toBe(true);
    expect(isTrigAnswerCorrect('not defined', NOT_DEFINED)).toBe(true);
    expect(isTrigAnswerCorrect('infinity', NOT_DEFINED)).toBe(false);
    expect(isTrigAnswerCorrect('0.51', '1/2')).toBe(false);
    expect(isTrigAnswerCorrect('√2/2', '1/√2')).toBe(true);
    expect(isTrigAnswerCorrect('-√2/2', '-1/√2')).toBe(true);
    expect(isTrigAnswerCorrect('√3/3', '1/√3')).toBe(true);
    expect(isTrigAnswerCorrect('-√3/3', '-1/√3')).toBe(true);
    expect(isTrigAnswerCorrect('2√3/3', '2/√3')).toBe(true);
    expect(isTrigAnswerCorrect('-2√3/3', '-2/√3')).toBe(true);
  });
});
