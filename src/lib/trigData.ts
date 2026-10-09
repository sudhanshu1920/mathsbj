// Standard trigonometry angle table — fully offline data.

export type TrigFunction = 'sin' | 'cos' | 'tan' | 'cot' | 'sec' | 'cosec';

/**
 * Standard special angles from 0° through 360°.
 * Includes the common first-quadrant angles and their reference-angle
 * counterparts in the remaining quadrants.
 */
export const TRIG_ANGLES = [
  0, 30, 45, 60, 90,
  120, 135, 150, 180,
  210, 225, 240, 270,
  300, 315, 330, 360,
] as const;
export type TrigAngle = (typeof TRIG_ANGLES)[number];

export const TRIG_FUNCTIONS: TrigFunction[] = ['sin', 'cos', 'tan', 'cot', 'sec', 'cosec'];

/** Canonical angle range used by both the Table of Angles and Quiz mode. */
const STANDARD_TRIG_ANGLES: readonly TrigAngle[] = TRIG_ANGLES.filter((angle) => angle <= 90);

export function getTrigAngles(proMode = false): readonly TrigAngle[] {
  return proMode ? TRIG_ANGLES : STANDARD_TRIG_ANGLES;
}

/** Exact radian representation for every standard angle in the table. */
export const TRIG_RADIANS: Record<TrigAngle, string> = {
  0: '0',
  30: 'π/6',
  45: 'π/4',
  60: 'π/3',
  90: 'π/2',
  120: '2π/3',
  135: '3π/4',
  150: '5π/6',
  180: 'π',
  210: '7π/6',
  225: '5π/4',
  240: '4π/3',
  270: '3π/2',
  300: '5π/3',
  315: '7π/4',
  330: '11π/6',
  360: '2π',
};

/** Sentinel display string for trigonometric ratios that are undefined. */
export const NOT_DEFINED = 'Not Defined';

/**
 * Exact textbook value of a trigonometric ratio at a standard angle.
 * Undefined values are represented explicitly; they are never shown as zero.
 */
export function trigValue(fn: TrigFunction, angle: TrigAngle): string {
  const table: Record<TrigFunction, Record<TrigAngle, string>> = {
    sin: {
      0: '0', 30: '1/2', 45: '1/√2', 60: '√3/2', 90: '1',
      120: '√3/2', 135: '1/√2', 150: '1/2', 180: '0',
      210: '-1/2', 225: '-1/√2', 240: '-√3/2', 270: '-1',
      300: '-√3/2', 315: '-1/√2', 330: '-1/2', 360: '0',
    },
    cos: {
      0: '1', 30: '√3/2', 45: '1/√2', 60: '1/2', 90: '0',
      120: '-1/2', 135: '-1/√2', 150: '-√3/2', 180: '-1',
      210: '-√3/2', 225: '-1/√2', 240: '-1/2', 270: '0',
      300: '1/2', 315: '1/√2', 330: '√3/2', 360: '1',
    },
    tan: {
      0: '0', 30: '1/√3', 45: '1', 60: '√3', 90: NOT_DEFINED,
      120: '-√3', 135: '-1', 150: '-1/√3', 180: '0',
      210: '1/√3', 225: '1', 240: '√3', 270: NOT_DEFINED,
      300: '-√3', 315: '-1', 330: '-1/√3', 360: '0',
    },
    cot: {
      0: NOT_DEFINED, 30: '√3', 45: '1', 60: '1/√3', 90: '0',
      120: '-1/√3', 135: '-1', 150: '-√3', 180: NOT_DEFINED,
      210: '√3', 225: '1', 240: '1/√3', 270: '0',
      300: '-1/√3', 315: '-1', 330: '-√3', 360: NOT_DEFINED,
    },
    sec: {
      0: '1', 30: '2/√3', 45: '√2', 60: '2', 90: NOT_DEFINED,
      120: '-2', 135: '-√2', 150: '-2/√3', 180: '-1',
      210: '-2/√3', 225: '-√2', 240: '-2', 270: NOT_DEFINED,
      300: '2', 315: '√2', 330: '2/√3', 360: '1',
    },
    cosec: {
      0: NOT_DEFINED, 30: '2', 45: '√2', 60: '2/√3', 90: '1',
      120: '2/√3', 135: '√2', 150: '2', 180: NOT_DEFINED,
      210: '-2', 225: '-√2', 240: '-2/√3', 270: '-1',
      300: '-2/√3', 315: '-√2', 330: '-2', 360: NOT_DEFINED,
    },
  };
  return table[fn][angle];
}

/** Pretty function label for headings (uses θ symbol). */
export function trigLabel(fn: TrigFunction): string {
  return `${fn} θ`;
}

