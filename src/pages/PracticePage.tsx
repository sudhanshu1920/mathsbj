import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Timer, ChevronDown, ChevronUp, Zap, Trophy, ThumbsUp, Dumbbell, Sparkles, Shuffle, ListOrdered, Play, Flame, Plus, Minus, ListChecks, Keyboard, CarFront } from 'lucide-react';
import SwipeBack from '@/components/SwipeBack';
import { Switch } from '@/components/ui/switch';
import Particles from '@/components/Particles';
import { saveResult } from '@/lib/progress';
import { addSeconds as addStreakSeconds } from '@/lib/streak';
import { recordAnswer } from '@/lib/analytics';
import { getSettings, isActive, markInteraction, getTablesProMode, setTablesProMode } from '@/lib/settings';
import { awardCorrectXP, acknowledgeLevel } from '@/lib/xp';
import { playClick, playRightAnswer, playWrong, playLevelUp, playSubmit } from '@/lib/sound';
import { MOTION } from '@/lib/motion';
import XPBar from '@/components/XPBar';
import ThemeToggle from '@/components/ThemeToggle';
import DesktopModeToggle from '@/components/DesktopModeToggle';
import MathKeypad from '@/components/MathKeypad';
import AnswerFeedback from '@/components/AnswerFeedback';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

import { getTrigQuestions, getTrigAngles, buildTrigOptions, isTrigAnswerCorrect, TRIG_FUNCTIONS, type TrigFunction, type TrigAngle } from '@/lib/trigData';
import { ELEMENTS, formatMass, type PeriodicMassMode, type PeriodicQuestionType } from '@/lib/periodicTable';
import { buildQuestionPool, MAX_REPETITION, sanitizeRepetition } from '@/lib/quizRepetition';
import { enqueueQuestionRetry, ensureOutstandingQuestionRetries, getQuizCompletionPercent, identifyQuizQuestions, shouldFinishQuestionQueue } from '@/lib/quizRetryQueue';
import { TOPIC_ICON_MAP, type AppTopicId } from '@/lib/topicIcons';
import { getSquareRootAnswer, getCubeRootAnswer, isRootAnswerCorrect } from '@/lib/rootMath';
import { PERCENTAGE_PRESETS, type PercentagePresetId, resolvePercentagePresets, togglePercentagePresetIds } from '@/lib/percentagePresets';
import { CHALLENGE_MINUTES, formatChallengeTime, getChallengeDurationSeconds, getRemainingSeconds, getTimerProgressPercent, getTimerModeFromToggle, isQuestionCountSelectionDisabled, shouldUseInfiniteQuestionPool, type ChallengeMinutes, type QuizTimerMode } from '@/lib/quizTimer';
import MCQWithGame from '@/components/MCQWithGame';
import MCQJumpAdventure from '@/components/MCQJumpAdventure';
import GameModeSelector, { type MCQGameVariant } from '@/components/GameModeSelector';
import { buildMCQGameOptions } from '@/lib/mcqGame';
import { createMCQGateMappings } from '@/lib/mcqGamePhysics';

type PracticeMode = 'mcq' | 'input' | 'game';

type ArithmeticOperation = 'addition' | 'subtraction';

interface TopicRange {
  from: number;
  to: number;
  operand1DigitCounts?: number[];
  operand2DigitCounts?: number[];
  // Legacy single-value fields remain supported for existing callers/configs.
  operand1DigitCount?: number;
  operand2DigitCount?: number;
  arithmeticOperations?: ArithmeticOperation[];
  exponentFrom?: number;
  exponentTo?: number;
  pctRangeMode?: 'preset' | 'custom';
  pctPresetIds?: string[];
  pctNumFrom?: number;
  pctDenFrom?: number;
  pctNumTo?: number;
  pctDenTo?: number;
  periodicQuestionTypes?: PeriodicQuestionType[];
  periodicMassMode?: PeriodicMassMode;
  trigFunctions?: TrigFunction[];
  trigProMode?: boolean;
}

interface PracticeConfig {
  topics: { id: string; label: string; range: TopicRange }[];
  count: number;
  infinite: boolean;
  mode: PracticeMode;
  timerMode: QuizTimerMode;
  timerSeconds: number;
  challengeDurationSeconds?: number;
  sequential: boolean;
  repetitionEnabled: boolean;
  repetitionByTopic: Record<string, number>;
}

type AnswerType = 'decimal-pct' | 'mixed-pct' | 'fraction' | 'trig' | 'text';

interface MixedPct {
  whole: number;
  numerator: number;
  denominator: number;
}

interface Question {
  topicId?: string;
  quizQuestionId?: string;
  quizIsRetry?: boolean;
  questionId?: string;
  percentagePresetId?: PercentagePresetId;
  trigFunctionId?: TrigFunction;
  trigAngle?: TrigAngle;
  text: string;
  operation?: '+' | '−';
  operand1?: number;
  operand2?: number;
  operand1DigitCount?: number;
  operand2DigitCount?: number;
  superscript?: string;
  answer: number | string;
  answerType?: AnswerType;
  mixedPctAnswer?: MixedPct;
  options?: (number | string)[];
  optionsMixed?: (MixedPct | null)[];
  questionMixed?: MixedPct;
  questionFraction?: { n: number; d: number };
  topicLabel?: string;
  optionPool?: (number | string)[];
  // Root questions keep the exact mathematical value separately so display
  // precision never becomes the internal source of truth.
  validationAnswer?: number;
  answerPrecision?: number;
}

const TOPIC_DEFAULTS = [
  { id: 'tables' as AppTopicId, defaultRange: { from: 1, to: 20 } },
  { id: 'squares' as AppTopicId, defaultRange: { from: 1, to: 50 } },
  { id: 'roots' as AppTopicId, defaultRange: { from: 1, to: 30 } },
  { id: 'cubes' as AppTopicId, defaultRange: { from: 1, to: 30 } },
  { id: 'cube-roots' as AppTopicId, defaultRange: { from: 1, to: 20 } },
  { id: 'powers' as AppTopicId, defaultRange: { from: 2, to: 10, exponentFrom: 1, exponentTo: 5 } },
  { id: 'percentage' as AppTopicId, defaultRange: { from: 2, to: 10, pctRangeMode: 'preset' as const, pctPresetIds: [] as string[] } },
  { id: 'addition-subtraction-digits' as AppTopicId, defaultRange: { from: 2, to: 2, operand1DigitCounts: [2], operand2DigitCounts: [2], operand1DigitCount: 2, operand2DigitCount: 2, arithmeticOperations: ['addition', 'subtraction'] as ArithmeticOperation[] } },
  { id: 'trig' as AppTopicId, defaultRange: { from: 0, to: 360, trigFunctions: [...TRIG_FUNCTIONS], trigProMode: false } },
  { id: 'periodic-table' as AppTopicId, defaultRange: { from: 1, to: 30, periodicQuestionTypes: ['atomic-number', 'symbol', 'name', 'mass'] as PeriodicQuestionType[] } },
];

const TOPICS = TOPIC_DEFAULTS.map((topic) => ({
  ...topic,
  label: TOPIC_ICON_MAP[topic.id].label,
}));

const COUNTS = [10, 20, 25, 50];
const REPETITION_OPTIONS = [1, 2, 3, 5, 10] as const;
const DIGIT_COUNT_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);
const DIGIT_ARITHMETIC_POOL_SIZE = 100;

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function toMixed(n: number, d: number): MixedPct | null {
  const val = (n / d) * 100;
  const whole = Math.floor(val);
  const remNum = Math.round((val - whole) * d);
  if (remNum === 0) return null;
  const g = gcd(remNum, d);
  return { whole, numerator: remNum / g, denominator: d / g };
}

function toDecimalPct(n: number, d: number): string {
  const val = (n / d) * 100;
  return val % 1 === 0 ? `${val}%` : `${val.toFixed(2)}%`;
}

function mixedToString(m: MixedPct): string {
  return `${m.whole > 0 ? m.whole + ' ' : ''}${m.numerator}/${m.denominator}%`;
}

// Helper to generate a range array that supports ascending, descending, and single value
const MAX_QUIZ_RANGE_VALUE = 200;
const MAX_POWER_EXPONENT = 20;

function getSelectedDigitCounts(range: TopicRange, operand: 1 | 2): number[] {
  const selected = operand === 1 ? range.operand1DigitCounts : range.operand2DigitCounts;
  if (Array.isArray(selected)) return selected;

  const legacy = operand === 1 ? range.operand1DigitCount : range.operand2DigitCount;
  return [legacy ?? 2];
}

export function isValidPracticeRange(topicId: string, range: TopicRange | undefined): boolean {
  if (!range) return false;

  const integerInRange = (value: unknown, min: number, max: number) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

  if (topicId === 'trig') {
    const functions = range.trigFunctions;
    return (range.trigProMode === undefined || typeof range.trigProMode === 'boolean') &&
      Array.isArray(functions) &&
      functions.length > 0 &&
      functions.every((fn): fn is TrigFunction => TRIG_FUNCTIONS.includes(fn as TrigFunction));
  }

  if (!integerInRange(range.from, 1, MAX_QUIZ_RANGE_VALUE) ||
      !integerInRange(range.to, 1, MAX_QUIZ_RANGE_VALUE)) {
    return false;
  }

  if (topicId === 'periodic-table') {
    const types = range.periodicQuestionTypes;
    return Array.isArray(types) &&
      types.length > 0 &&
      types.every((type) => type === 'atomic-number' || type === 'symbol' || type === 'name' || type === 'mass') &&
      (!types.includes('mass') || range.periodicMassMode === 'round' || range.periodicMassMode === 'exact') &&
      range.from <= 118 &&
      range.to <= 118;
  }

  if (topicId === 'addition-subtraction-digits') {
    const operations = range.arithmeticOperations;
    const operand1Digits = getSelectedDigitCounts(range, 1);
    const operand2Digits = getSelectedDigitCounts(range, 2);
    const validDigitSelections = (digits: number[]) =>
      digits.length > 0 &&
      new Set(digits).size === digits.length &&
      digits.every((value) => integerInRange(value, 1, 10));

    return Array.isArray(operations) &&
      operations.length > 0 &&
      operations.every((operation) => operation === 'addition' || operation === 'subtraction') &&
      validDigitSelections(operand1Digits) &&
      validDigitSelections(operand2Digits);
  }

  if (topicId === 'powers') {
    return integerInRange(range.exponentFrom ?? 1, 1, MAX_POWER_EXPONENT) &&
      integerInRange(range.exponentTo ?? 10, 1, MAX_POWER_EXPONENT);
  }

  if (topicId === 'percentage' && range.pctRangeMode === 'preset') {
    return resolvePercentagePresets(range).length > 0;
  }

  if (topicId === 'percentage' && range.pctRangeMode === 'custom') {
    const validNumerators =
      integerInRange(range.pctNumFrom, 0, MAX_QUIZ_RANGE_VALUE) &&
      integerInRange(range.pctNumTo, 0, MAX_QUIZ_RANGE_VALUE);
    const validDenominators =
      integerInRange(range.pctDenFrom, 1, MAX_QUIZ_RANGE_VALUE) &&
      integerInRange(range.pctDenTo, 1, MAX_QUIZ_RANGE_VALUE);
    if (!validNumerators || !validDenominators) return false;

    // The existing generator supports two custom forms: a numerator interval
    // over one denominator, or a unit-fraction denominator interval.
    if (range.pctDenFrom === range.pctDenTo) {
      return range.pctNumFrom! <= range.pctNumTo!;
    }
    return range.pctNumFrom === 1 &&
      range.pctNumTo === 1 &&
      range.pctDenFrom <= range.pctDenTo;
  }

  return true;
}

function clampQuizValue(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback;
}

// Keep user-controlled ranges bounded so malformed/huge inputs cannot allocate
// runaway question arrays. Normal app ranges remain unchanged.
function rangeArray(from: number, to: number, maxItems = MAX_QUIZ_RANGE_VALUE): number[] {
  const safeFrom = clampQuizValue(from, -maxItems, maxItems, 0);
  const safeTo = clampQuizValue(to, -maxItems, maxItems, 0);
  const step = safeFrom <= safeTo ? 1 : -1;
  const length = Math.min(Math.abs(safeTo - safeFrom) + 1, maxItems);
  return Array.from({ length }, (_, i) => safeFrom + i * step);
}

