import { describe, expect, it } from 'vitest';
import {
  NOT_DEFINED,
  TRIG_ANGLES,
  TRIG_FUNCTIONS,
  TRIG_RADIANS,
  buildTrigOptions,
  getAllTrigQuestions,
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

  it('provides four unique options including the correct answer', () => {
    for (const question of getAllTrigQuestions().slice(0, 12)) {
      const options = buildTrigOptions(question);
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(options).toContain(question.answer);
    }
  });

  it('accepts equivalent positive and negative exact-value notation', () => {
    expect(isTrigAnswerCorrect('√2/2', '1/√2')).toBe(true);
    expect(isTrigAnswerCorrect('-√2/2', '-1/√2')).toBe(true);
    expect(isTrigAnswerCorrect('√3/3', '1/√3')).toBe(true);
    expect(isTrigAnswerCorrect('-√3/3', '-1/√3')).toBe(true);
    expect(isTrigAnswerCorrect('2√3/3', '2/√3')).toBe(true);
    expect(isTrigAnswerCorrect('-2√3/3', '-2/√3')).toBe(true);
  });
});
