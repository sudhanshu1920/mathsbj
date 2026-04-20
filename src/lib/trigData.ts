// Standard trigonometry angle table — fully offline data

export type TrigFunction = 'sin' | 'cos' | 'tan' | 'cot' | 'sec' | 'cosec';

export const TRIG_ANGLES = [0, 30, 45, 60, 90, 180, 270, 360] as const;
export type TrigAngle = (typeof TRIG_ANGLES)[number];

export const TRIG_FUNCTIONS: TrigFunction[] = ['sin', 'cos', 'tan', 'cot', 'sec', 'cosec'];

/** Display radians label for each standard angle. */
export const TRIG_RADIANS: Record<TrigAngle, string> = {
  0: '0',
  30: 'π/6',
  45: 'π/4',
  60: 'π/3',
  90: 'π/2',
  180: 'π',
  270: '3π/2',
  360: '2π',
};

/** Sentinel display string for undefined trig values. */
export const NOT_DEFINED = 'Not Defined';

/**
 * Display string of the exact value of fn(angle).
 * Returns "Not Defined" for undefined values.
 */
export function trigValue(fn: TrigFunction, angle: TrigAngle): string {
  const table: Record<TrigFunction, Record<TrigAngle, string>> = {
    sin:   { 0: '0', 30: '1/2',   45: '1/√2', 60: '√3/2', 90: '1',          180: '0',          270: '-1',         360: '0' },
    cos:   { 0: '1', 30: '√3/2',  45: '1/√2', 60: '1/2',  90: '0',          180: '-1',         270: '0',          360: '1' },
    tan:   { 0: '0', 30: '1/√3',  45: '1',    60: '√3',   90: NOT_DEFINED,  180: '0',          270: NOT_DEFINED,  360: '0' },
    cot:   { 0: NOT_DEFINED, 30: '√3', 45: '1', 60: '1/√3', 90: '0',         180: NOT_DEFINED,  270: '0',          360: NOT_DEFINED },
    sec:   { 0: '1', 30: '2/√3',  45: '√2',   60: '2',    90: NOT_DEFINED,  180: '-1',         270: NOT_DEFINED,  360: '1' },
    cosec: { 0: NOT_DEFINED, 30: '2', 45: '√2', 60: '2/√3', 90: '1',         180: NOT_DEFINED,  270: '-1',         360: NOT_DEFINED },
  };
  return table[fn][angle];
}

/** Pretty function label for headings (uses θ symbol). */
export function trigLabel(fn: TrigFunction): string {
  return `${fn} θ`;
}

export interface TrigQuestion {
  fn: TrigFunction;
  angle: TrigAngle;
  text: string;
  answer: string;
  options?: string[];
}

/** Generate the full pool of standard trig questions (skips Not Defined for practice). */
export function getAllTrigQuestions(): TrigQuestion[] {
  const out: TrigQuestion[] = [];
  for (const fn of TRIG_FUNCTIONS) {
    for (const a of TRIG_ANGLES) {
      const ans = trigValue(fn, a);
      out.push({
        fn,
        angle: a,
        text: `${fn} ${a}° = ?`,
        answer: ans,
      });
    }
  }
  return out;
}

/** Build 4 unique MCQ options around the correct value, drawn from the same table. */
export function buildTrigOptions(q: TrigQuestion): string[] {
  const pool = new Set<string>();
  pool.add(q.answer);
  const candidates: string[] = [];
  for (const fn of TRIG_FUNCTIONS) {
    for (const a of TRIG_ANGLES) {
      const v = trigValue(fn, a);
      if (v !== q.answer) candidates.push(v);
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (const c of candidates) {
    if (pool.size >= 4) break;
    pool.add(c);
  }
  const arr = Array.from(pool);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Normalize a typed answer for comparison (handles spaces, alt forms). */
export function normalizeTrigInput(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '')
    .replace(/sqrt/gi, '√')
    .replace(/infinity|infty|inf|∞/gi, 'NOTDEFINED')
    .replace(/notdefined|undefined|undef|nd/gi, 'NOTDEFINED');
}

export function isTrigAnswerCorrect(input: string, expected: string): boolean {
  const a = normalizeTrigInput(input);
  const b = normalizeTrigInput(expected.replace(/Not Defined/i, 'NOTDEFINED'));
  if (a === b) return true;
  const numA = Number(a);
  const numB = Number(b);
  if (!isNaN(numA) && !isNaN(numB) && Math.abs(numA - numB) < 1e-6) return true;
  if (a === '√2/2' && b === '1/√2') return true;
  if (b === '√2/2' && a === '1/√2') return true;
  if (a === '√3/3' && b === '1/√3') return true;
  if (b === '√3/3' && a === '1/√3') return true;
  if (a === '2√3/3' && b === '2/√3') return true;
  if (b === '2√3/3' && a === '2/√3') return true;
  return false;
}