function randomDigitNumber(digits: number): number {
  const safeDigits = clampQuizValue(digits, 1, 10, 1);
  const min = 10 ** (safeDigits - 1);
  const max = (10 ** safeDigits) - 1;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function generateDigitArithmeticQuestions(
  label: string,
  operand1DigitCounts: number[],
  operand2DigitCounts: number[],
  selectedOperations: ArithmeticOperation[] = ['addition', 'subtraction'],
): Question[] {
  const normalizeDigits = (counts: number[]) => [...new Set(
    counts.filter((digits) => Number.isInteger(digits) && digits >= 1 && digits <= 10),
  )].sort((a, b) => a - b);
  const firstDigits = normalizeDigits(operand1DigitCounts);
  const secondDigits = normalizeDigits(operand2DigitCounts);
  if (firstDigits.length === 0 || secondDigits.length === 0) return [];

  const operations = selectedOperations.filter(
    (operation): operation is ArithmeticOperation => operation === 'addition' || operation === 'subtraction',
  );
  const activeOperations: ArithmeticOperation[] = operations.length > 0 ? operations : ['addition', 'subtraction'];
  const digitPairs: { first: number; second: number }[] = [];
  for (const first of firstDigits) {
    for (const second of secondDigits) digitPairs.push({ first, second });
  }
  const groups: {
    firstDigits: number;
    secondDigits: number;
    operation: ArithmeticOperation;
    questions: Question[];
  }[] = [];

  for (const pair of digitPairs) {
    for (const operation of activeOperations) {
      // Keep ordered operand configurations distinct, including mirrored
      // subtraction ranges; values are reordered only for display.
      groups.push({
        firstDigits: pair.first,
        secondDigits: pair.second,
        operation,
        questions: [],
      });
    }
  }
  if (groups.length === 0) return [];

  // Keep the historical pool size for common configurations while ensuring
  // every selected digit/operation combination contributes at least one item.
  const targetPoolSize = Math.max(DIGIT_ARITHMETIC_POOL_SIZE, groups.length);
  const baseQuota = Math.floor(targetPoolSize / groups.length);
  const extraQuota = targetPoolSize % groups.length;
  const seen = new Set<string>();

  groups.forEach((group, groupIndex) => {
    const quota = baseQuota + (groupIndex < extraQuota ? 1 : 0);
    let attempts = 0;
    const maxAttempts = Math.max(250, quota * 80);

    while (group.questions.length < quota && attempts < maxAttempts) {
      const operand1 = randomDigitNumber(group.firstDigits);
      const operand2 = randomDigitNumber(group.secondDigits);
      const subtraction = group.operation === 'subtraction';
      // Subtraction retains the established non-negative displayed result.
      const left = subtraction ? Math.max(operand1, operand2) : operand1;
      const right = subtraction ? Math.min(operand1, operand2) : operand2;
      const operator = subtraction ? '−' : '+';
      const key = left + operator + right;
      attempts += 1;

      if (seen.has(key)) continue;
      seen.add(key);
      group.questions.push({
        text: left + ' ' + operator + ' ' + right + ' = ?',
        answer: subtraction ? left - right : left + right,
        topicLabel: label,
        operation: operator,
        operand1,
        operand2,
        operand1DigitCount: group.firstDigits,
        operand2DigitCount: group.secondDigits,
      });
    }
  });

  // Interleave combinations so Sequential quizzes include broad digit-range
  // coverage before filling a second question from any one combination.
  const questions: Question[] = [];
  for (let index = 0; groups.some((group) => index < group.questions.length); index += 1) {
    for (const group of groups) {
      const question = group.questions[index];
      if (question) questions.push(question);
    }
  }
  return questions;
}
function generateQuestionsForTopic(topicId: string, range: TopicRange, label: string): Question[] {
  const questions: Question[] = [];
  const { from, to } = range;
  const safeFrom = clampQuizValue(from, 1, MAX_QUIZ_RANGE_VALUE, 1);
  const safeTo = clampQuizValue(to, 1, MAX_QUIZ_RANGE_VALUE, safeFrom);
  const nums = rangeArray(safeFrom, safeTo);

  if (topicId === 'addition-subtraction-digits') {
    return generateDigitArithmeticQuestions(
      label,
      getSelectedDigitCounts(range, 1),
      getSelectedDigitCounts(range, 2),
      range.arithmeticOperations,
    );
  }

  if (topicId === 'tables') {
    const proMax = getTablesProMode() ? 20 : 10;
    const multipliers = from <= to ? rangeArray(1, proMax) : rangeArray(proMax, 1);
    for (const n of nums) {
      for (const m of multipliers) {
        questions.push({ text: `${n} × ${m} = ?`, answer: n * m, topicLabel: label });
      }
    }
  } else if (topicId === 'squares') {
    for (const n of nums) {
      questions.push({ text: `${n}² = ?`, answer: n * n, topicLabel: label });
    }
  } else if (topicId === 'roots' || topicId === 'square-roots') {
    for (const n of nums) {
      const root = getSquareRootAnswer(n);
      questions.push({
        text: `√${n} = ?`,
        answer: root.answer,
        validationAnswer: root.exact,
        answerPrecision: root.precision,
        topicLabel: label,
      });
    }
  } else if (topicId === 'cubes') {
    for (const n of nums) {
      questions.push({ text: `${n}³ = ?`, answer: n * n * n, topicLabel: label });
    }
  } else if (topicId === 'cube-roots') {
    for (const n of nums) {
      const root = getCubeRootAnswer(n);
      questions.push({
        text: `∛${n} = ?`,
        answer: root.answer,
        validationAnswer: root.exact,
        answerPrecision: root.precision,
        topicLabel: label,
      });
    }
  } else if (topicId === 'powers') {
    const expFrom = clampQuizValue(range.exponentFrom ?? 1, 1, MAX_POWER_EXPONENT, 1);
    const expTo = clampQuizValue(range.exponentTo ?? 10, 1, MAX_POWER_EXPONENT, expFrom);
    const exps = rangeArray(expFrom, expTo, MAX_POWER_EXPONENT);
    for (const n of nums) {
      for (const e of exps) {
        questions.push({ text: `${n}`, superscript: `${e}`, answer: Math.pow(n, e), topicLabel: label });
      }
    }
  } else if (topicId === 'trig') {
    for (const tq of getTrigQuestions(range.trigFunctions ?? TRIG_FUNCTIONS, getTrigAngles(range.trigProMode === true))) {
      questions.push({
        questionId: tq.id,
        trigFunctionId: tq.fn,
        trigAngle: tq.angle,
        text: tq.text,
        answer: tq.answer,
        answerType: 'trig',
        topicLabel: label,
      });
    }
  } else if (topicId === 'periodic-table') {
    const inRange = nums.map((number) => ELEMENTS[number - 1]).filter(Boolean);
    const selected = (range.periodicQuestionTypes?.length ? range.periodicQuestionTypes : ['atomic-number', 'symbol', 'name', 'mass']) as PeriodicQuestionType[];
    const massMode: PeriodicMassMode = range.periodicMassMode || 'round';
    const typeLabel: Record<PeriodicQuestionType, string> = {
      'atomic-number': 'Atomic Number',
      symbol: 'Symbol',
      name: 'Element Name',
      mass: 'Atomic Mass',
    };
    const optionPool = {
      numbers: inRange.map((el) => el.number),
      symbols: inRange.map((el) => el.symbol),
      names: inRange.map((el) => el.name),
      masses: inRange.map((el) => Number(formatMass(el, massMode).split('[').join('').split(']').join(''))),
    };
    for (const el of inRange) {
      for (const type of selected) {
        const labelWithType = `${label} • ${typeLabel[type]}`;
        const reverse = Math.random() > 0.5;
        if (type === 'atomic-number') {
          questions.push(reverse
            ? { text: `Which element has atomic number ${el.number}?`, answer: el.name, answerType: 'text', optionPool: optionPool.names, topicLabel: labelWithType }
            : { text: `What is the atomic number of ${el.name}?`, answer: el.number, optionPool: optionPool.numbers, topicLabel: labelWithType });
        } else if (type === 'symbol') {
          questions.push(reverse
            ? { text: `Which element has the symbol ${el.symbol}?`, answer: el.name, answerType: 'text', optionPool: optionPool.names, topicLabel: labelWithType }
            : { text: `What is the symbol of ${el.name}?`, answer: el.symbol, answerType: 'text', optionPool: optionPool.symbols, topicLabel: labelWithType });
        } else if (type === 'name') {
          questions.push({
            text: `What is the name of element number ${el.number}?`,
            answer: el.name,
            answerType: 'text',
            optionPool: optionPool.names,
            topicLabel: labelWithType,
          });
        } else {
          const massText = formatMass(el, massMode);
          const massValue = Number(massText.replace(/[\\[\\]]/g, ''));
          const massIsUnique = optionPool.masses.filter((value) => value === massValue).length === 1;
          const useReverse = reverse && massIsUnique;
          questions.push(useReverse
            ? { text: `Which element has atomic mass ${massText}?`, answer: el.name, answerType: 'text', optionPool: optionPool.names, topicLabel: labelWithType }
            : { text: `What is the atomic mass of ${el.name}?`, answer: massValue, optionPool: optionPool.masses, topicLabel: labelWithType });
        }
      }
    }
  } else if (topicId === 'percentage') {
    const pairs: { n: number; d: number; presetId?: PercentagePresetId }[] = [];
    if (range.pctRangeMode === 'preset') {
      const seenPairs = new Set<string>();
      for (const preset of resolvePercentagePresets(range)) {
        for (const d of rangeArray(preset.from, preset.to)) {
          const key = `1/${d}`;
          if (seenPairs.has(key)) continue;
          seenPairs.add(key);
          pairs.push({ n: 1, d, presetId: preset.id });
        }
      }
    } else if (range.pctRangeMode === 'custom' && range.pctNumFrom !== undefined && range.pctDenFrom !== undefined && range.pctNumTo !== undefined && range.pctDenTo !== undefined) {
      if (range.pctDenFrom === range.pctDenTo) {
        const d = range.pctDenFrom;
        const safeNumFrom = clampQuizValue(range.pctNumFrom, 0, MAX_QUIZ_RANGE_VALUE, 0);
        const safeNumTo = clampQuizValue(range.pctNumTo, 0, MAX_QUIZ_RANGE_VALUE, safeNumFrom);
        const pctNums = rangeArray(safeNumFrom, safeNumTo);
        for (const n of pctNums) {
          pairs.push({ n, d });
        }
      } else {
        const safeDenFrom = clampQuizValue(range.pctDenFrom, 1, MAX_QUIZ_RANGE_VALUE, 1);
        const safeDenTo = clampQuizValue(range.pctDenTo, 1, MAX_QUIZ_RANGE_VALUE, safeDenFrom);
        const dens = rangeArray(safeDenFrom, safeDenTo);
        for (const d of dens) {
          if (d === 0) continue;
          pairs.push({ n: 1, d });
        }
      }
    } else {
      const lo = Math.max(1, Math.min(from, to));
      const hi = Math.min(200, Math.max(from, to));
      if (lo === hi) {
        // Single denominator selected from learning:
        //  d < 10  → 10 multiples (1/d .. 10/d)
        //  d >= 10 → 1/d .. d/d
        const d = lo;
        const max = d < 10 ? 10 : d;
        for (let n = 1; n <= max; n++) pairs.push({ n, d });
      } else {
        const dens = rangeArray(from <= to ? lo : hi, from <= to ? hi : lo);
        for (const d of dens) {
          pairs.push({ n: 1, d });
        }
      }
    }

    for (const { n, d, presetId } of pairs) {
      const decPct = toDecimalPct(n, d);
      const mixed = toMixed(n, d);
      const presetMetadata = presetId ? { percentagePresetId: presetId } : {};
      questions.push({ ...presetMetadata, text: `fraction-to-decimal`, questionFraction: { n, d }, answer: decPct, answerType: 'decimal-pct', topicLabel: label });
      if (mixed) {
        questions.push({ ...presetMetadata, text: `fraction-to-mixed`, questionFraction: { n, d }, answer: mixedToString(mixed), answerType: 'mixed-pct', mixedPctAnswer: mixed, topicLabel: label });
      }
      questions.push({ ...presetMetadata, text: `${decPct} = ? (fraction)`, answer: `${n}/${d}`, answerType: 'fraction', topicLabel: label });
      if (mixed) {
        questions.push({ ...presetMetadata, text: `mixed-to-fraction`, questionMixed: mixed, answer: `${n}/${d}`, answerType: 'fraction', topicLabel: label });
      }
    }
  }

  return questions;
}

function selectQuestionsAcrossPresetRanges(questions: Question[], count: number, sequential: boolean): Question[] {
  const groups = PERCENTAGE_PRESETS
    .map((preset) => ({
      id: preset.id,
      questions: questions.filter((question) => question.percentagePresetId === preset.id),
    }))
    .filter((group) => group.questions.length > 0);
  if (groups.length === 0) return [];
  if (!sequential) groups.forEach((group) => shuffleInPlace(group.questions));

  const targetCount = clampQuizValue(count, 0, questions.length, 0);
  const quotas = groups.map(() => 0);
  let selectedCount = 0;
  // Allocate the finite question budget round-robin so each chosen range is
  // represented, while preserving the sequence within each range's own pool.
  while (selectedCount < targetCount) {
    let addedInPass = false;
    for (let index = 0; index < groups.length && selectedCount < targetCount; index += 1) {
      if (quotas[index] >= groups[index].questions.length) continue;
      quotas[index] += 1;
      selectedCount += 1;
      addedInPass = true;
    }
    if (!addedInPass) break;
  }
  return groups.flatMap((group, index) => group.questions.slice(0, quotas[index]));
}


function selectQuestionsWithPresetCoverage(
  questions: Question[],
  count: number,
  presetIds: PercentagePresetId[],
  sequential: boolean,
): Question[] {
  const targetCount = clampQuizValue(count, 0, questions.length, 0);
  if (targetCount === 0) return [];

  const selected = new Set<Question>();
  for (const preset of PERCENTAGE_PRESETS) {
    if (!presetIds.includes(preset.id)) continue;
    const eligible = questions.filter((question) => question.percentagePresetId === preset.id);
    if (eligible.length === 0) continue;
    const required = sequential
      ? eligible[0]
      : eligible[Math.floor(Math.random() * eligible.length)];
    selected.add(required);
    if (selected.size >= targetCount) break;
  }

  const remaining = questions.filter((question) => !selected.has(question));
  if (!sequential) shuffleInPlace(remaining);
  for (const question of remaining) {
    if (selected.size >= targetCount) break;
    selected.add(question);
  }

  // For Sequential, filter the original sequence to retain each topic's
  // existing order. Random mode is shuffled by buildQuestionPool afterwards.
  return questions.filter((question) => selected.has(question));
}

function selectQuestionsWithDigitCoverage(
  questions: Question[],
  count: number,
  sequential: boolean,
): Question[] {
  const targetCount = clampQuizValue(count, 0, questions.length, 0);
  if (targetCount === 0) return [];

  const byCombination = new Map<string, Question[]>();
  for (const question of questions) {
    if (
      question.operand1DigitCount === undefined ||
      question.operand2DigitCount === undefined ||
      !question.operation
    ) continue;

    const key = question.operation + ':' + question.operand1DigitCount + ':' + question.operand2DigitCount;
    const group = byCombination.get(key) ?? [];
    group.push(question);
    byCombination.set(key, group);
  }

  const groups = [...byCombination.values()];
  if (!sequential) shuffleInPlace(groups);
  const selected = new Set<Question>();

  // Reserve one question per available digit/operation combination when the
  // finite question budget permits it, regardless of Sequential/Random mode.
  for (const group of groups) {
    const required = sequential ? group[0] : group[Math.floor(Math.random() * group.length)];
    if (required) selected.add(required);
    if (selected.size >= targetCount) break;
  }

  const remaining = questions.filter((question) => !selected.has(question));
  if (!sequential) shuffleInPlace(remaining);
  for (const question of remaining) {
    if (selected.size >= targetCount) break;
    selected.add(question);
  }

  return questions.filter((question) => selected.has(question));
}

export function generateQuestions(config: PracticeConfig): Question[] {
  const baseQuestions: Question[] = [];

  for (const topic of config.topics) {
    const qs = generateQuestionsForTopic(topic.id, topic.range, topic.label)
      .map((question) => ({ ...question, topicId: topic.id }));
    baseQuestions.push(...qs);
  }

  const isFiniteQuestionSelection =
    !config.repetitionEnabled &&
    !config.infinite &&
    config.timerMode !== 'challenge';
  const selectedPresetIds = config.topics
    .filter((topic) => topic.id === 'percentage' && topic.range.pctRangeMode === 'preset')
    .flatMap((topic) => resolvePercentagePresets(topic.range).map((preset) => preset.id));
  let questionSource = baseQuestions;
  if (isFiniteQuestionSelection && selectedPresetIds.length > 0) {
    questionSource = config.topics.length === 1 && config.topics[0]?.id === 'percentage'
      ? selectQuestionsAcrossPresetRanges(baseQuestions, config.count, config.sequential)
      : selectQuestionsWithPresetCoverage(baseQuestions, config.count, selectedPresetIds, config.sequential);
  } else if (
    isFiniteQuestionSelection &&
    config.topics.length === 1 &&
    config.topics[0]?.id === 'addition-subtraction-digits'
  ) {
    questionSource = selectQuestionsWithDigitCoverage(baseQuestions, config.count, config.sequential);
  }

  const allQuestions = buildQuestionPool(questionSource, {
    enabled: config.repetitionEnabled,
    repetitionByTopic: config.repetitionByTopic,
    sequential: config.sequential,
    count: config.count,
    infinite: config.infinite,
  });

  if (config.mode === 'mcq' || config.mode === 'game') {
    return allQuestions.map((q) => {
      // Trig: build options from the standard trig value pool
      if (q.answerType === 'trig') {
        // Keep the source function/angle identity intact so selection, display,
        // correct answer and distractors all describe the same question.
        const opts = buildTrigOptions({
          id: q.questionId!,
          fn: q.trigFunctionId!,
          angle: q.trigAngle!,
          text: q.text,
          answer: String(q.answer),
        });
        return { ...q, options: opts, optionsMixed: opts.map(() => null) };
      }

      const correct = q.answer;
      const opts = new Set<string>();
      opts.add(String(correct));

      if (q.optionPool) {
        if (q.optionPool.length > 1) {
          const candidates = [...q.optionPool];
          shuffleInPlace(candidates);
          for (const candidate of candidates) {
            if (opts.size >= 4) break;
            if (String(candidate) !== String(correct)) opts.add(String(candidate));
          }
        }
      } else {
        let guard = 0;
        while (opts.size < 4 && guard < 100) {
          guard++;
          if (typeof correct === 'number') {
            const offset = Math.floor(Math.random() * 20) - 10;
            const wrong = correct + offset;
            if (wrong !== correct && wrong >= 0) opts.add(String(wrong));
          } else if (q.answerType === 'decimal-pct') {
            const rd = Math.floor(Math.random() * 49) + 2;
            const rn = q.questionFraction?.n || 1;
            opts.add(toDecimalPct(rn, rd));
          } else if (q.answerType === 'mixed-pct') {
            const rd = Math.floor(Math.random() * 49) + 2;
            const rn = q.questionFraction?.n || 1;
            const m = toMixed(rn, rd);
            if (m) opts.add(mixedToString(m));
            else opts.add(`${Math.floor(Math.random() * 50)}%`);
          } else if (q.answerType === 'fraction') {
            const rd = Math.floor(Math.random() * 49) + 2;
            const rn = Math.floor(Math.random() * 9) + 1;
            opts.add(`${rn}/${rd}`);
          } else {
            const offset = Math.floor(Math.random() * 20) - 10;
            opts.add(String(Number(correct) + offset));
          }
        }
      }

      const shuffled = Array.from(opts);
      shuffleInPlace(shuffled);
      const optionsMixed: (MixedPct | null)[] = shuffled.map((opt) => {
        if (q.answerType === 'mixed-pct') {
          const match = opt.match(/^(\d+)\s+(\d+)\/(\d+)%$/);
          if (match) return { whole: Number(match[1]), numerator: Number(match[2]), denominator: Number(match[3]) };
          const match2 = opt.match(/^(\d+)\/(\d+)%$/);
          if (match2) return { whole: 0, numerator: Number(match2[1]), denominator: Number(match2[2]) };
        }
        return null;
      });

      return { ...q, options: shuffled, optionsMixed };
    });
  }

  return allQuestions;
}

/**
 * Parse a textbook-style number string into a numeric value.
 * Supports: "33", "33.33", "33%", "1/3", "33 1/3", "33 1/3%", "33⅓".
 * Returns null if it cannot be parsed.
 */
function parseMathValue(input: string): number | null {
  if (!input) return null;
  let s = input.trim().replace(/%/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  // Expand vulgar unicode fractions to " a/b"
  const vulgar: Record<string, string> = {
    '½': ' 1/2', '⅓': ' 1/3', '⅔': ' 2/3', '¼': ' 1/4', '¾': ' 3/4',
    '⅕': ' 1/5', '⅖': ' 2/5', '⅗': ' 3/5', '⅘': ' 4/5',
    '⅙': ' 1/6', '⅚': ' 5/6', '⅐': ' 1/7',
    '⅛': ' 1/8', '⅜': ' 3/8', '⅝': ' 5/8', '⅞': ' 7/8',
    '⅑': ' 1/9', '⅒': ' 1/10',
  };
  for (const [k, r] of Object.entries(vulgar)) s = s.split(k).join(r);
  s = s.replace(/\s+/g, ' ').trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/))) {
    const d = Number(m[3]); if (d === 0) return null;
    return Number(m[1]) + Number(m[2]) / d;
  }
  if ((m = s.match(/^(-?\d+)\/(\d+)$/))) {
    const d = Number(m[2]); if (d === 0) return null;
    return Number(m[1]) / d;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeAnswer(input: string, expected: string): boolean {
  const a = parseMathValue(input);
  const b = parseMathValue(expected);
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 0.01;
}

/** True when the user input looks complete enough to evaluate. */
function isLikelyComplete(input: string): boolean {
  const s = input.trim();
  if (!s) return false;
  // Trailing operator/separator = still typing
  if (/[/.\s+]$/.test(s)) return false;
  // "33 1" (mixed without /) or "1/" alone — incomplete
  if (/^\d+\s+\d+$/.test(s)) return false;
  if (/\/$/.test(s)) return false;
  return true;
}

import StackedFraction from '@/components/StackedFraction';

const RenderMixed = ({ mixed, size = 'md' }: { mixed: MixedPct; size?: 'sm' | 'md' | 'lg' }) => (
  <StackedFraction
    whole={mixed.whole}
    numerator={mixed.numerator}
    denominator={mixed.denominator}
    suffix="%"
    size={size}
    color="primary"
  />
);

const RenderFraction = ({ n, d, size = 'lg' }: { n: number; d: number; size?: 'sm' | 'md' | 'lg' }) => (
  <span className="inline-flex items-center gap-2">
    <StackedFraction numerator={n} denominator={d} suffix="" size={size} color="foreground" />
    <span className={`text-foreground font-bold ${size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-lg' : 'text-sm'}`}>= ?</span>
  </span>
);

interface PracticePageProps {
  initialTopic?: string;
  initialContext?: { from?: number; to?: number; number?: number };
  initialMode?: 'mcq' | 'input' | 'game';
  initialExtras?: { timerEnabled?: boolean; timerSeconds?: number; infinite?: boolean; trigFunctions?: TrigFunction[]; trigProMode?: boolean; count?: number; periodicQuestionTypes?: PeriodicQuestionType[]; periodicMassMode?: PeriodicMassMode };
  onExit?: () => void;
  onExitCancelled?: () => void;
  externalBackRequest?: number;
  fromLearning?: boolean;
  onQuizStart?: (mode: PracticeMode) => void;
  onQuizFinish?: () => void;
  onQuizReset?: () => void;
}

const TopicIconForTopic = ({ topicId }: { topicId: AppTopicId }) => {
  const config = TOPIC_ICON_MAP[topicId];
  if (config.symbol) {
    return <span className="inline-flex min-w-[1.25rem] items-center justify-center font-display text-base font-black leading-none" aria-hidden="true">{config.symbol}</span>;
  }
  if (!config.icon) return null;
  const Icon = config.icon;
  return (
    <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
      <Icon size={17} strokeWidth={2.3} />
      {config.badge && (
        <span className="absolute -right-1 -top-1 rounded-sm bg-background/80 px-0.5 font-display text-[7px] font-black leading-none text-current">
          {config.badge}
        </span>
      )}
    </span>
  );
};

const PracticePage = ({ initialTopic, initialContext, initialMode, initialExtras, onExit, onExitCancelled, externalBackRequest, fromLearning, onQuizStart, onQuizFinish, onQuizReset }: PracticePageProps) => {
  const [config, setConfig] = useState<PracticeConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [startError, setStartError] = useState<string | null>(null);
  const [originalQuestionCount, setOriginalQuestionCount] = useState(0);
  const [completedQuestionIds, setCompletedQuestionIds] = useState<Set<string>>(() => new Set());
  const [retriedQuestionIds, setRetriedQuestionIds] = useState<Set<string>>(() => new Set());
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [finished, setFinished] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [selectedOption, setSelectedOptionState] = useState<number | null>(null);
  const selectedOptionRef = useRef<number | null>(null);
  const setSelectedOption = useCallback((nextOption: number | null) => {
    // Keep the selection guard synchronized before React schedules the HUD render.
    selectedOptionRef.current = nextOption;
    setSelectedOptionState(nextOption);
  }, []);
  const [finalSubmitReady, setFinalSubmitReadyState] = useState(false);
  const finalSubmitReadyRef = useRef(false);
  const setFinalSubmitReady = useCallback((ready: boolean) => {
    // The timer and late gate callbacks must observe final readiness immediately.
    finalSubmitReadyRef.current = ready;
    setFinalSubmitReadyState(ready);
  }, []);
  const [timeLeft, setTimeLeft] = useState(0);
  const [challengeTimeLeft, setChallengeTimeLeft] = useState(0);
  const [timerRunId, setTimerRunId] = useState(0);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [xpPop, setXpPop] = useState<{ id: number; amount: number; bonus: number } | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [sessionXP, setSessionXP] = useState(0);
  const xpPopId = useRef(0);
  const quizStartLockRef = useRef(false);
  const questionsRef = useRef<Question[]>([]);
  const originalQuestionsRef = useRef<Question[]>([]);
  const originalQuestionCountRef = useRef(0);
  const completedQuestionIdsRef = useRef<Set<string>>(new Set());
  const retriedQuestionIdsRef = useRef<Set<string>>(new Set());
  const questionPoolGenerationRef = useRef(0);
  const levelUpTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const xpPopTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const answerLockRef = useRef(false);
  // Keep timer callbacks on the latest answer handler without recreating the interval.
  // Production APK build requested after Quiz crash fix.
  const handleAnswerRef = useRef<(answer: number | string | null) => void>(() => {});
  const finishLockRef = useRef(false);
  const answerAdvanceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const sessionIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const questionDeadlineRef = useRef<number | null>(null);
  const challengeDeadlineRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout>>();
  // externalBackRequest is an edge-triggered signal from the app shell.
  // Ignore the initial value and consume each new request exactly once.
  const lastExternalBackRequestRef = useRef(externalBackRequest ?? 0);

  // Setup form state - multi-topic
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(
    initialTopic ? new Set([initialTopic === 'square-roots' ? 'roots' : initialTopic]) : new Set(['tables'])
  );
  const [topicRanges, setTopicRanges] = useState<Record<string, TopicRange>>(() => {
    const defaults: Record<string, TopicRange> = {};
    for (const t of TOPICS) {
      defaults[t.id] = { ...t.defaultRange };
    }
    if (initialTopic && initialContext) {
      const tid = initialTopic === 'square-roots' ? 'roots' : initialTopic;
      defaults[tid] = {
        ...defaults[tid],
        from: initialContext.from || initialContext.number || defaults[tid].from,
        to: initialContext.to || initialContext.number || defaults[tid].to,
      };
    }
    return defaults;
  });
  const [expandedTopic, setExpandedTopic] = useState<string | null>(() => initialTopic === 'periodic-table' ? 'periodic-table' : null);
  const [tablesProMode, setTablesProModeState] = useState<boolean>(() => getTablesProMode());
  const [count, setCount] = useState(10);
  const [infinite, setInfinite] = useState(false);
  const [mode, setMode] = useState<PracticeMode>(initialMode || 'mcq');
  const [selectedGameVariant, setSelectedGameVariant] = useState<MCQGameVariant>('car');
  const [gameSelectionOpen, setGameSelectionOpen] = useState(false);
  const modeBeforeGameSelectionRef = useRef<PracticeMode>('mcq');
  const gameSelectionOpenedAtRef = useRef<number | null>(null);
  const [timerMode, setTimerMode] = useState<QuizTimerMode>('perQuestion');
  const [timerSeconds, setTimerSeconds] = useState(10);
  const [challengeMinutes, setChallengeMinutes] = useState<ChallengeMinutes>(1);
  const [sequential, setSequential] = useState(false);
  const [repetitionEnabled, setRepetitionEnabled] = useState(false);
  const [topicRepetitions, setTopicRepetitions] = useState<Record<string, number>>(() => (
    Object.fromEntries(TOPICS.map((topic) => [topic.id, 1]))
  ));

  // Reuse the canonical Tables Pro Mode setting shared with Learning Mode.
  // The question generator reads the same setting when a new Quiz starts.
  useEffect(() => {
    const syncTablesProMode = () => setTablesProModeState(getTablesProMode());
    window.addEventListener('tables-pro-updated', syncTablesProMode);
    window.addEventListener('storage', syncTablesProMode);
    return () => {
      window.removeEventListener('tables-pro-updated', syncTablesProMode);
      window.removeEventListener('storage', syncTablesProMode);
    };
  }, []);

  const handleTablesProModeChange = useCallback((enabled: boolean) => {
    setTablesProMode(enabled);
    setTablesProModeState(enabled);
  }, []);

  const startPractice = useCallback((cfg: PracticeConfig) => {
    // Guard rapid/programmatic duplicate starts as well as the disabled setup button.
    if (quizStartLockRef.current) return;
    const invalidTopic = cfg.topics.find((topic) => !isValidPracticeRange(topic.id, topic.range));
    if (invalidTopic) {
      setStartError(
        invalidTopic.id === 'percentage' && invalidTopic.range.pctRangeMode === 'custom'
          ? 'Check the Percentage custom range: use whole numbers, valid denominators, and an ascending range.'
          : invalidTopic.id === 'percentage'
            ? 'Select at least one valid Percentage preset range.'
            : `Check the selected range for ${invalidTopic.label}.`,
      );
      return;
    }

    const normalizedConfig: PracticeConfig = {
      ...cfg,
      // Timer mode is a single source of truth; a Challenge can never leave
      // the per-question countdown enabled in the underlying session config.
      timerMode: cfg.timerMode,
      challengeDurationSeconds: cfg.timerMode === 'challenge'
        ? Math.max(1, Math.floor(cfg.challengeDurationSeconds ?? 60))
        : undefined,
      // Challenge owns session length by time, never by the saved Questions
      // selector. Generate a recyclable full pool for the entire time window.
      // Outside Challenge, preserve the existing repetition/count semantics.
      infinite: shouldUseInfiniteQuestionPool(cfg.timerMode, cfg.repetitionEnabled, cfg.infinite),
      topics: cfg.topics.map((topic) => ({
        ...topic,
        range: { ...topic.range },
      })),
      repetitionByTopic: Object.fromEntries(
        cfg.topics.map((topic) => [
          topic.id,
          sanitizeRepetition(cfg.repetitionByTopic[topic.id]),
        ]),
      ),
    };
    const generatedQuestions = generateQuestions(normalizedConfig);
    if (generatedQuestions.length === 0) {
      const topicNames = normalizedConfig.topics.map((topic) => topic.label).join(', ');
      setStartError(`No questions could be generated for ${topicNames}. Check the selected custom range and try again.`);
      return;
    }
    quizStartLockRef.current = true;
    setStartError(null);
    questionPoolGenerationRef.current += 1;
    const qs = identifyQuizQuestions(generatedQuestions, questionPoolGenerationRef.current);
    questionsRef.current = qs;
    originalQuestionsRef.current = qs;
    originalQuestionCountRef.current = qs.length;
    completedQuestionIdsRef.current = new Set();
    retriedQuestionIdsRef.current = new Set();
    setOriginalQuestionCount(qs.length);
    setCompletedQuestionIds(new Set());
    setRetriedQuestionIds(new Set());
    setRetryAttempts(0);
    if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current);
    sessionIntervalRef.current = undefined;
    challengeDeadlineRef.current = null;
    questionDeadlineRef.current = normalizedConfig.timerMode === 'perQuestion' && normalizedConfig.timerSeconds < 9999
      ? performance.now() + normalizedConfig.timerSeconds * 1000
      : null;
    setTimerRunId((previous) => previous + 1);
    setConfig(normalizedConfig);
    setQuestions(qs);
    setCurrentQ(0);
    onQuizStart?.(normalizedConfig.mode);
    setScore({ correct: 0, wrong: 0 });
    setFinished(false);
    setFeedback(null);
    setInputValue('');
    setSelectedOption(null);
    setFinalSubmitReady(false);
    setElapsedTime(0);
    setSessionXP(0);
    setTimeLeft(normalizedConfig.timerMode === 'perQuestion' ? normalizedConfig.timerSeconds : 9999);
    challengeDeadlineRef.current = normalizedConfig.timerMode === 'challenge'
      ? performance.now() + (normalizedConfig.challengeDurationSeconds ?? 60) * 1000
      : null;
    setChallengeTimeLeft(normalizedConfig.timerMode === 'challenge'
      ? (normalizedConfig.challengeDurationSeconds ?? 60)
      : 0);
    if (answerAdvanceTimerRef.current) clearTimeout(answerAdvanceTimerRef.current);
    answerAdvanceTimerRef.current = undefined;
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
    if (xpPopTimerRef.current) clearTimeout(xpPopTimerRef.current);
    levelUpTimerRef.current = undefined;
    xpPopTimerRef.current = undefined;
    setLevelUp(null);
    setXpPop(null);
    autoSubmitTimerRef.current = undefined;
    answerLockRef.current = false;
    finishLockRef.current = false;
  }, [onQuizStart, setFinalSubmitReady]);

  useEffect(() => {
    if (config && !finished) quizStartLockRef.current = false;
  }, [config, finished]);

  useLayoutEffect(() => {
    if (initialTopic && initialMode) {
      const mappedTopic = initialTopic === 'square-roots' ? 'roots' : initialTopic;
      const topicInfo = TOPICS.find(t => t.id === mappedTopic);
      const timerOn = initialExtras?.timerEnabled ?? false;
      const range: TopicRange = {
        from: initialContext?.from ?? initialContext?.number ?? (mappedTopic === 'trig' ? 0 : 1),
        to: initialContext?.to ?? initialContext?.number ?? (mappedTopic === 'trig' ? 360 : initialTopic === 'percentage' ? 50 : 10),
        ...(mappedTopic === 'trig'
          ? {
              trigFunctions: [...(initialExtras?.trigFunctions ?? TRIG_FUNCTIONS)],
              // The Learning popup explicitly owns this session's angle range.
              // Standard is the safe default; Quiz Arena keeps its own range control.
              trigProMode: initialExtras?.trigProMode ?? false,
            }
          : {}),
        ...(mappedTopic === 'periodic-table'
          ? {
              periodicQuestionTypes: [...(initialExtras?.periodicQuestionTypes ?? ['atomic-number', 'symbol', 'name', 'mass'])],
              periodicMassMode: initialExtras?.periodicMassMode ?? 'round',
            }
          : {}),
      };
      const cfg: PracticeConfig = {
        topics: [{ id: mappedTopic, label: topicInfo?.label || mappedTopic, range }],
        count: initialExtras?.count ?? 10,
        infinite: initialExtras?.infinite ?? false,
        mode: initialMode,
        timerMode: timerOn ? 'perQuestion' : 'off',
        timerSeconds: initialExtras?.timerSeconds ?? 10,
        sequential: false,
        repetitionEnabled: false,
        repetitionByTopic: {},
      };
      startPractice(cfg);
    }
  }, [
    initialTopic,
    initialMode,
    initialContext?.from,
    initialContext?.to,
    initialContext?.number,
    initialExtras?.timerEnabled,
    initialExtras?.timerSeconds,
    initialExtras?.infinite,
    initialExtras?.trigFunctions,
    initialExtras?.trigProMode,
    initialExtras?.count,
    initialExtras?.periodicQuestionTypes,
    initialExtras?.periodicMassMode,
    startPractice,
  ]);

  const toggleTopic = (id: string) => {
    setSelectedTopics(prev => {
      const next = new Set(prev);
      const wasSelected = next.has(id);
      if (wasSelected) {
        next.delete(id);
        if (expandedTopic === id) setExpandedTopic(null);
      } else {
        next.add(id);
        if (id === 'periodic-table' || id === 'addition-subtraction-digits' || id === 'trig') setExpandedTopic(id);
      }
      return next;
    });
  };

  const updateRange = (
    topicId: string,
    field: string,
    value: number | number[] | string | boolean | PeriodicQuestionType[] | ArithmeticOperation[] | TrigFunction[] | string[] | undefined,
  ) => {
    setStartError(null);
    setTopicRanges(prev => ({
      ...prev,
      [topicId]: { ...prev[topicId], [field]: value },
    }));
  };

  const setPercentageRangeMode = (topicId: string, mode: 'preset' | 'custom') => {
    setStartError(null);
    setTopicRanges((previous) => {
      const current = previous[topicId];
      if (!current) return previous;

      if (mode === 'preset') {
        return { ...previous, [topicId]: { ...current, pctRangeMode: 'preset' } };
      }

      // The previous UI displayed these as fallback values without persisting
      // them. Seed the canonical config in the same update that selects Custom,
      // so validation and generation see exactly what the user sees.
      return {
        ...previous,
        [topicId]: {
          ...current,
          pctRangeMode: 'custom',
          pctNumFrom: current.pctNumFrom ?? 1,
          pctDenFrom: current.pctDenFrom ?? 2,
          pctNumTo: current.pctNumTo ?? 5,
          pctDenTo: current.pctDenTo ?? 2,
        },
      };
    });
  };

  const togglePercentagePresetRange = (topicId: string, presetId: PercentagePresetId) => {
    setStartError(null);
    const preset = PERCENTAGE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    // Functional update prevents rapid taps from toggling against stale state.
    setTopicRanges((previous) => {
      const current = previous[topicId];
      if (!current) return previous;
      const currentIds = Array.isArray(current.pctPresetIds)
        ? current.pctPresetIds
        : PERCENTAGE_PRESETS
          .filter((item) => item.from === current.from && item.to === current.to)
          .map((item) => item.id);
      const nextIds = togglePercentagePresetIds(currentIds, presetId);
      return {
        ...previous,
        [topicId]: {
          ...current,
          pctRangeMode: 'preset',
          pctPresetIds: nextIds,
          // Keep legacy scalar fields coherent, but do not use them as selection state.
          from: preset.from,
          to: preset.to,
        },
      };
    });
  };

  const togglePeriodicQuestionType = (type: PeriodicQuestionType) => {
    const current = topicRanges['periodic-table']?.periodicQuestionTypes || [];
    const next = current.includes(type) ? current.filter((item) => item !== type) : [...current, type];
    updateRange('periodic-table', 'periodicQuestionTypes', next);
  };



  const finishQuiz = useCallback((options?: { playSubmitSound?: boolean }) => {
    if (finishLockRef.current) return;
    finishLockRef.current = true;
    setFinalSubmitReady(false);
    if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current);
    sessionIntervalRef.current = undefined;
    if (answerAdvanceTimerRef.current) clearTimeout(answerAdvanceTimerRef.current);
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    answerAdvanceTimerRef.current = undefined;
    autoSubmitTimerRef.current = undefined;
    challengeDeadlineRef.current = null;
    questionDeadlineRef.current = null;
    if (options?.playSubmitSound) {
      try {
        playSubmit();
      } catch {
        // Audio feedback is non-critical.
      }
    }
    onQuizFinish?.();
    setFinished(true);
  }, [onQuizFinish, setFinalSubmitReady]);

  // One session clock owns elapsed/streak accounting and whichever timer mode
  // was selected. Challenge remaining time is derived from a monotonic deadline
  // so delayed interval ticks cannot extend the configured duration.
  useEffect(() => {
    if (!config || finished || gameSelectionOpen) {
      if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current);
      sessionIntervalRef.current = undefined;
      return;
    }

    if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current);
    sessionIntervalRef.current = setInterval(() => {
      if (finalSubmitReadyRef.current) return;
      if (config.timerMode === 'challenge') {
        const deadline = challengeDeadlineRef.current;
        const remaining = deadline === null
          ? 0
          : getRemainingSeconds(deadline, performance.now());
        setChallengeTimeLeft((previous) => previous === remaining ? previous : remaining);
        if (remaining === 0) {
          finishQuiz();
          return;
        }
      }

      if (config.infinite) {
        setElapsedTime((prev) => prev + 1);
      }

      if (isActive()) {
        addStreakSeconds(1);
      }

      // Derive both the header countdown and timeout from one monotonic
      // deadline. Delayed/background ticks cannot extend the selected duration,
      // and answerLockRef makes a zero-time submission idempotent.
      if (config.timerMode === 'perQuestion' && config.timerSeconds < 9999) {
        const deadline = questionDeadlineRef.current;
        const remaining = deadline === null ? 0 : getRemainingSeconds(deadline, performance.now());
        setTimeLeft((previous) => previous === remaining ? previous : remaining);
        if (remaining === 0 && !answerLockRef.current) {
          handleAnswerRef.current(null);
        }
      }
    }, 1000);

    return () => {
      if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current);
      sessionIntervalRef.current = undefined;
    };
  }, [config, finished, finishQuiz, gameSelectionOpen]);

  const handleAnswer = useCallback(
    (answer: number | string | null) => {
      if (!config || finished || feedback || answerLockRef.current || finishLockRef.current || finalSubmitReadyRef.current) return;
      if (
        config.timerMode === 'challenge' &&
        challengeDeadlineRef.current !== null &&
        performance.now() >= challengeDeadlineRef.current
      ) {
        setChallengeTimeLeft(0);
        finishQuiz();
        return;
      }
      const q = questions[currentQ];
      if (!q) return;
      // The countdown deadline is the source of truth, not a delayed interval tick.
      // A collision delivered after expiry is processed as a timeout, never as an answer.
      const questionExpired =
        answer !== null &&
        config.timerMode === 'perQuestion' &&
        questionDeadlineRef.current !== null &&
        performance.now() >= questionDeadlineRef.current;
      const submittedAnswer = questionExpired ? null : answer;
      if (questionExpired) setTimeLeft(0);
      answerLockRef.current = true;

      let isCorrect = false;
      if (submittedAnswer !== null) {
        if (q.answerType === 'trig') {
          isCorrect = isTrigAnswerCorrect(String(submittedAnswer), String(q.answer));
        } else if (q.answerType === 'text') {
          const normalizeText = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
          isCorrect = normalizeText(String(submittedAnswer)) === normalizeText(String(q.answer));
        } else if (typeof q.answer === 'number') {
          if (q.validationAnswer !== undefined && q.answerPrecision !== undefined) {
            isCorrect = isRootAnswerCorrect(Number(submittedAnswer), q.validationAnswer, q.answerPrecision);
          } else {
            isCorrect = Number(submittedAnswer) === q.answer;
          }
        } else {
          isCorrect = normalizeAnswer(String(submittedAnswer), String(q.answer));
        }
      }

      const questionId = q.quizQuestionId;
      if (q.quizIsRetry) setRetryAttempts((previous) => previous + 1);

      if (isCorrect && questionId) {
        const nextCompleted = new Set(completedQuestionIdsRef.current);
        nextCompleted.add(questionId);
        completedQuestionIdsRef.current = nextCompleted;
        setCompletedQuestionIds(nextCompleted);
      } else if (config.repetitionEnabled && questionId) {
        const nextRetried = new Set(retriedQuestionIdsRef.current);
        nextRetried.add(questionId);
        retriedQuestionIdsRef.current = nextRetried;
        setRetriedQuestionIds(nextRetried);

        const currentQueue = questionsRef.current;
        const nextQueue = enqueueQuestionRetry(currentQueue, currentQ, q, completedQuestionIdsRef.current);
        if (nextQueue.length > currentQueue.length) {
          // Update the ref synchronously: the delayed advance below must see a
          // retry queued by this very submission, not a stale React state value.
          questionsRef.current = nextQueue;
          setQuestions(nextQueue);
        }
      }

      setFeedback(isCorrect ? 'correct' : 'wrong');
      markInteraction();
      // Sound + vibration micro-feedback
      try {
        const settings = getSettings();
        if (settings.vibration && 'vibrate' in navigator) {
          // light=correct, medium=wrong, pulse=streak milestone
          const willMilestone = isCorrect && (score.correct + 1) % 5 === 0;
          if (willMilestone) navigator.vibrate([15, 40, 15, 40, 25]);
          else navigator.vibrate(isCorrect ? 18 : [12, 50, 12]);
        }
        if (isCorrect) {
          playRightAnswer();
        } else {
          playWrong();
        }
      } catch {
        // Audio/vibration feedback is non-critical.
      }
      // Save result for all topics
      const topicId = config.topics.length === 1 ? config.topics[0].id : 'mixed';
      saveResult(topicId, isCorrect);
      // Streak bonus: +1 every 5 in a row correct
      const newStreakCount = isCorrect ? score.correct + 1 : 0;
      const bonus = isCorrect && newStreakCount > 0 && newStreakCount % 5 === 0 ? 1 : 0;
      recordAnswer(isCorrect, bonus);

      // XP system
      if (isCorrect) {
        const gain = awardCorrectXP(newStreakCount);
        xpPopId.current += 1;
        setXpPop({ id: xpPopId.current, amount: gain.total, bonus: gain.bonus });
        setSessionXP((p) => p + gain.total);
        if (gain.leveledUp) {
          setLevelUp(gain.newLevel);
          try {
            playLevelUp();
            const settings = getSettings();
            if (settings.vibration && 'vibrate' in navigator) navigator.vibrate([20, 30, 20, 30, 60]);
          } catch {
            // Audio/vibration feedback is non-critical.
          }
          if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
          levelUpTimerRef.current = setTimeout(() => {
            levelUpTimerRef.current = undefined;
            setLevelUp(null);
            acknowledgeLevel();
          }, 1400);
        }
        if (xpPopTimerRef.current) clearTimeout(xpPopTimerRef.current);
        xpPopTimerRef.current = setTimeout(() => {
          xpPopTimerRef.current = undefined;
          setXpPop((p) => (p && p.id === xpPopId.current ? null : p));
        }, 700);
      }

      const newScore = {
        correct: score.correct + (isCorrect ? 1 : 0),
        wrong: score.wrong + (isCorrect ? 0 : 1),
      };
      setScore(newScore);

      answerAdvanceTimerRef.current = setTimeout(() => {
        answerAdvanceTimerRef.current = undefined;
        if (
          config.timerMode === 'challenge' &&
          challengeDeadlineRef.current !== null &&
          performance.now() >= challengeDeadlineRef.current
        ) {
          setChallengeTimeLeft(0);
          finishQuiz();
          return;
        }
        setFeedback(null);
        setInputValue('');
        setSelectedOption(null);
        // A retry is appended synchronously to questionsRef, so always read
        // the authoritative queue after the feedback delay rather than the
        // questions array captured by this callback's render.
        let latestQuestions = questionsRef.current;
        if (config.repetitionEnabled) {
          const reconciledQueue = ensureOutstandingQuestionRetries(
            latestQuestions,
            currentQ,
            originalQuestionsRef.current,
            completedQuestionIdsRef.current,
          );
          if (reconciledQueue.length > latestQuestions.length) {
            latestQuestions = reconciledQueue;
            questionsRef.current = reconciledQueue;
            setQuestions(reconciledQueue);
          }
        }

        // The Challenge deadline, not the finite question pool, ends a
        // Challenge. Pending retries must be resolved before its pool cycles.
        const isFiniteQuiz = config.timerMode !== 'challenge' &&
          (config.repetitionEnabled || !config.infinite);
        const shouldFinishCurrentPool = shouldFinishQuestionQueue(
          latestQuestions.length,
          currentQ,
          config.repetitionEnabled,
          completedQuestionIdsRef.current.size,
          originalQuestionCountRef.current,
        );
        if (isFiniteQuiz && shouldFinishCurrentPool) {
          if (config.mode === 'game') {
            // The last answer has already been scored by the existing engine.
            // Pause question timing and require a separate whole-test submission.
            questionDeadlineRef.current = null;
            setTimeLeft(0);
            setFinalSubmitReady(true);
          } else {
            // Preserve the established automatic completion flow for non-game quizzes.
            finishQuiz({ playSubmitSound: true });
          }
        } else if (config.infinite && currentQ + 1 >= latestQuestions.length) {
          const generatedNextPool = generateQuestions(config);
          if (generatedNextPool.length === 0) {
            setFinished(true);
            if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current);
          } else {
            // Keep infinite/Challenge mode memory-bounded. A pool receives new
            // identities only after all retries from its previous round clear.
            questionPoolGenerationRef.current += 1;
            const nextPool = identifyQuizQuestions(generatedNextPool, questionPoolGenerationRef.current);
            questionsRef.current = nextPool;
            originalQuestionsRef.current = nextPool;
            originalQuestionCountRef.current = nextPool.length;
            completedQuestionIdsRef.current = new Set();
            setQuestions(nextPool);
            setOriginalQuestionCount(nextPool.length);
            setCompletedQuestionIds(new Set());
            setCurrentQ(0);
            if (config.timerMode === 'perQuestion') {
              questionDeadlineRef.current = config.timerSeconds < 9999
                ? performance.now() + config.timerSeconds * 1000
                : null;
              setTimeLeft(config.timerSeconds);
            }
          }
        } else {
          setCurrentQ(currentQ + 1);
          if (config.timerMode === 'perQuestion') {
            questionDeadlineRef.current = config.timerSeconds < 9999
              ? performance.now() + config.timerSeconds * 1000
              : null;
            setTimeLeft(config.timerSeconds);
          }
        }
        answerLockRef.current = false;
      }, config.mode === 'game' ? 260 : isCorrect ? 350 : 700);
    },
    [config, currentQ, questions, score, finished, feedback, finishQuiz]
  );

  useEffect(() => {
    handleAnswerRef.current = handleAnswer;
  }, [handleAnswer]);

  const handleSubmitInfinite = useCallback(() => {
    if (!config?.infinite || config.repetitionEnabled) return;
    const totalAttempts = score.correct + score.wrong;
    if (totalAttempts === 0) return;
    finishQuiz({ playSubmitSound: true });
  }, [config, score, finishQuiz]);

  useEffect(() => {
    if (!config || config.mode !== 'input' || !inputValue.trim() || feedback) return;
    const q = questions[currentQ];
    if (!q || q.answerType === 'text') return;
    // Avoid premature checking while user is still typing (e.g. "33", "1/").
    if (!isLikelyComplete(inputValue)) return;
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    autoSubmitTimerRef.current = setTimeout(() => {
      if (q.answerType === 'trig') {
        if (isTrigAnswerCorrect(inputValue.trim(), String(q.answer))) handleAnswer(inputValue.trim());
      } else if (typeof q.answer === 'number') {
        const numVal = parseMathValue(inputValue);
        if (numVal !== null) {
          const matches = q.validationAnswer !== undefined && q.answerPrecision !== undefined
            ? isRootAnswerCorrect(numVal, q.validationAnswer, q.answerPrecision)
            : Math.abs(numVal - q.answer) < 1e-9;
          if (matches) handleAnswer(numVal);
        }
      } else {
        if (normalizeAnswer(inputValue.trim(), String(q.answer))) handleAnswer(inputValue.trim());
      }
    }, 150);
    return () => {
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, [inputValue, config, currentQ, questions, feedback, handleAnswer]);

  useEffect(() => {
    if (config?.mode === 'input' && inputRef.current) inputRef.current.focus();
  }, [currentQ, config]);

  const clearSessionTimers = useCallback(() => {
    if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current);
    if (answerAdvanceTimerRef.current) clearTimeout(answerAdvanceTimerRef.current);
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
    if (xpPopTimerRef.current) clearTimeout(xpPopTimerRef.current);
    sessionIntervalRef.current = undefined;
    challengeDeadlineRef.current = null;
    questionDeadlineRef.current = null;
    answerAdvanceTimerRef.current = undefined;
    autoSubmitTimerRef.current = undefined;
    levelUpTimerRef.current = undefined;
    xpPopTimerRef.current = undefined;
    answerLockRef.current = false;
    finishLockRef.current = false;
    setFinalSubmitReady(false);
  }, [setFinalSubmitReady]);

  const resetToPracticeHome = useCallback(() => {
    clearSessionTimers();
    setShowExitDialog(false);
    setConfig(null);
    questionsRef.current = [];
    originalQuestionsRef.current = [];
    originalQuestionCountRef.current = 0;
    completedQuestionIdsRef.current = new Set();
    retriedQuestionIdsRef.current = new Set();
    setQuestions([]);
    setOriginalQuestionCount(0);
    setCompletedQuestionIds(new Set());
    setRetriedQuestionIds(new Set());
    setRetryAttempts(0);
    setCurrentQ(0);
    setScore({ correct: 0, wrong: 0 });
    setFinished(false);
    setFeedback(null);
    setInputValue('');
    setSelectedOption(null);
    setFinalSubmitReady(false);
    setElapsedTime(0);
    setTimeLeft(0);
    setChallengeTimeLeft(0);
    setXpPop(null);
    setLevelUp(null);
    setSessionXP(0);
    onQuizReset?.();
  }, [clearSessionTimers, onQuizReset, setFinalSubmitReady]);

  const handleExitConfirmed = useCallback(() => {
    if (fromLearning && onExit) {
      // Keep the active question branch mounted until the parent switches
      // directly to the originating Learning context. Resetting config to null
      // first would render the Quiz Arena setup branch for an intermediate frame.
      clearSessionTimers();
      onExit();
      return;
    }

    resetToPracticeHome();
  }, [clearSessionTimers, fromLearning, onExit, resetToPracticeHome]);

  const handleExitRequest = useCallback(() => {
    if (
      config?.timerMode === 'challenge' &&
      challengeDeadlineRef.current !== null &&
      performance.now() >= challengeDeadlineRef.current
    ) {
      setChallengeTimeLeft(0);
      finishQuiz();
      return;
    }
    if (showExitDialog) return;
    if (config && !finished) {
      setShowExitDialog(true);
      return;
    }
    if (fromLearning) {
      onExit?.();
      return;
    }
    resetToPracticeHome();
  }, [config, finished, finishQuiz, resetToPracticeHome, showExitDialog, fromLearning, onExit]);

  const handleBackToPractice = useCallback(() => {
    // Used from results screen swipe-back
    if (fromLearning) {
      onExit?.();
    } else {
      resetToPracticeHome();
    }
  }, [resetToPracticeHome, fromLearning, onExit]);

  const openGameSelectorFromActiveGame = useCallback(() => {
    if (
      !config ||
      config.mode !== 'game' ||
      finished ||
      feedback ||
      answerLockRef.current ||
      finishLockRef.current ||
      finalSubmitReadyRef.current
    ) return;
    // Freeze deadlines and the session clock while the game selection screen is open.
    gameSelectionOpenedAtRef.current = performance.now();
    setGameSelectionOpen(true);
  }, [config, finished, feedback]);

  const closeGameSelector = useCallback((nextGame?: MCQGameVariant) => {
    const openedAt = gameSelectionOpenedAtRef.current;
    if (config && openedAt !== null) {
      const pausedDuration = Math.max(0, performance.now() - openedAt);
      if (questionDeadlineRef.current !== null) questionDeadlineRef.current += pausedDuration;
      if (challengeDeadlineRef.current !== null) challengeDeadlineRef.current += pausedDuration;
    }
    gameSelectionOpenedAtRef.current = null;
    setGameSelectionOpen(false);
    setShowExitDialog(false);

    if (nextGame !== undefined) {
      setSelectedGameVariant(nextGame);
      setMode('game');
    } else if (config) {
      // Back from the selector resumes the same quiz question and selected game.
      setMode('game');
    } else {
      setMode(modeBeforeGameSelectionRef.current);
    }
  }, [config]);

  // Safety net for route changes/unmounts: release every session timer/timeout.
  useEffect(() => {
    return () => clearSessionTimers();
  }, [clearSessionTimers]);

  // Index.tsx owns browser/native navigation history and signals this page
  // through externalBackRequest for an active-quiz back action. Treat it as
  // an edge-triggered event so an old request cannot reopen the dialog when
  // a new Practice session is initialized.
  useEffect(() => {
    const request = externalBackRequest ?? 0;
    if (request <= lastExternalBackRequestRef.current) return;
    // During startup, keep the request pending until the active quiz can handle it.
    if (!config || finished) return;

    lastExternalBackRequestRef.current = request;
    if (gameSelectionOpen && config.mode === 'game') {
      closeGameSelector();
      return;
    }
    setShowExitDialog(true);
  }, [externalBackRequest, config, finished, gameSelectionOpen, closeGameSelector]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // RESULTS
  if (finished && config) {
    const totalAttempts = score.correct + score.wrong;
    const accuracy = totalAttempts > 0 ? Math.round((score.correct / totalAttempts) * 100) : 0;
    return (
      <SwipeBack onBack={handleBackToPractice}>
        <div className="quiz-screen quiz-screen--results">
          <div className="app-topbar-page flex items-center justify-between gap-2" data-app-topbar>
            <button onClick={handleBackToPractice} className="h-7 w-7 inline-flex items-center justify-center rounded-full text-primary" aria-label="Back">
              <ArrowLeft size={16} />
            </button>
            <h1 className="font-display font-bold text-sm sm:text-base text-foreground">Quiz Result</h1>
            <div className="flex items-center gap-1.5">
              <ThemeToggle compact />
              <DesktopModeToggle compact />
            </div>
          </div>
          <div className="quiz-results-layout flex flex-col items-center justify-center min-h-[60vh] px-1 py-3">
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="quiz-results-card text-center w-full max-w-md p-4 sm:p-6">
            <div className="mb-4 flex justify-center">
              {accuracy >= 80 ? (
                <Trophy size={52} className="text-warning" />
              ) : accuracy >= 50 ? (
                <ThumbsUp size={52} className="text-primary" />
              ) : (
                <Dumbbell size={52} className="text-muted-foreground" />
              )}
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground mb-1.5">
              {accuracy >= 80 ? 'Excellent!' : accuracy >= 50 ? 'Good Job!' : 'Keep Practicing!'}
            </h2>
            <p className="text-muted-foreground text-sm mb-2">Score: {accuracy}%</p>
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.15 }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full gradient-primary text-primary-foreground font-display font-bold text-sm mb-3"
            >
              <Zap size={16} className="text-warning" />
              +{sessionXP} XP
            </motion.div>
            {config.topics.length > 1 && (
              <p className="text-xs text-muted-foreground mb-4">
                Topics: {config.topics.map(t => t.label).join(', ')}
              </p>
            )}
            <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-4 w-full max-w-xs">
              <div className="text-center">
                <p className="text-3xl font-bold text-success">{score.correct}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-destructive">{score.wrong}</p>
                <p className="text-xs text-muted-foreground">Wrong</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">{totalAttempts}</p>
                <p className="text-xs text-muted-foreground">{config.timerMode === 'challenge' ? 'Solved' : 'Attempted'}</p>
              </div>
            </div>
            {config.repetitionEnabled && config.timerMode !== 'challenge' && (
              <div data-testid="quiz-repetition-results" className="mb-4 w-full max-w-sm rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="font-bold text-foreground">{originalQuestionCount}</p>
                    <p className="text-[11px] text-muted-foreground">Questions</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-success">{completedQuestionIds.size}/{originalQuestionCount}</p>
                    <p className="text-[11px] text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-foreground">{retriedQuestionIds.size}</p>
                    <p className="text-[11px] text-muted-foreground">Repeated</p>
                  </div>
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Incorrect attempts: {score.wrong} · Retry attempts: {retryAttempts}
                </p>
              </div>
            )}
            {config.timerMode === 'challenge' && (
              <p className="text-sm text-muted-foreground mb-4">
                Challenge · {Math.round((config.challengeDurationSeconds ?? 60) / 60)}m
              </p>
            )}
            {config.infinite && <p className="text-sm text-muted-foreground mb-4">Time: {formatTime(elapsedTime)}</p>}
            <div className="flex gap-3">
              <button onClick={() => startPractice(config)} className="quiz-result-action min-h-11 flex-1 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold">Retry</button>
              {fromLearning ? (
                <button onClick={() => onExit?.()} className="quiz-result-action min-h-11 flex-1 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold">Back to Learning</button>
              ) : (
                <button onClick={handleBackToPractice} className="quiz-result-action min-h-11 flex-1 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold">Back to Practice</button>
              )}
            </div>
          </motion.div>
          </div>
        </div>
      </SwipeBack>
    );
  }

  if (gameSelectionOpen && mode === 'game') {
    return (
      <GameModeSelector
        selectedGame={selectedGameVariant}
        onBack={() => closeGameSelector()}
        onSelect={(game) => closeGameSelector(game)}
      />
    );
  }

  // ACTIVE QUESTION
  if (config && questions.length > 0) {
    const q = questions[currentQ];
    if (!q) return null;
    const isLowTime = config.timerMode === 'perQuestion'
      ? timeLeft <= 3
      : config.timerMode === 'challenge' && challengeTimeLeft <= 5;
    const isTimerHidden = config.timerMode === 'off';
    const isQuestionTimerActive = config.timerMode === 'perQuestion' && config.timerSeconds < 9999;
    const isCountdownProgressVisible = isQuestionTimerActive || config.timerMode === 'challenge';
    const countdownDurationSeconds = config.timerMode === 'challenge'
      ? (config.challengeDurationSeconds ?? 60)
      : config.timerSeconds;
    const countdownDeadline = config.timerMode === 'challenge'
      ? challengeDeadlineRef.current
      : questionDeadlineRef.current;
    const countdownProgressPercent = getTimerProgressPercent(
      countdownDeadline,
      countdownDurationSeconds * 1000,
      performance.now(),
    );
    const countdownAnimationKey = config.timerMode === 'challenge'
      ? `${timerRunId}-challenge`
      : `${timerRunId}-${currentQ}`;
    const isPctQuestion = q.answerType === 'decimal-pct' || q.answerType === 'mixed-pct' || q.answerType === 'fraction' || q.answerType === 'trig';
    const totalAttempts = score.correct + score.wrong;
    const isFiniteQuiz = config.timerMode !== 'challenge' &&
      (config.repetitionEnabled || !config.infinite);

    const renderQuestionText = () => {
      if (isPctQuestion && q.questionFraction) {
        return <div className="flex items-center justify-center gap-2"><RenderFraction n={q.questionFraction.n} d={q.questionFraction.d} size="lg" /></div>;
      }
      if (isPctQuestion && q.questionMixed) {
        return <div className="flex flex-col items-center gap-2"><RenderMixed mixed={q.questionMixed} size="lg" /><span className="text-muted-foreground text-lg">= ? (fraction)</span></div>;
      }
      if (isPctQuestion && q.text.includes('% = ?')) {
        return <p className="font-display text-2xl sm:text-3xl font-bold text-foreground break-words">{q.text}</p>;
      }
      return (
        <p className="font-display text-3xl sm:text-4xl font-bold text-foreground break-words">
          {q.text}
          {q.superscript && <sup className="text-primary text-2xl">{q.superscript}</sup>}
        </p>
      );
    };

    const renderAnswerHint = () => {
      if (!q.answerType) return null;
      const hints: Record<string, string> = {
        'decimal-pct': 'Answer in decimal %',
        'mixed-pct': 'Answer in mixed %',
        'fraction': 'Answer as fraction',
        'trig': 'Use √, /, or "Not Defined"',
        'text': 'Type the answer and press Submit',
      };
      return <span className="text-xs text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">{hints[q.answerType] || 'Answer'}</span>;
    };

    const renderOption = (opt: string | number, index: number) => {
      if (isPctQuestion && q.optionsMixed?.[index]) return <RenderMixed mixed={q.optionsMixed[index]!} size="sm" />;
      return <span>{String(opt)}</span>;
    };

    const renderCorrectAnswer = () => {
      if (isPctQuestion && q.mixedPctAnswer) return <RenderMixed mixed={q.mixedPctAnswer} size="md" />;
      return <span className="text-primary">{String(q.answer)}</span>;
    };

    const gameOptions = config.mode === 'game'
      ? buildMCQGameOptions(q.options, q.answer, q.optionPool).map((option) => ({
          ...option,
          label: option.sourceIndex !== null && q.options?.[option.sourceIndex] !== undefined
            ? renderOption(q.options[option.sourceIndex]!, option.sourceIndex)
            : String(option.value) === String(q.answer)
              ? renderCorrectAnswer()
              : <span>{String(option.value)}</span>,
        }))
      : [];
    const gameQuestionKey = String(currentQ) + '-' + String(q.quizQuestionId ?? q.questionId ?? q.text);
    const gameGateMappings = config.mode === 'game'
      ? createMCQGateMappings(gameQuestionKey, gameOptions.map((option) => option.value))
      : [];

    const handleGameOptionSelect = (laneIndex: number, optionValue: string | number, gateId: string): boolean => {
      const option = gameOptions[laneIndex];
      const gate = gameGateMappings[laneIndex];
      if (
        !option ||
        !gate ||
        gate.gateId !== gateId ||
        gate.questionId !== gameQuestionKey ||
        String(gate.optionValue) !== String(option.value) ||
        String(option.value) !== String(optionValue) ||
        feedback ||
        answerLockRef.current ||
        finishLockRef.current ||
        finalSubmitReadyRef.current
      ) return false;

      // Both games use this one guarded entry into the established Quiz Engine.
      // The UI locks synchronously; this handler independently rejects stale identities.
      setSelectedOption(gate.laneIndex);
      handleAnswer(gate.optionValue);
      return true;
    };

    const handleGameFinalSubmit = () => {
      if (finalSubmitReadyRef.current) {
        finishQuiz({ playSubmitSound: true });
      } else {
        handleSubmitInfinite();
      }
    };

    const sharedGameProps = {
      onChangeGame: openGameSelectorFromActiveGame,
      questionKey: gameQuestionKey,
      questionLabel: renderQuestionText(),
      options: gameOptions,
      progressLabel: String(Math.min(currentQ + 1, questions.length)) + ' / ' + String(questions.length),
      timerLabel: config.timerMode === 'challenge'
        ? formatChallengeTime(challengeTimeLeft)
        : config.timerMode === 'perQuestion' && config.timerSeconds < 9999
          ? String(Math.max(0, timeLeft)) + 's'
          : undefined,
      correctAnswer: q.answer,
      feedback,
      selectedOption,
      correctScore: score.correct,
      wrongScore: score.wrong,
      disabled: !!feedback || finished || answerLockRef.current || finishLockRef.current,
      finalSubmitReady,
      canFinalizeTest: finalSubmitReady || (
        config.infinite && !config.repetitionEnabled && config.timerMode !== 'challenge' && score.correct + score.wrong > 0
      ),
      onSelectOption: handleGameOptionSelect,
      onFinalSubmit: handleGameFinalSubmit,
    };

    return (
      <>
      <SwipeBack onBack={handleExitRequest} enabled={config.mode !== 'game'}>
      <div className="quiz-screen quiz-screen--active pb-6">
        <AlertDialog
          open={showExitDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowExitDialog(false);
              onExitCancelled?.();
            }
          }}
        >
          <AlertDialogContent className="practice-exit-dialog quiz-dialog-surface rounded-2xl max-w-[320px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Exit Practice?</AlertDialogTitle>
              <AlertDialogDescription>Your progress will not be saved.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <button
                type="button"
                onClick={handleExitConfirmed}
                className="inline-flex items-center justify-center rounded-xl text-sm font-medium h-10 px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Exit
              </button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="app-topbar-page flex items-center justify-between gap-1.5" data-app-topbar>
          <button
            type="button"
            onClick={handleExitRequest}
            aria-label="Back from Practice"
            className="text-primary flex items-center gap-1"
          >
            <ArrowLeft size={18} />
          </button>
          <div className={`min-w-0 flex-1 px-2 sm:px-3 ${config.timerMode === 'challenge' ? 'max-w-[110px] sm:max-w-[180px]' : 'max-w-[180px]'}`}>
            <XPBar />
          </div>
          {!isTimerHidden && (
            <div className={`flex shrink-0 items-center gap-1.5 rounded-full py-1 ${config.timerMode === 'challenge' ? 'px-2 text-[11px] sm:text-xs' : 'px-3 text-sm'} font-bold ${isLowTime ? 'bg-destructive/20 text-destructive animate-pulse' : 'bg-secondary text-secondary-foreground'}`}>
              <Timer size={14} className="shrink-0" />
              {config.timerMode === 'challenge' ? (
                <>
                  <span className="tabular-nums">{formatChallengeTime(challengeTimeLeft)}</span>
                  <span className="border-l border-current/20 pl-1.5 whitespace-nowrap">Solved {totalAttempts}</span>
                </>
              ) : (
                <span>{timeLeft}s</span>
              )}
            </div>
          )}
          {config.mode !== 'game' && config.infinite && !config.repetitionEnabled ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Q{currentQ + 1}</span>
              <button onClick={handleSubmitInfinite} disabled={totalAttempts === 0}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${totalAttempts > 0 ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}>
                Submit
              </button>
            </div>
          ) : config.repetitionEnabled ? (
            <span data-testid="quiz-completion-count" className="text-sm text-muted-foreground">
              Completed {completedQuestionIds.size}/{originalQuestionCount}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">{currentQ + 1}/{questions.length}</span>
          )}
        </div>

        {/* Topic label */}
        {config.topics.length > 1 && q.topicLabel && (
          <div className="text-center mb-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary">{q.topicLabel}</span>
          </div>
        )}

        {isFiniteQuiz && (
          <div
            data-testid="quiz-overall-progress"
            className={`h-1 bg-secondary rounded-full overflow-hidden ${isCountdownProgressVisible ? 'mb-2' : 'mb-6'}`}
          >
            <motion.div className="h-full gradient-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${config.repetitionEnabled ? getQuizCompletionPercent(completedQuestionIds.size, originalQuestionCount) : ((currentQ + 1) / questions.length) * 100}%` }} />
          </div>
        )}

        {config.infinite && !config.repetitionEnabled && (
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-xs text-muted-foreground">∞ Infinite Mode</span>
            <span className="text-xs text-muted-foreground">{formatTime(elapsedTime)}</span>
          </div>
        )}

        {isCountdownProgressVisible && (
          <div
            role="progressbar"
            aria-label="Question timer"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(countdownProgressPercent)}
            data-testid="question-timer-progress"
            className="question-timer-progress mb-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary/80"
          >
            <div
              key={countdownAnimationKey}
              className={`question-timer-progress__fill h-full w-full rounded-full ${isLowTime ? 'bg-destructive' : 'gradient-success'}`}
              style={{
                transform: `scaleX(${countdownProgressPercent / 100})`,
                transformOrigin: 'right center',
                animationDuration: `${countdownDurationSeconds}s`,
              }}
            />
          </div>
        )}

