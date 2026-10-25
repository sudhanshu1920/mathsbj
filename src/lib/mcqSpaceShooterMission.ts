export type SpaceShooterDifficulty = "easy" | "medium" | "hard";

export interface SpaceShooterDifficultyQuestion {
  topicId?: string;
  text?: string;
  answer?: number | string;
  operand1?: number;
  operand2?: number;
  operand1DigitCount?: number;
  operand2DigitCount?: number;
  superscript?: string;
  questionFraction?: { n: number; d: number };
  trigFunctionId?: string;
}

export interface SpaceShooterDifficultyConfig {
  label: string;
  lives: number;
  shipSpeed: number;
  boostMultiplier: number;
  hazardSpeed: number;
  hazardSpawnMs: number;
  questionsPerLevel: number;
  bossHits: number;
}

export const SPACE_SHOOTER_DIFFICULTIES: Record<SpaceShooterDifficulty, SpaceShooterDifficultyConfig> = {
  easy: {
    label: "CADET",
    lives: 5,
    shipSpeed: 285,
    boostMultiplier: 1.7,
    hazardSpeed: 78,
    hazardSpawnMs: 1900,
    questionsPerLevel: 4,
    bossHits: 2,
  },
  medium: {
    label: "PILOT",
    lives: 4,
    shipSpeed: 255,
    boostMultiplier: 1.55,
    hazardSpeed: 112,
    hazardSpawnMs: 1450,
    questionsPerLevel: 4,
    bossHits: 3,
  },
  hard: {
    label: "ACE",
    lives: 3,
    shipSpeed: 235,
    boostMultiplier: 1.4,
    hazardSpeed: 154,
    hazardSpawnMs: 1080,
    questionsPerLevel: 4,
    bossHits: 4,
  },
};

export function normalizeSpaceShooterDifficulty(value: unknown): SpaceShooterDifficulty {
  return value === "easy" || value === "hard" ? value : "medium";
}

const safeMagnitude = (value: unknown): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.min(1_000_000_000, Math.abs(numeric)) : 0;
};

function readQuestionNumbers(question: SpaceShooterDifficultyQuestion): number[] {
  const numbers = String(question.text ?? "").match(/\d+(?:\.\d+)?/g) ?? [];
  return numbers.map((value) => safeMagnitude(value)).filter(Number.isFinite).slice(0, 8);
}

/** Returns a stable, bounded complexity score for ordering existing generated questions. */
export function getSpaceQuestionComplexity(question: SpaceShooterDifficultyQuestion): number {
  const topic = String(question.topicId ?? "");
  const values = readQuestionNumbers(question);
  const largest = Math.max(0, ...values);
  const answer = safeMagnitude(question.answer);
  const digitCount = (value: number) => value === 0 ? 1 : Math.floor(Math.log10(Math.max(1, value))) + 1;
  let complexity = 1 + Math.log10(largest + 1) * 1.8;

  if (topic === "addition-subtraction-digits") {
    complexity = Math.max(
      question.operand1DigitCount ?? digitCount(safeMagnitude(question.operand1)),
      question.operand2DigitCount ?? digitCount(safeMagnitude(question.operand2)),
    ) * 3 + Math.log10(safeMagnitude(question.operand1) + safeMagnitude(question.operand2) + 1);
    if (String(question.text ?? "").includes("×") || String(question.text ?? "").includes("÷")) complexity += 2;
  } else if (topic === "tables") {
    const match = /([\d,]+)\s*×\s*([\d,]+)/.exec(String(question.text ?? ""));
    const left = match ? safeMagnitude(match[1]!.replaceAll(",", "")) : largest;
    const right = match ? safeMagnitude(match[2]!.replaceAll(",", "")) : 1;
    complexity = 2 + Math.log10(left + 1) * 2 + Math.log10(right + 1) * 2 + Math.log10(answer + 1);
  } else if (topic === "squares" || topic === "cubes" || topic === "roots" || topic === "square-roots" || topic === "cube-roots") {
    complexity = 1.5 + Math.log10(largest + 1) * 4;
    if (topic === "cubes" || topic === "cube-roots") complexity += 3;
  } else if (topic === "powers") {
    complexity = 1.5 + Math.log10(largest + 1) * 2.2 + safeMagnitude(question.superscript) * 1.1;
  } else if (topic === "percentage") {
    const numerator = safeMagnitude(question.questionFraction?.n);
    const denominator = safeMagnitude(question.questionFraction?.d);
    complexity = 2 + Math.log10(denominator + 1) * 3 + Math.log10(numerator + 1) * 1.5;
  } else if (topic === "trig") {
    const angle = values.at(-1) ?? largest;
    complexity = 2 + angle / 90 + (String(question.trigFunctionId ?? "").toLowerCase().includes("tan") ? 2 : 0);
  } else if (topic === "periodic-table") {
    complexity = 1 + largest / 15;
    if (/atomic mass|mass/i.test(String(question.text ?? ""))) complexity += 1.5;
  } else {
    complexity = 1 + Math.log10(largest + 1) * 2.2 + Math.log10(answer + 1) * 0.8;
  }

  if (/×|\*|power|cube|³|²|√|∛/i.test(String(question.text ?? ""))) complexity += 0.75;
  return Number.isFinite(complexity) ? Math.min(100, Math.max(0, complexity)) : 0;
}

