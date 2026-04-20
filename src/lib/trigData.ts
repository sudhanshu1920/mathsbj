// Standard trigonometry angle table — fully offline data

export type TrigFunction = 'sin' | 'cos' | 'tan' | 'cosec' | 'sec' | 'cot';

export const TRIG_ANGLES = [0, 30, 45, 60, 90] as const;
export type TrigAngle = (typeof TRIG_ANGLES)[number];

export const TRIG_FUNCTIONS: TrigFunction[] = ['sin', 'cos', 'tan', 'cosec', 'sec', 'cot'];

/**
 * Display string of the exact value of fn(angle).
 * Returns "∞" for undefined values (tan 90°, cot 0°, sec 90°, cosec 0°).
 */
export function trigValue(fn: TrigFunction, angle: TrigAngle): string {
  const table: Record<TrigFunction, Record<TrigAngle, string>> = {
    sin: { 0: '0', 30: '1/2', 45: '1/√2', 60: '√3/2', 90: '1' },
    cos: { 0: '1', 30: '√3/2', 45: '1/√2', 60: '1/2', 90: '0' },
    tan: { 0: '0', 30: '1/√3', 45: '1', 60: '√3', 90: '∞' },
    cosec: { 0: '∞', 30: '2', 45: '√2', 60: '2/√3', 90: '1' },
    sec: { 0: '1', 30: '2/√3', 45: '√2', 60: '2', 90: '∞' },
    cot: { 0: '∞', 30: '√3', 45: '1', 60: '1/√3', 90: '0' },
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

/** Generate the full pool of standard trig questions. */
export function getAllTrigQuestions(): TrigQuestion[] {
  const out: TrigQuestion[] = [];
  for (const fn of TRIG_FUNCTIONS) {
    for (const a of TRIG_ANGLES) {
      out.push({
        fn,
        angle: a,
        text: `${fn} ${a}° = ?`,
        answer: trigValue(fn, a),
      });
    }
  }
  return out;
}

/** Build 4 unique MCQ options around the correct value, drawn from the same table. */
export function buildTrigOptions(q: TrigQuestion): string[] {
  const pool = new Set<string>();
  pool.add(q.answer);
  // pull other plausible distractors from the same function family + cross family
  const candidates: string[] = [];
  for (const fn of TRIG_FUNCTIONS) {
    for (const a of TRIG_ANGLES) {
      const v = trigValue(fn, a);
      if (v !== q.answer) candidates.push(v);
    }
  }
  // shuffle candidates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (const c of candidates) {
    if (pool.size >= 4) break;
    pool.add(c);
  }
  const arr = Array.from(pool);
  // shuffle final
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
    .replace(/infinity|infty|inf/gi, '∞');
}

export function isTrigAnswerCorrect(input: string, expected: string): boolean {
  const a = normalizeTrigInput(input);
  const b = normalizeTrigInput(expected);
  if (a === b) return true;
  // Accept simple equivalents: "1/sqrt(2)" vs "1/√2"; "0.5" vs "1/2"; "1" etc.
  // Numeric compare for non-radical answers
  const numA = Number(a);
  const numB = Number(b);
  if (!isNaN(numA) && !isNaN(numB) && Math.abs(numA - numB) < 1e-6) return true;
  // Common alt forms
  if (a === '√2/2' && b === '1/√2') return true;
  if (b === '√2/2' && a === '1/√2') return true;
  if (a === '√3/3' && b === '1/√3') return true;
  if (b === '√3/3' && a === '1/√3') return true;
  if (a === '2√3/3' && b === '2/√3') return true;
  if (b === '2√3/3' && a === '2/√3') return true;
  return false;
}