{config.mode !== 'game' && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="quiz-question-panel relative text-center mb-2 rounded-2xl px-2 py-4 sm:px-4 sm:py-5"
          >
            {renderQuestionText()}
            <div className="mt-2">{renderAnswerHint()}</div>

            <AnimatePresence mode="wait" initial={false}>
              {feedback && (
                <div className="pointer-events-none absolute inset-x-0 -bottom-1 z-10 flex translate-y-1/2 justify-center">
                  <AnswerFeedback
                    key={`feedback-${currentQ}-${feedback}`}
                    status={feedback}
                    correctAnswer={feedback === 'wrong' ? renderCorrectAnswer() : undefined}
                  />
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
        )}

        {/* Floating XP popup */}
        <AnimatePresence>
          {xpPop && (
            <motion.div
              key={xpPop.id}
              initial={{ opacity: 0, y: 10, scale: 0.6 }}
              animate={{ opacity: 1, y: -70, scale: 1.1 }}
              exit={{ opacity: 0, y: -110, scale: 0.9 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            >
              <div className="flex items-center gap-1.5 px-4 py-2 rounded-full gradient-primary text-primary-foreground font-display font-extrabold text-base shadow-[0_0_24px_hsl(var(--primary)/0.7)]">
                <Zap size={16} className="text-warning drop-shadow-[0_0_6px_hsl(var(--warning)/0.8)]" />
                +{xpPop.amount} XP
                {xpPop.bonus > 0 && <Flame size={14} className="text-warning" />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Level up overlay */}
        <AnimatePresence>
          {levelUp !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-background/40 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.4, rotate: -8 }}
                animate={{ scale: [0.4, 1.2, 1], rotate: 0 }}
                transition={{ duration: 0.6, times: [0, 0.6, 1] }}
                className="text-center"
              >
                <div className="mb-2 flex justify-center">
                  <Sparkles size={64} className="text-warning drop-shadow-[0_0_22px_hsl(var(--warning)/0.6)]" />
                </div>
                <div className="font-display font-bold text-3xl text-glow text-foreground">LEVEL {levelUp}</div>
                <div className="text-sm text-muted-foreground mt-1">Level Up!</div>
                <Particles count={24} color="bg-warning" spread={160} duration={1.2} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {config.mode === 'mcq' && q.options && (
          <div className="mcq-options-grid grid gap-2 sm:gap-3 mt-5">
            {q.options.map((opt, i) => {
              let optStyle = 'glass-lite text-foreground border border-border/70 hover:border-primary/50';
              if (feedback && selectedOption === i) {
                optStyle = feedback === 'correct'
                  ? 'bg-success/15 border-2 border-success text-success'
                  : 'bg-destructive/15 border-2 border-destructive text-destructive';
              }
              return (
                <button key={`${currentQ}-${i}`}
                  onClick={() => { if (feedback) return; setSelectedOption(i); handleAnswer(opt); }}
                  className={`quiz-answer-option w-full min-h-12 rounded-xl px-3 py-3 flex items-center justify-center text-center font-display font-bold text-base transition-colors overflow-hidden ${optStyle}`}>
                  {renderOption(opt, i)}
                </button>
              );
            })}
          </div>
        )}

        {config.mode === 'game' && (
          selectedGameVariant === 'jump'
            ? <MCQJumpAdventure {...sharedGameProps} />
            : (
              <MCQWithGame
                {...sharedGameProps}
                durationMs={config.timerMode === 'perQuestion'
                  // Keep the established racing gate timing and collision flow unchanged.
                  ? Math.max(350, config.timerSeconds * 1000 - 300)
                  : config.timerMode === 'challenge' ? 4800 : 5200}
              />
            )
        )}

        {config.mode === 'input' && (
          <div className="quiz-answer-input flex flex-col items-center gap-3 mt-3">
            {q.answerType === 'text' || q.answerType === 'trig' ? (
              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={q.answerType === 'trig' ? 'e.g. 1/2, √3/2, Not Defined' : 'Type symbol or element name'}
                autoFocus
                className="w-full max-w-xs glass-lite rounded-xl px-3 py-3 text-center text-xl sm:text-2xl font-display font-bold text-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-colors"
              />
            ) : (
              <>
                <div
                  className="w-full max-w-xs glass-lite rounded-xl px-3 text-center text-xl sm:text-2xl font-display font-bold text-foreground h-14 flex items-center justify-center overflow-hidden"
                  aria-live="polite"
                >
                  {inputValue ? (
                    <span className="truncate">{inputValue}</span>
                  ) : (
                    <span className="text-muted-foreground text-base font-normal">
                      {q.answerType === 'fraction'
                        ? 'Type fraction e.g. 1/3'
                        : q.answerType === 'mixed-pct'
                          ? 'Type e.g. 16 2/3 %'
                          : q.answerType === 'decimal-pct'
                            ? 'Type answer e.g. 16.67%'
                            : 'Type your answer'}
                    </span>
                  )}
                </div>
                <MathKeypad
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={() => handleAnswer(inputValue.trim())}
                  variant="full"
                  disabled={!!feedback}
                  hideOk
                />
              </>
            )}
            <button
              type="button"
              disabled={!!feedback || !inputValue.trim()}
              onClick={() => handleAnswer(inputValue.trim())}
              className="w-full max-w-[360px] min-w-[180px] min-h-11 rounded-xl gradient-primary text-primary-foreground font-display font-bold tracking-wide text-sm sm:text-base active:scale-[0.99] transition-transform disabled:opacity-60 disabled:pointer-events-none"
            >
              Submit
            </button>
          </div>
        )}
      </div>
      </SwipeBack>

      </>
    );
  }

  // ═══════════════════════════════════
  // SETUP SCREEN - Game Style UI
  // ═══════════════════════════════════

  const periodicRange = topicRanges['periodic-table'];
  const periodicTypes = periodicRange?.periodicQuestionTypes || [];
  const validPeriodicRange = !selectedTopics.has('periodic-table') || (
    Number.isInteger(periodicRange?.from) &&
    Number.isInteger(periodicRange?.to) &&
    periodicRange.from >= 1 && periodicRange.from <= 118 &&
    periodicRange.to >= 1 && periodicRange.to <= 118 &&
    periodicTypes.length > 0 &&
    (!periodicTypes.includes('mass') || !!periodicRange.periodicMassMode)
  );
  const arithmeticValid = !selectedTopics.has('addition-subtraction-digits') || (() => {
    const range = topicRanges['addition-subtraction-digits'];
    const operations = range?.arithmeticOperations || ['addition', 'subtraction'];
    if (!range) return false;
    const digit1 = getSelectedDigitCounts(range, 1);
    const digit2 = getSelectedDigitCounts(range, 2);
    const validSelections = (digits: number[]) =>
      digits.length > 0 &&
      new Set(digits).size === digits.length &&
      digits.every((value) => Number.isInteger(value) && value >= 1 && value <= 10);
    return operations.length > 0
      && operations.every((operation) => operation === 'addition' || operation === 'subtraction')
      && validSelections(digit1)
      && validSelections(digit2);
  })();

  const repetitionValid = !repetitionEnabled || Array.from(selectedTopics).every((tid) => {
    const value = sanitizeRepetition(topicRepetitions[tid]);
    return value >= 1 && value <= MAX_REPETITION;
  });
  const rangesValid = Array.from(selectedTopics).every((tid) => isValidPracticeRange(tid, topicRanges[tid]));
  const canStart = selectedTopics.size > 0 && validPeriodicRange && arithmeticValid && repetitionValid && rangesValid;
  const questionCountDisabled = isQuestionCountSelectionDisabled(repetitionEnabled, timerMode);

  return (
    <div className="quiz-screen quiz-screen--setup pb-24 md:pb-6">
      <div className="app-topbar-page flex items-center justify-between gap-2" data-app-topbar>
        <h1 className="font-display font-bold text-base sm:text-lg text-foreground flex items-center gap-1.5">
          <Zap size={16} className="text-primary" /> Quiz Arena
        </h1>
        <div className="flex items-center gap-1.5">
          <div className="w-[110px] sm:w-[150px]">
            <XPBar />
          </div>
          <ThemeToggle compact />
          <DesktopModeToggle compact />
        </div>
      </div>

      {/* Topic Chips - Multi Select */}
      <div className="quiz-topic-section mb-4">
        <label className="quiz-section-label text-sm text-muted-foreground mb-2 block font-semibold">Select Topics</label>
        <div className="quiz-topic-grid grid grid-cols-2 gap-2 sm:gap-3">
          {TOPICS.map((t) => {
            const isSelected = selectedTopics.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleTopic(t.id)}
                className={`quiz-topic-card flex min-w-0 items-center justify-center gap-2 rounded-2xl px-2 py-2.5 text-xs sm:text-sm font-bold transition-colors relative overflow-hidden ${
                  isSelected
                    ? 'gradient-primary text-primary-foreground shadow-lg shadow-primary/30'
                    : 'bg-card border border-border text-foreground hover:border-primary/50'
                }`}
              >
                <span className="quiz-topic-card__content relative z-10 flex min-w-0 items-center justify-center gap-2">
                  <span className="shrink-0"><TopicIconForTopic topicId={t.id} /></span>
                  <span className="quiz-topic-card__label min-w-0">{t.label}</span>
                </span>
                {isSelected && (
                  <motion.div layoutId="glow" className="absolute inset-0 bg-primary/10 rounded-2xl" initial={false} />
                )}
              </button>
            );
          })}
        </div>
        {selectedTopics.size === 0 && (
          <p className="text-destructive text-xs mt-2">Select at least one topic</p>
        )}
      </div>

      {/* Per-Topic Range Controls */}
      {selectedTopics.size > 0 && (
        <div className="quiz-range-section mb-4 space-y-2">
          <label className="quiz-section-label text-sm text-muted-foreground mb-2 block font-semibold">Range per Topic</label>
          {Array.from(selectedTopics).map((tid) => {
            const topicInfo = TOPICS.find(t => t.id === tid)!;
            const range = topicRanges[tid];
            const selectedPercentagePresets = tid === 'percentage' ? resolvePercentagePresets(range) : [];
            const isExpanded = expandedTopic === tid;

            const isTrig = tid === 'trig';

            return (
              <div key={tid} className="quiz-range-card glass-lite rounded-2xl overflow-hidden">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedTopic(isExpanded ? null : tid)}
                  className="quiz-range-header w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <div className="quiz-range-heading flex min-w-0 items-center gap-2">
                    <span className="shrink-0"><TopicIconForTopic topicId={tid as AppTopicId} /></span>
                    <span className="font-semibold text-sm text-foreground shrink-0">{topicInfo.label}</span>
                    <span className="quiz-range-summary min-w-0 text-[11px] sm:text-xs text-muted-foreground">
                      {isTrig
  ? (range.trigProMode ? '(Pro · 0°–360°)' : '(Standard · 0°–90°)')
  : tid === 'addition-subtraction-digits'
    ? getSelectedDigitCounts(range, 1).map((digits) => digits + 'D').join('/') + ' + ' + getSelectedDigitCounts(range, 2).map((digits) => digits + 'D').join('/') + ' • ' + ((range.arithmeticOperations || ['addition', 'subtraction']).map((operation) => operation === 'addition' ? '+' : '−').join(' / '))
  : tid === 'periodic-table'
    ? `(${range.from} → ${range.to} • ${(range.periodicQuestionTypes || []).length}/4 types${range.periodicQuestionTypes?.includes('mass') ? ` • ${range.periodicMassMode === 'exact' ? 'Exact' : range.periodicMassMode === 'round' ? 'Round' : 'Mass mode?'}` : ''})`
  : tid === 'tables'
    ? `(${range.from}–${range.to} · ${tablesProMode ? 'Pro ×1–×20' : 'Standard ×1–×10'})`
  : tid === 'percentage'
    ? (range.pctRangeMode === 'custom' ? '(Custom range)' : `(${selectedPercentagePresets.length} preset range${selectedPercentagePresets.length === 1 ? '' : 's'} selected)`)
    : `(${range.from}–${range.to})`}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="quiz-range-accordion border-t border-border"
                    >
                      <div className="quiz-range-body p-3 sm:p-4 space-y-3">
                        {isTrig ? (
                          <div className="space-y-4">
                            <div>
                              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Trigonometry Quiz – Angle Range</p>
                              <div role="group" aria-label="Trigonometry quiz angle range" className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  aria-pressed={!range.trigProMode}
                                  onClick={() => updateRange(tid, 'trigProMode', false)}
                                  className={
                                    'min-h-11 rounded-xl border px-3 py-2 text-left text-xs font-bold transition-colors sm:text-sm ' +
                                    (!range.trigProMode
                                      ? 'gradient-primary border-primary text-primary-foreground'
                                      : 'bg-secondary border-border text-secondary-foreground hover:border-primary/50')
                                  }
                                >
                                  <span className="block">Standard Mode</span>
                                  <span className="mt-0.5 block text-[11px] font-medium opacity-85">0°–90°</span>
                                </button>
                                <button
                                  type="button"
                                  aria-pressed={!!range.trigProMode}
                                  onClick={() => updateRange(tid, 'trigProMode', true)}
                                  className={
                                    'min-h-11 rounded-xl border px-3 py-2 text-left text-xs font-bold transition-colors sm:text-sm ' +
                                    (range.trigProMode
                                      ? 'gradient-primary border-primary text-primary-foreground'
                                      : 'bg-secondary border-border text-secondary-foreground hover:border-primary/50')
                                  }
                                >
                                  <span className="block">Pro Mode</span>
                                  <span className="mt-0.5 block text-[11px] font-medium opacity-85">0°–360°</span>
                                </button>
                              </div>
                              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground" aria-live="polite">
                                {range.trigProMode
                                  ? 'Quiz includes all 17 supported angles through 360°.'
                                  : 'Quiz includes only supported angles through 90°.'}
                              </p>
                            </div>
                            <div>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Select Trigonometric Functions</p>
                              <button
                                type="button"
                                onClick={() => updateRange(tid, 'trigFunctions', [...TRIG_FUNCTIONS])}
                                className="rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/15"
                              >
                                Select All
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {TRIG_FUNCTIONS.map((fn) => {
                                const functions = range.trigFunctions ?? TRIG_FUNCTIONS;
                                const selected = functions.includes(fn);
                                return (
                                  <button
                                    key={fn}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => updateRange(
                                      tid,
                                      'trigFunctions',
                                      selected ? functions.filter((item) => item !== fn) : [...functions, fn],
                                    )}
                                    className={
                                      'min-h-10 rounded-xl border px-3 py-2 text-left text-xs font-bold transition-colors ' +
                                      (selected
                                        ? 'gradient-primary border-primary text-primary-foreground'
                                        : 'bg-secondary border-border text-secondary-foreground hover:border-primary/50')
                                    }
                                  >
                                    <span className="mr-2" aria-hidden="true">{selected ? '✓' : '○'}</span>
                                    {fn} θ
                                  </button>
                                );
                              })}
                            </div>
                            {!(range.trigFunctions ?? TRIG_FUNCTIONS).length && (
                              <p className="mt-2 text-[11px] font-semibold text-destructive">Select at least one trigonometric function.</p>
                            )}
                            <p className="mt-2 text-[11px] text-muted-foreground">Each selected function uses the active angle range, including Not Defined answers where applicable.</p>
                            </div>
                          </div>
                        ) : tid === 'tables' ? (
                          <div className="space-y-3">
                            <div className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${tablesProMode ? 'border-primary/50 bg-primary/5' : 'border-border bg-secondary/50'}`}>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground">Pro Mode</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground" aria-live="polite">
                                  {tablesProMode ? '×1 – ×20 per table' : '×1 – ×10 per table'}
                                </p>
                              </div>
                              <Switch
                                checked={tablesProMode}
                                aria-label="Tables Pro Mode"
                                onCheckedChange={handleTablesProModeChange}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">From</label>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={range.from}
                                  onChange={(e) => updateRange(tid, 'from', Number(e.target.value))}
                                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-center text-sm font-bold text-foreground focus:border-primary outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">To</label>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={range.to}
                                  onChange={(e) => updateRange(tid, 'to', Number(e.target.value))}
                                  className={`w-full bg-secondary border rounded-xl px-3 py-2 text-center text-sm font-bold text-foreground focus:border-primary outline-none ${range.to < range.from ? 'border-destructive' : 'border-border'}`}
                                />
                              </div>
                            </div>
                          </div>
                        ) : tid === 'periodic-table' ? (
                          <>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Choose Topics</p>
                              <div className="grid grid-cols-2 gap-2">
                                {([
                                  ['atomic-number', 'Atomic Number'],
                                  ['symbol', 'Symbol'],
                                  ['name', 'Element Name'],
                                  ['mass', 'Atomic Mass'],
                                ] as [PeriodicQuestionType, string][]).map(([type, title]) => {
                                  const checked = periodicTypes.includes(type);
                                  return (
                                    <button key={type} type="button" onClick={() => togglePeriodicQuestionType(type)} className={`rounded-xl border px-3 py-3 text-left text-xs font-bold transition-all ${checked ? 'gradient-primary border-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-secondary border-border text-foreground'}`}>
                                      <span className="mr-2">{checked ? '✓' : '○'}</span>{title}
                                    </button>
                                  );
                                })}
                              </div>
                              {periodicTypes.length === 0 && <p className="mt-2 text-[11px] font-semibold text-destructive">Select at least one Periodic Table question topic.</p>}
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Element Range (1–118)</p>
                              <div className="grid grid-cols-2 gap-3">
                                {[['Start Element', 'from'], ['End Element', 'to']].map(([title, field]) => (
                                  <div key={field}>
                                    <label className="text-[11px] text-muted-foreground mb-1 block">{title}</label>
                                    <input type="number" min={1} max={118} step={1} inputMode="numeric" value={range[field as 'from'|'to']} onChange={(e) => updateRange(tid, field, Number(e.target.value))} className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-center text-sm font-bold text-foreground focus:border-primary outline-none" />
                                    <select value={range[field as 'from'|'to']} onChange={(e) => updateRange(tid, field, Number(e.target.value))} className="mt-1 w-full bg-secondary border border-border rounded-xl px-2 py-2 text-xs font-semibold text-foreground outline-none">
                                      {ELEMENTS.map((el) => <option key={el.number} value={el.number}>{el.number} · {el.symbol} · {el.name}</option>)}
                                    </select>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {[[1,10],[1,30],[11,20],[21,30]].map(([f,t]) => (
                                  <button key={`${f}-${t}`} type="button" onClick={() => { updateRange(tid,'from',f); updateRange(tid,'to',t); }} className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${range.from === f && range.to === t ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>{f} → {t}</button>
                                ))}
                              </div>
                            </div>
                            {periodicTypes.includes('mass') && (
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Atomic Mass</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {(['round','exact'] as PeriodicMassMode[]).map((massMode) => (
                                    <button key={massMode} type="button" onClick={() => updateRange(tid, 'periodicMassMode', massMode)} className={`rounded-xl border py-3 text-sm font-bold transition-colors ${range.periodicMassMode === massMode ? 'gradient-primary border-primary text-primary-foreground' : 'bg-secondary border-border text-secondary-foreground'}`}>
                                      {massMode === 'round' ? 'Round Figure' : 'Exact Figure'}
                                    </button>
                                  ))}
                                </div>
                                {!range.periodicMassMode && <p className="mt-2 text-[11px] font-semibold text-destructive">Choose Round Figure or Exact Figure before starting.</p>}
                              </div>
                            )}
                          </>
                        ) : tid === 'addition-subtraction-digits' ? (
                          <div className="space-y-2.5">
                            <div>
                              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Operation</p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {([
                                  ['addition', 'Addition'],
                                  ['subtraction', 'Subtraction'],
                                ] as const).map(([operation, title]) => {
                                  const selected = (range.arithmeticOperations || ['addition', 'subtraction']).includes(operation);
                                  return (
                                    <button
                                      key={operation}
                                      type="button"
                                      aria-pressed={selected}
                                      onClick={() => {
                                        const current = range.arithmeticOperations || ['addition', 'subtraction'];
                                        const next = current.includes(operation)
                                          ? current.filter((item) => item !== operation)
                                          : [...current, operation];
                                        updateRange(tid, 'arithmeticOperations', next);
                                      }}
                                      className={
                                        'min-h-9 rounded-lg border px-2 py-1.5 text-[11px] sm:text-xs font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ' +
                                        (selected
                                          ? 'bg-primary border-primary text-primary-foreground'
                                          : 'bg-secondary/70 border-border text-secondary-foreground hover:bg-secondary hover:border-primary/50')
                                      }
                                    >
                                      <span className="inline-flex items-center justify-center gap-1.5">
                                        {operation === 'addition' ? <Plus size={13} strokeWidth={2.6} /> : <Minus size={13} strokeWidth={2.6} />}
                                        {title}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                              {!(range.arithmeticOperations || ['addition', 'subtraction']).length && (
                                <p className="mt-1 text-[11px] font-semibold text-destructive">Select Addition, Subtraction, or both.</p>
                              )}
                            </div>
                            {([
                              ['Number 1', 'operand1DigitCounts', 1, 'operand1DigitCount'],
                              ['Number 2', 'operand2DigitCounts', 2, 'operand2DigitCount'],
                            ] as const).map(([labelText, field, operand, legacyField]) => {
                              const selectedDigits = getSelectedDigitCounts(range, operand);
                              return (
                                <div key={field} className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{labelText} · Digit Count</p>
                                    <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">{selectedDigits.length} selected</span>
                                  </div>
                                  <div role="group" aria-label={labelText + ' digit counts'} className="grid grid-cols-5 gap-1 sm:gap-1.5">
                                    {DIGIT_COUNT_OPTIONS.map((digits) => {
                                      const selected = selectedDigits.includes(digits);
                                      return (
                                        <button
                                          key={digits}
                                          type="button"
                                          aria-pressed={selected}
                                          onClick={() => {
                                            const next = selected
                                              ? selectedDigits.filter((value) => value !== digits)
                                              : [...selectedDigits, digits].sort((a, b) => a - b);
                                            updateRange(tid, field, next);
                                            updateRange(tid, legacyField, next[0]);
                                          }}
                                          className={
                                            'min-h-9 min-w-0 rounded-md sm:rounded-lg border px-1 py-1.5 text-[11px] sm:text-xs font-bold leading-none tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ' +
                                            (selected
                                              ? 'bg-primary border-primary text-primary-foreground'
                                              : 'bg-secondary/70 border-border text-secondary-foreground hover:bg-secondary hover:border-primary/50')
                                          }
                                        >
                                          {digits}D
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {selectedDigits.length === 0 && (
                                    <p role="alert" className="text-[11px] font-semibold text-destructive">Select at least one digit count.</p>
                                  )}
                                </div>
                              );
                            })}
                            <p className="text-[11px] leading-snug font-medium text-muted-foreground">
                              Number 1 and Number 2 are independent. Subtraction keeps the displayed result non-negative.
                            </p>
                          </div>
                        ) : tid === 'percentage' ? (
                          <>
                            <div className="flex gap-2 mb-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!Array.isArray(range.pctPresetIds)) {
                                    const legacyPreset = PERCENTAGE_PRESETS.find((preset) => preset.from === range.from && preset.to === range.to);
                                    updateRange(tid, 'pctPresetIds', legacyPreset ? [legacyPreset.id] : []);
                                  }
                                  updateRange(tid, 'pctRangeMode', 'preset');
                                }}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${(range.pctRangeMode || 'preset') === 'preset' ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                              >Preset</button>
                              <button
                                type="button"
                                onClick={() => setPercentageRangeMode(tid, 'custom')}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${range.pctRangeMode === 'custom' ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                              >Custom</button>
                            </div>
                            {(range.pctRangeMode || 'preset') === 'preset' ? (
                              <>
                              <div role="group" aria-label="Percentage preset ranges" className="quiz-percentage-preset-grid grid grid-cols-1 gap-1.5">
                                {PERCENTAGE_PRESETS.map((preset) => {
                                  const isSelected = selectedPercentagePresets.some((selected) => selected.id === preset.id);
                                  return (
                                    <button
                                      key={preset.id}
                                      type="button"
                                      aria-pressed={isSelected}
                                      onClick={() => togglePercentagePresetRange(tid, preset.id)}
                                      className={`flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-colors text-left ${isSelected ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:border hover:border-primary/40'}`}
                                    >
                                      <span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-current text-[10px] leading-none">
                                        {isSelected ? '✓' : ''}
                                      </span>
                                      <span>{preset.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              {selectedPercentagePresets.length === 0 && (
                                <p className="mt-1.5 text-[11px] font-semibold text-destructive" role="status">
                                  Select at least one preset range to start.
                                </p>
                              )}
                              </>
                            ) : (
                              <>
                              <div className="flex items-center gap-3 justify-center">
                                <div className="flex flex-col items-center">
                                  <input type="number" min={0} max={MAX_QUIZ_RANGE_VALUE} step={1} inputMode="numeric"
                                    aria-label="Percentage custom start numerator" value={range.pctNumFrom ?? ''}
                                    onChange={(e) => updateRange(tid, 'pctNumFrom', e.target.value === '' ? undefined : Number(e.target.value))}
                                    className="w-14 bg-secondary border border-border rounded-xl px-2 py-1.5 text-center text-sm font-bold text-foreground focus:border-primary outline-none" />
                                  <div className="w-14 h-px bg-foreground/40 my-0.5" />
                                  <input type="number" min={1} max={MAX_QUIZ_RANGE_VALUE} step={1} inputMode="numeric"
                                    aria-label="Percentage custom start denominator" value={range.pctDenFrom ?? ''}
                                    onChange={(e) => updateRange(tid, 'pctDenFrom', e.target.value === '' ? undefined : Number(e.target.value))}
                                    className="w-14 bg-secondary border border-border rounded-xl px-2 py-1.5 text-center text-sm font-bold text-foreground focus:border-primary outline-none" />
                                </div>
                                <span className="text-muted-foreground text-xs font-semibold">to</span>
                                <div className="flex flex-col items-center">
                                  <input type="number" min={0} max={MAX_QUIZ_RANGE_VALUE} step={1} inputMode="numeric"
                                    aria-label="Percentage custom end numerator" value={range.pctNumTo ?? ''}
                                    onChange={(e) => updateRange(tid, 'pctNumTo', e.target.value === '' ? undefined : Number(e.target.value))}
                                    className="w-14 bg-secondary border border-border rounded-xl px-2 py-1.5 text-center text-sm font-bold text-foreground focus:border-primary outline-none" />
                                  <div className="w-14 h-px bg-foreground/40 my-0.5" />
                                  <input type="number" min={1} max={MAX_QUIZ_RANGE_VALUE} step={1} inputMode="numeric"
                                    aria-label="Percentage custom end denominator" value={range.pctDenTo ?? ''}
                                    onChange={(e) => updateRange(tid, 'pctDenTo', e.target.value === '' ? undefined : Number(e.target.value))}
                                    className="w-14 bg-secondary border border-border rounded-xl px-2 py-1.5 text-center text-sm font-bold text-foreground focus:border-primary outline-none" />
                                </div>
                              </div>
                              {!isValidPracticeRange('percentage', range) && (
                                <p role="alert" className="mt-2 text-center text-[11px] font-semibold text-destructive">
                                  Use whole-number fractions (numerator 0–{MAX_QUIZ_RANGE_VALUE}, denominator 1–{MAX_QUIZ_RANGE_VALUE}).
                                  Keep the range ascending; when denominators differ, use 1 as both numerators.
                                </p>
                              )}
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <label className="text-xs text-muted-foreground mb-1 block">From</label>
                                <input type="number" inputMode="numeric" value={range.from}
                                  onChange={(e) => updateRange(tid, 'from', Number(e.target.value))}
                                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-center text-sm font-bold text-foreground focus:border-primary outline-none" />
                              </div>
                              <div className="flex-1">
                                <label className="text-xs text-muted-foreground mb-1 block">To</label>
                                <input type="number" inputMode="numeric" value={range.to}
                                  onChange={(e) => updateRange(tid, 'to', Number(e.target.value))}
                                  className={`w-full bg-secondary border rounded-xl px-3 py-2 text-center text-sm font-bold text-foreground focus:border-primary outline-none ${range.to < range.from ? 'border-destructive' : 'border-border'}`} />
                              </div>
                            </div>
                            {tid === 'powers' && (
                              <div className="flex gap-3 mt-2">
                                <div className="flex-1">
                                  <label className="text-xs text-muted-foreground mb-1 block">Exp From</label>
                                  <input type="number" inputMode="numeric" value={range.exponentFrom || 1}
                                    onChange={(e) => updateRange(tid, 'exponentFrom', Number(e.target.value))}
                                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-center text-sm font-bold text-foreground focus:border-primary outline-none" />
                                </div>
                                <div className="flex-1">
                                  <label className="text-xs text-muted-foreground mb-1 block">Exp To</label>
                                  <input type="number" inputMode="numeric" value={range.exponentTo || 5}
                                    onChange={(e) => updateRange(tid, 'exponentTo', Number(e.target.value))}
                                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-center text-sm font-bold text-foreground focus:border-primary outline-none" />
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Questions Count */}
      <div className={`quiz-setting-block mb-4 rounded-2xl border p-3 sm:p-4 ${questionCountDisabled ? 'border-border bg-muted/30' : 'border-transparent bg-transparent p-0'}`}>
        <div className="flex items-center justify-between gap-2">
          <label className={`text-sm font-semibold ${questionCountDisabled ? 'text-muted-foreground' : 'text-foreground'}`}>
            Questions
          </label>
          {questionCountDisabled && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {timerMode === 'challenge' ? 'Time-based Challenge' : 'Disabled while Repetition is ON'}
            </span>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          {COUNTS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={questionCountDisabled}
              onClick={() => {
                if (questionCountDisabled) return;
                setCount(c);
                setInfinite(false);
              }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                questionCountDisabled
                  ? 'cursor-not-allowed bg-muted/60 text-muted-foreground opacity-60'
                  : !infinite && count === c
                    ? 'gradient-primary text-primary-foreground'
                    : 'bg-card border border-border text-foreground'
              }`}
            >
              {c}
            </button>
          ))}
          <button
            type="button"
            disabled={questionCountDisabled}
            onClick={() => {
              if (questionCountDisabled) return;
              setInfinite(true);
            }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              questionCountDisabled
                ? 'cursor-not-allowed bg-muted/60 text-muted-foreground opacity-60'
                : infinite
                  ? 'gradient-primary text-primary-foreground'
                  : 'bg-card border border-border text-foreground'
            }`}
          >
            ∞
          </button>
        </div>
      </div>

      {/* Repetition */}
      <div className="quiz-setting-block mb-4 glass rounded-2xl p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="font-semibold text-sm text-foreground">Repetition</span>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Repeat each generated item independently for every selected topic.
            </p>
          </div>
          <Switch
            checked={repetitionEnabled}
            onCheckedChange={(enabled) => {
              setRepetitionEnabled(enabled);
              if (enabled) {
                // Keep the user's previous Questions selection for restoration,
                // but it has no effect while Repetition Mode is enabled.
                setInfinite(false);
              }
            }}
          />
        </div>

        {repetitionEnabled && (
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            {Array.from(selectedTopics).map((tid) => {
              const topicInfo = TOPICS.find((t) => t.id === tid);
              const value = sanitizeRepetition(topicRepetitions[tid]);
              return (
                <div key={tid} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <span className="min-w-0 truncate text-xs font-bold text-foreground">
                    {topicInfo?.label || tid}
                  </span>
                  <div className="grid grid-cols-5 gap-1">
                    {REPETITION_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={value === option}
                        onClick={() => setTopicRepetitions((prev) => ({
                          ...prev,
                          [tid]: option,
                        }))}
                        className={
                          'min-h-9 min-w-10 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors ' +
                          (value === option
                            ? 'gradient-primary border-primary text-primary-foreground'
                            : 'bg-secondary border-border text-secondary-foreground hover:border-primary/50')
                        }
                      >
                        {option}×
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Answer Mode */}
      <div className="quiz-setting-block mb-4">
        <label className="quiz-section-label text-sm text-muted-foreground mb-2 block font-semibold">Answer Mode</label>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" aria-pressed={mode === 'mcq'} onClick={() => setMode('mcq')}
            className={`flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-bold leading-tight transition-colors ${mode === 'mcq' ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>
            <ListChecks size={17} />
            <span>MCQ</span>
          </button>
          <button type="button" aria-pressed={mode === 'input'} onClick={() => setMode('input')}
            className={`flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-bold leading-tight transition-colors ${mode === 'input' ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>
            <Keyboard size={17} />
            <span>Type Answer</span>
          </button>
          <button type="button" aria-pressed={mode === 'game'} onClick={() => {
              modeBeforeGameSelectionRef.current = mode;
              setMode('game');
              setGameSelectionOpen(true);
            }}
            className={`flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-bold leading-tight transition-colors ${mode === 'game' ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>
            <CarFront size={17} />
            <span>MCQ with Game</span>
          </button>
        </div>
        {mode === 'game' && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="min-w-0 text-xs font-bold text-foreground">
              Selected: {selectedGameVariant === 'car' ? '3D Math Car Racing' : '2D Math Jump Adventure'}
            </span>
            <button
              type="button"
              className="min-h-9 shrink-0 rounded-lg border border-border bg-card px-3 text-xs font-bold text-primary"
              onClick={() => {
                modeBeforeGameSelectionRef.current = mode;
                setGameSelectionOpen(true);
              }}
            >
              Change Game
            </button>
          </div>
        )}
      </div>

      {/* Mutually exclusive per-question Timer / full-session Challenge */}
      <div className="quiz-setting-block mb-4 bg-card border border-border rounded-2xl p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Timer size={18} className="text-primary" />
            <span className="font-semibold text-sm text-foreground">Timer</span>
          </div>
          <Switch
            checked={timerMode === 'perQuestion'}
            aria-label="Per-question timer"
            onCheckedChange={(enabled) => setTimerMode(getTimerModeFromToggle('perQuestion', enabled))}
          />
        </div>
        <AnimatePresence>
          {timerMode === 'perQuestion' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="flex gap-2 mt-2">
                {[5, 10, 15, 30].map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={timerSeconds === s}
                    onClick={() => setTimerSeconds(s)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${timerSeconds === s ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'}`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-sm text-foreground">Challenge</span>
            <Switch
              checked={timerMode === 'challenge'}
              aria-label="Challenge timer"
              onCheckedChange={(enabled) => setTimerMode(getTimerModeFromToggle('challenge', enabled))}
            />
          </div>
          <AnimatePresence>
            {timerMode === 'challenge' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <div className="mt-2 grid grid-cols-6 gap-1.5">
                  {CHALLENGE_MINUTES.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      disabled={timerMode !== 'challenge'}
                      aria-pressed={challengeMinutes === minutes}
                      onClick={() => setChallengeMinutes(minutes)}
                      className={`min-w-0 rounded-lg px-1 py-2 text-xs font-bold transition-colors ${challengeMinutes === minutes ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                    >
                      {minutes}m
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Order */}
      <div className="quiz-setting-block mb-4">
        <label className="quiz-section-label text-sm text-muted-foreground mb-2 block font-semibold">Order</label>
        <div className="flex gap-2">
          <button onClick={() => setSequential(false)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${!sequential ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>
            <Shuffle size={14} /> Random
          </button>
          <button onClick={() => setSequential(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${sequential ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>
            <ListOrdered size={14} /> Sequential
          </button>
        </div>
      </div>

      {/* Start Button */}
      <motion.button
        whileTap={{ scale: MOTION.scale.press }}
        disabled={!canStart}
        onClick={() => {
          const topics = Array.from(selectedTopics).map(tid => {
            const info = TOPICS.find(t => t.id === tid)!;
            return { id: tid, label: info.label, range: topicRanges[tid] };
          });
          const cfg: PracticeConfig = {
            topics, count, infinite, mode,
            timerMode,
            timerSeconds,
            challengeDurationSeconds: timerMode === 'challenge'
              ? getChallengeDurationSeconds(challengeMinutes)
              : undefined,
            sequential,
             repetitionEnabled,
             repetitionByTopic: repetitionEnabled
               ? Object.fromEntries(Array.from(selectedTopics).map((tid) => [tid, sanitizeRepetition(topicRepetitions[tid])]))
               : {},
           };
          startPractice(cfg);
        }}
        className={`quiz-start-cta w-full min-h-12 py-3 rounded-xl font-display font-bold text-base shadow-sm mt-2 transition-colors flex items-center justify-center gap-2 ${
          canStart
            ? 'gradient-primary text-primary-foreground shadow-primary/30'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        }`}
      >
        <Play size={18} fill="currentColor" /> Start Quiz
      </motion.button>

      {startError && (
        <p role="alert" className="quiz-start-error mt-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-center text-xs font-semibold text-destructive">
          {startError}
        </p>
      )}

      {selectedTopics.size > 1 && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          Mixed mode: {selectedTopics.size} topics selected
        </p>
      )}
    </div>
  );
};

export default PracticePage;