/**
 * Selects questions from the existing generator's candidates, grouped by topic.
 * User-selected ranges remain the source of truth; no answer or question is fabricated.
 */
export function selectSpaceShooterQuestions<T extends SpaceShooterDifficultyQuestion>(
  questions: readonly T[],
  difficultyValue: SpaceShooterDifficulty | string,
  minimumCount = 0,
): T[] {
  if (questions.length <= 2) return [...questions];
  const difficulty = normalizeSpaceShooterDifficulty(difficultyValue);
  const requestedCount = Number.isFinite(minimumCount)
    ? Math.max(0, Math.min(questions.length, Math.floor(minimumCount)))
    : 0;

  const groups = new Map<string, Array<{ question: T; originalIndex: number; complexity: number }>>();
  questions.forEach((question, originalIndex) => {
    const topicKey = String(question.topicId ?? "general");
    const items = groups.get(topicKey) ?? [];
    items.push({ question, originalIndex, complexity: getSpaceQuestionComplexity(question) });
    groups.set(topicKey, items);
  });

  const chosen = new Set<T>();
  const candidates: Array<{ question: T; originalIndex: number; complexity: number; preference: number }> = [];

  for (const items of groups.values()) {
    const ordered = [...items].sort((a, b) => a.complexity - b.complexity || a.originalIndex - b.originalIndex);
    if (ordered.length <= 2) {
      ordered.forEach((item) => chosen.add(item.question));
      continue;
    }
    const count = Math.max(1, Math.ceil(ordered.length * 0.68));
    const low = Math.floor((ordered.length - count) / 2);
    let preferred: typeof ordered;
    if (difficulty === "easy") preferred = ordered.slice(0, count);
    else if (difficulty === "hard") preferred = ordered.slice(ordered.length - count);
    else preferred = ordered.slice(low, low + count);

    preferred.forEach((item) => chosen.add(item.question));
    const median = ordered[Math.floor((ordered.length - 1) / 2)]?.complexity ?? 0;
    for (const item of ordered) {
      if (chosen.has(item.question)) continue;
      const preference = difficulty === "easy"
        ? item.complexity
        : difficulty === "hard"
          ? -item.complexity
          : Math.abs(item.complexity - median);
      candidates.push({ ...item, preference });
    }
  }

  if (chosen.size < requestedCount) {
    candidates.sort((a, b) => a.preference - b.preference || a.originalIndex - b.originalIndex);
    for (const item of candidates) {
      if (chosen.size >= requestedCount) break;
      chosen.add(item.question);
    }
  }

  return questions.filter((question) => chosen.has(question));
}

export function getSpaceShooterLevel(correctAnswers: number, difficulty: SpaceShooterDifficulty | string): number {
  const safeCount = Number.isFinite(correctAnswers) ? Math.max(0, Math.min(1_000_000, Math.floor(correctAnswers))) : 0;
  return Math.floor(safeCount / SPACE_SHOOTER_DIFFICULTIES[normalizeSpaceShooterDifficulty(difficulty)].questionsPerLevel) + 1;
}

export interface SpaceBossState {
  active: boolean;
  defeated: boolean;
  health: number;
  maximumHealth: number;
}

export function getSpaceShooterBossState(
  correctAnswers: number,
  difficultyValue: SpaceShooterDifficulty | string,
): SpaceBossState {
  const difficulty = normalizeSpaceShooterDifficulty(difficultyValue);
  const config = SPACE_SHOOTER_DIFFICULTIES[difficulty];
  const safeCount = Number.isFinite(correctAnswers) ? Math.max(0, Math.min(1_000_000, Math.floor(correctAnswers))) : 0;
  const level = getSpaceShooterLevel(safeCount, difficulty);
  const active = level % 3 === 0;
  const progress = safeCount % config.questionsPerLevel;
  const health = active ? Math.max(0, config.bossHits - progress) : 0;
  return { active, defeated: active && health === 0, health, maximumHealth: config.bossHits };
}

export function getSpaceShooterBestScore(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1_000_000_000, Math.floor(numeric)));
}