export interface TrigQuestion {
  /** Stable identity shared by the reference table, Practice and Quiz. */
  id: string;
  fn: TrigFunction;
  angle: TrigAngle;
  text: string;
  answer: string;
  options?: string[];
}

/**
 * Generate questions for selected functions and canonical angles, using the
 * exact values from the reference table. Undefined cells remain valid.
 * Omitting angles preserves the full-range Learning → Practice behavior;
 * Quiz Arena passes its selected Standard/Pro range explicitly.
 */
export function getTrigQuestions(
  functions: readonly TrigFunction[] = TRIG_FUNCTIONS,
  angles: readonly TrigAngle[] = TRIG_ANGLES,
): TrigQuestion[] {
  const selectedFunctions = TRIG_FUNCTIONS.filter((fn) => functions.includes(fn));
  const selectedAngles = TRIG_ANGLES.filter((angle) => angles.includes(angle));
  const out: TrigQuestion[] = [];
  for (const fn of selectedFunctions) {
    for (const angle of selectedAngles) {
      out.push({
        id: `trig-${fn}-${angle}`,
        fn,
        angle,
        text: `${fn} ${angle}° = ?`,
        answer: trigValue(fn, angle),
      });
    }
  }
  return out;
}

/** Backward-compatible pool of defined values for callers that need finite ratios only. */
export function getAllTrigQuestions(): TrigQuestion[] {
  return getTrigQuestions().filter((question) => question.answer !== NOT_DEFINED);
}

/** Build 4 unique MCQ options around the correct value, drawn from this table. */
export function buildTrigOptions(q: TrigQuestion): string[] {
  const pool = new Set<string>();
  pool.add(q.answer);
  const candidates: string[] = [];
  for (const fn of TRIG_FUNCTIONS) {
    for (const angle of TRIG_ANGLES) {
      const value = trigValue(fn, angle);
      if (value !== q.answer) candidates.push(value);
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (const candidate of candidates) {
    if (pool.size >= 4) break;
    pool.add(candidate);
  }
  const options = Array.from(pool);
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

/** Normalize a typed answer for comparison (handles spaces and common notation). */
export function normalizeTrigInput(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '')
    .replace(/sqrt/gi, '√')
    .replace(/notdefined|undefined|undef|nd/gi, 'NOTDEFINED');
}

function parseTrigNumericValue(input: string): number | null {
  const value = normalizeTrigInput(input);
  if (!value || value === 'NOTDEFINED') return null;

  const numericLiteral = Number(value);
  if (Number.isFinite(numericLiteral) && /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
    return numericLiteral;
  }

  // Simple numeric fractions (including signed numerator/denominator) are
  // parsed without eval or arbitrary expression execution.
  const fraction = value.match(/^([-+]?\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }

  const root2 = Math.sqrt(2);
  const root3 = Math.sqrt(3);
  const exactValues: Record<string, number> = {
    '√2': root2,
    '-√2': -root2,
    '√3': root3,
    '-√3': -root3,
    '1/√2': 1 / root2,
    '√2/2': root2 / 2,
    '-1/√2': -1 / root2,
    '-√2/2': -root2 / 2,
    '√3/2': root3 / 2,
    '-√3/2': -root3 / 2,
    '1/√3': 1 / root3,
    '√3/3': root3 / 3,
    '-1/√3': -1 / root3,
    '-√3/3': -root3 / 3,
    '2/√3': 2 / root3,
    '2√3/3': 2 / root3,
    '-2/√3': -2 / root3,
    '-2√3/3': -2 / root3,
  };
  return exactValues[value] ?? null;
}

const equivalentExactForms: ReadonlyArray<readonly [string, string]> = [
  ['√2/2', '1/√2'],
  ['-√2/2', '-1/√2'],
  ['√3/3', '1/√3'],
  ['-√3/3', '-1/√3'],
  ['2√3/3', '2/√3'],
  ['-2√3/3', '-2/√3'],
];

export function isTrigAnswerCorrect(input: string, expected: string): boolean {
  const answer = normalizeTrigInput(input);
  const correct = normalizeTrigInput(expected);

  if (answer === correct) return true;

  const numericAnswer = parseTrigNumericValue(answer);
  const numericCorrect = parseTrigNumericValue(correct);
  if (
    numericAnswer !== null &&
    numericCorrect !== null &&
    Math.abs(numericAnswer - numericCorrect) < 1e-6
  ) {
    return true;
  }

  return equivalentExactForms.some(
    ([left, right]) =>
      (answer === left && correct === right) ||
      (answer === right && correct === left),
  );
}
