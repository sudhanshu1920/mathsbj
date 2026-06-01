import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Timer, CheckCircle2, XCircle, ChevronDown, ChevronUp, Zap, Trophy, ThumbsUp, Dumbbell, Sparkles, Shuffle, ListOrdered, Play, Flame } from 'lucide-react';
import SwipeBack from '@/components/SwipeBack';
import { Switch } from '@/components/ui/switch';
import Particles from '@/components/Particles';
import { saveResult } from '@/lib/progress';
import { addSeconds as addStreakSeconds } from '@/lib/streak';
import { recordAnswer } from '@/lib/analytics';
import { getSettings, isActive, markInteraction } from '@/lib/settings';
import { awardCorrectXP, acknowledgeLevel } from '@/lib/xp';
import { playClick, playSuccess, playWrong, playLevelUp, playStreak } from '@/lib/sound';
import XPBar from '@/components/XPBar';
import MathKeypad from '@/components/MathKeypad';
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

import { getAllTrigQuestions, buildTrigOptions, isTrigAnswerCorrect } from '@/lib/trigData';

type PracticeMode = 'mcq' | 'input';

interface TopicRange {
  from: number;
  to: number;
  exponentFrom?: number;
  exponentTo?: number;
  pctRangeMode?: 'preset' | 'custom';
  pctNumFrom?: number;
  pctDenFrom?: number;
  pctNumTo?: number;
  pctDenTo?: number;
}

interface PracticeConfig {
  topics: { id: string; label: string; range: TopicRange }[];
  count: number;
  infinite: boolean;
  mode: PracticeMode;
  timerEnabled: boolean;
  timerSeconds: number;
  sequential: boolean;
}

type AnswerType = 'decimal-pct' | 'mixed-pct' | 'fraction' | 'trig';

interface MixedPct {
  whole: number;
  numerator: number;
  denominator: number;
}

interface Question {
  text: string;
  superscript?: string;
  answer: number | string;
  answerType?: AnswerType;
  mixedPctAnswer?: MixedPct;
  options?: (number | string)[];
  optionsMixed?: (MixedPct | null)[];
  questionMixed?: MixedPct;
  questionFraction?: { n: number; d: number };
  topicLabel?: string;
}

const TOPICS = [
  { id: 'tables', label: 'Tables', icon: '×', defaultRange: { from: 1, to: 20 } },
  { id: 'squares', label: 'Squares', icon: '²', defaultRange: { from: 1, to: 50 } },
  { id: 'roots', label: 'Square Roots', icon: '√', defaultRange: { from: 1, to: 30 } },
  { id: 'cubes', label: 'Cubes', icon: '³', defaultRange: { from: 1, to: 30 } },
  { id: 'cube-roots', label: 'Cube Roots', icon: '∛', defaultRange: { from: 1, to: 20 } },
  { id: 'powers', label: 'Powers', icon: 'xⁿ', defaultRange: { from: 2, to: 10, exponentFrom: 1, exponentTo: 5 } },
  { id: 'percentage', label: 'Percentage', icon: '%', defaultRange: { from: 2, to: 10, pctRangeMode: 'preset' as const } },
  { id: 'trig', label: 'Trigonometry', icon: '△', defaultRange: { from: 0, to: 90 } },
];

const COUNTS = [10, 20, 25, 50];

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
function rangeArray(from: number, to: number): number[] {
  const step = from <= to ? 1 : -1;
  const length = Math.abs(to - from) + 1;
  return Array.from({ length }, (_, i) => from + i * step);
}

function generateQuestionsForTopic(topicId: string, range: TopicRange, label: string): Question[] {
  const questions: Question[] = [];
  const { from, to } = range;
  const nums = rangeArray(from, to);

  if (topicId === 'tables') {
    const multipliers = from <= to ? rangeArray(1, 10) : rangeArray(10, 1);
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
      questions.push({ text: `√${n * n} = ?`, answer: n, topicLabel: label });
    }
  } else if (topicId === 'cubes') {
    for (const n of nums) {
      questions.push({ text: `${n}³ = ?`, answer: n * n * n, topicLabel: label });
    }
  } else if (topicId === 'cube-roots') {
    for (const n of nums) {
      questions.push({ text: `∛${n * n * n} = ?`, answer: n, topicLabel: label });
    }
  } else if (topicId === 'powers') {
    const expFrom = range.exponentFrom || 1;
    const expTo = range.exponentTo || 10;
    const exps = rangeArray(expFrom, expTo);
    for (const n of nums) {
      for (const e of exps) {
        questions.push({ text: `${n}`, superscript: `${e}`, answer: Math.pow(n, e), topicLabel: label });
      }
    }
  } else if (topicId === 'trig') {
    for (const tq of getAllTrigQuestions()) {
      questions.push({
        text: tq.text,
        answer: tq.answer,
        answerType: 'trig',
        topicLabel: label,
      });
    }
  } else if (topicId === 'percentage') {
    const pairs: { n: number; d: number }[] = [];
    if (range.pctRangeMode === 'custom' && range.pctNumFrom !== undefined && range.pctDenFrom !== undefined && range.pctNumTo !== undefined && range.pctDenTo !== undefined) {
      if (range.pctDenFrom === range.pctDenTo) {
        const d = range.pctDenFrom;
        const pctNums = rangeArray(range.pctNumFrom, range.pctNumTo);
        for (const n of pctNums) {
          pairs.push({ n, d });
        }
      } else {
        const dens = rangeArray(range.pctDenFrom, range.pctDenTo);
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

    for (const { n, d } of pairs) {
      const decPct = toDecimalPct(n, d);
      const mixed = toMixed(n, d);
      questions.push({ text: `fraction-to-decimal`, questionFraction: { n, d }, answer: decPct, answerType: 'decimal-pct', topicLabel: label });
      if (mixed) {
        questions.push({ text: `fraction-to-mixed`, questionFraction: { n, d }, answer: mixedToString(mixed), answerType: 'mixed-pct', mixedPctAnswer: mixed, topicLabel: label });
      }
      questions.push({ text: `${decPct} = ? (fraction)`, answer: `${n}/${d}`, answerType: 'fraction', topicLabel: label });
      if (mixed) {
        questions.push({ text: `mixed-to-fraction`, questionMixed: mixed, answer: `${n}/${d}`, answerType: 'fraction', topicLabel: label });
      }
    }
  }

  return questions;
}

function generateQuestions(config: PracticeConfig): Question[] {
  let allQuestions: Question[] = [];

  for (const topic of config.topics) {
    const qs = generateQuestionsForTopic(topic.id, topic.range, topic.label);
    allQuestions.push(...qs);
  }

  if (!config.sequential) {
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }
  }

  if (config.mode === 'mcq') {
    const sliced = config.infinite ? allQuestions : allQuestions.slice(0, config.count);
    return sliced.map((q) => {
      // Trig: build options from the standard trig value pool
      if (q.answerType === 'trig') {
        const opts = buildTrigOptions({
          fn: 'sin',
          angle: 0,
          text: q.text,
          answer: String(q.answer),
        });
        return { ...q, options: opts, optionsMixed: opts.map(() => null) };
      }

      const correct = q.answer;
      const opts = new Set<string>();
      opts.add(String(correct));

      while (opts.size < 4) {
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

      const shuffled = Array.from(opts).sort(() => Math.random() - 0.5);
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

  return config.infinite ? allQuestions : allQuestions.slice(0, config.count);
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
  if (/[\/.\s+]$/.test(s)) return false;
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
  initialMode?: 'mcq' | 'input';
  initialExtras?: { timerEnabled?: boolean; timerSeconds?: number; infinite?: boolean };
  onExit?: () => void;
  fromLearning?: boolean;
}

const PracticePage = ({ initialTopic, initialContext, initialMode, initialExtras, onExit, fromLearning }: PracticePageProps) => {
  const [config, setConfig] = useState<PracticeConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [finished, setFinished] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [xpPop, setXpPop] = useState<{ id: number; amount: number; bonus: number } | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [sessionXP, setSessionXP] = useState(0);
  const xpPopId = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const elapsedRef = useRef<ReturnType<typeof setInterval>>();
  const inputRef = useRef<HTMLInputElement>(null);

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
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [count, setCount] = useState(10);
  const [infinite, setInfinite] = useState(false);
  const [mode, setMode] = useState<PracticeMode>(initialMode || 'mcq');
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(10);
  const [sequential, setSequential] = useState(false);

  useEffect(() => {
    if (initialTopic && initialMode) {
      const mappedTopic = initialTopic === 'square-roots' ? 'roots' : initialTopic;
      const topicInfo = TOPICS.find(t => t.id === mappedTopic);
      const timerOn = initialExtras?.timerEnabled ?? false;
      const range: TopicRange = {
        from: initialContext?.from || initialContext?.number || 1,
        to: initialContext?.to || initialContext?.number || (initialTopic === 'percentage' ? 50 : 10),
      };
      const cfg: PracticeConfig = {
        topics: [{ id: mappedTopic, label: topicInfo?.label || mappedTopic, range }],
        count: 10,
        infinite: initialExtras?.infinite ?? false,
        mode: initialMode,
        timerEnabled: timerOn,
        timerSeconds: timerOn ? (initialExtras?.timerSeconds ?? 10) : 9999,
        sequential: false,
      };
      startPractice(cfg);
    }
  }, [initialTopic, initialMode]);

  const toggleTopic = (id: string) => {
    setSelectedTopics(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateRange = (topicId: string, field: string, value: number | string) => {
    setTopicRanges(prev => ({
      ...prev,
      [topicId]: { ...prev[topicId], [field]: value },
    }));
  };

  const startPractice = (cfg: PracticeConfig) => {
    const qs = generateQuestions(cfg);
    if (qs.length === 0) return;
    setConfig(cfg);
    setQuestions(qs);
    setCurrentQ(0);
    setScore({ correct: 0, wrong: 0 });
    setFinished(false);
    setFeedback(null);
    setInputValue('');
    setSelectedOption(null);
    setElapsedTime(0);
    setSessionXP(0);
    setTimeLeft(cfg.timerEnabled ? cfg.timerSeconds : 9999);
  };

  useEffect(() => {
    if (!config || finished || !config.infinite) {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      return;
    }
    elapsedRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [config, finished]);

  // Daily streak time tracking — ticks every second while a session is active
  useEffect(() => {
    if (!config || finished) return;
    const id = setInterval(() => {
      if (isActive()) {
        addStreakSeconds(1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [config, finished]);

  useEffect(() => {
    if (!config || finished) return;
    if (!config.timerEnabled || config.timerSeconds >= 9999) return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAnswer(null);
          return config.timerSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [config, currentQ, finished]);

  const handleAnswer = useCallback(
    (answer: number | string | null) => {
      if (!config || finished || feedback) return;
      const q = questions[currentQ];
      if (!q) return;

      let isCorrect = false;
      if (answer !== null) {
        if (q.answerType === 'trig') {
          isCorrect = isTrigAnswerCorrect(String(answer), String(q.answer));
        } else if (typeof q.answer === 'number') {
          isCorrect = Number(answer) === q.answer;
        } else {
          isCorrect = normalizeAnswer(String(answer), String(q.answer));
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
          const willMilestone = (score.correct + 1) % 5 === 0;
          if (willMilestone) playStreak(); else playSuccess();
        } else {
          playWrong();
        }
      } catch {}
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
          } catch {}
          setTimeout(() => { setLevelUp(null); acknowledgeLevel(); }, 1400);
        }
        setTimeout(() => setXpPop((p) => (p && p.id === xpPopId.current ? null : p)), 700);
      }

      const newScore = {
        correct: score.correct + (isCorrect ? 1 : 0),
        wrong: score.wrong + (isCorrect ? 0 : 1),
      };
      setScore(newScore);

      setTimeout(() => {
        setFeedback(null);
        setInputValue('');
        setSelectedOption(null);
        if (!config.infinite && currentQ + 1 >= questions.length) {
          setFinished(true);
          if (timerRef.current) clearInterval(timerRef.current);
        } else {
          if (config.infinite && currentQ + 1 >= questions.length) {
            const moreQs = generateQuestions(config);
            setQuestions(prev => [...prev, ...moreQs]);
          }
          setCurrentQ(currentQ + 1);
          if (config.timerEnabled) setTimeLeft(config.timerSeconds);
        }
      }, isCorrect ? 350 : 700);
    },
    [config, currentQ, questions, score, finished, feedback]
  );

  const handleSubmitInfinite = useCallback(() => {
    if (!config?.infinite) return;
    const totalAttempts = score.correct + score.wrong;
    if (totalAttempts === 0) return;
    setFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
  }, [config, score]);

  useEffect(() => {
    if (!config || config.mode !== 'input' || !inputValue.trim() || feedback) return;
    const q = questions[currentQ];
    if (!q) return;
    // Avoid premature checking while user is still typing (e.g. "33", "1/").
    if (!isLikelyComplete(inputValue)) return;
    if (q.answerType === 'trig') {
      if (isTrigAnswerCorrect(inputValue.trim(), String(q.answer))) handleAnswer(inputValue.trim());
    } else if (typeof q.answer === 'number') {
      const numVal = parseMathValue(inputValue);
      if (numVal !== null && Math.abs(numVal - q.answer) < 1e-9) handleAnswer(numVal);
    } else {
      if (normalizeAnswer(inputValue.trim(), String(q.answer))) handleAnswer(inputValue.trim());
    }
  }, [inputValue, config, currentQ, questions, feedback, handleAnswer]);

  useEffect(() => {
    if (config?.mode === 'input' && inputRef.current) inputRef.current.focus();
  }, [currentQ, config]);

  const resetToPracticeHome = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    timerRef.current = undefined;
    elapsedRef.current = undefined;
    setShowExitDialog(false);
    setConfig(null);
    setQuestions([]);
    setCurrentQ(0);
    setScore({ correct: 0, wrong: 0 });
    setFinished(false);
    setFeedback(null);
    setInputValue('');
    setSelectedOption(null);
    setElapsedTime(0);
    setTimeLeft(0);
  }, []);

  const handleExitConfirmed = useCallback(() => {
    // Stop timers + dispose session, then route appropriately
    if (timerRef.current) clearInterval(timerRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    timerRef.current = undefined;
    elapsedRef.current = undefined;
    setShowExitDialog(false);
    if (fromLearning) {
      // Return to the same Learning screen the user came from
      onExit?.();
    } else {
      resetToPracticeHome();
    }
  }, [fromLearning, onExit, resetToPracticeHome]);

  const handleExitRequest = useCallback(() => {
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
  }, [config, finished, resetToPracticeHome, showExitDialog, fromLearning, onExit]);

  const handleBackToPractice = useCallback(() => {
    // Used from results screen swipe-back
    if (fromLearning) {
      onExit?.();
    } else {
      resetToPracticeHome();
    }
  }, [resetToPracticeHome, fromLearning, onExit]);

  // Intercept system back / swipe-back while a practice session is active.
  // We push an extra history entry so the first back-press lands here and
  // shows the exit confirmation dialog instead of leaving the screen.
  useEffect(() => {
    if (!config || finished) return;

    let popped = false;
    const handlePopstate = () => {
      popped = true;
      // Re-add the sentinel so subsequent back presses keep being intercepted
      window.history.pushState({ practiceSentinel: true }, '');
      setShowExitDialog(true);
    };

    window.history.pushState({ practiceSentinel: true }, '');
    window.addEventListener('popstate', handlePopstate);

    return () => {
      window.removeEventListener('popstate', handlePopstate);
      // Clean up the sentinel entry we added if user didn't back through it
      if (!popped) {
        window.history.back();
      }
    };
  }, [config, finished]);

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
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
            <div className="mb-4 flex justify-center">
              {accuracy >= 80 ? (
                <Trophy size={64} className="text-warning drop-shadow-[0_0_18px_hsl(var(--warning)/0.5)]" />
              ) : accuracy >= 50 ? (
                <ThumbsUp size={64} className="text-primary drop-shadow-[0_0_18px_hsl(var(--primary)/0.5)]" />
              ) : (
                <Dumbbell size={64} className="text-muted-foreground" />
              )}
            </div>
            <h2 className="font-display font-bold text-3xl text-foreground mb-2">
              {accuracy >= 80 ? 'Excellent!' : accuracy >= 50 ? 'Good Job!' : 'Keep Practicing!'}
            </h2>
            <p className="text-muted-foreground mb-2">Score: {accuracy}%</p>
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.15 }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full gradient-primary text-primary-foreground font-display font-bold text-base mb-3 shadow-lg shadow-primary/30"
            >
              <Zap size={16} className="text-warning" />
              +{sessionXP} XP
            </motion.div>
            {config.topics.length > 1 && (
              <p className="text-xs text-muted-foreground mb-4">
                Topics: {config.topics.map(t => t.label).join(', ')}
              </p>
            )}
            <div className="flex gap-8 mb-4">
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
                <p className="text-xs text-muted-foreground">Attempted</p>
              </div>
            </div>
            {config.infinite && <p className="text-sm text-muted-foreground mb-4">Time: {formatTime(elapsedTime)}</p>}
            <div className="flex gap-3">
              <button onClick={() => startPractice(config)} className="px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold">Retry</button>
              {fromLearning ? (
                <button onClick={() => onExit?.()} className="px-6 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold">Back to Learning</button>
              ) : (
                <button onClick={handleBackToPractice} className="px-6 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold">Back to Practice</button>
              )}
            </div>
          </motion.div>
        </div>
      </SwipeBack>
    );
  }

  // ACTIVE QUESTION
  if (config && questions.length > 0) {
    const q = questions[currentQ];
    if (!q) return null;
    const isLowTime = timeLeft <= 3 && config.timerEnabled;
    const isTimerHidden = !config.timerEnabled;
    const isPctQuestion = q.answerType !== undefined;
    const totalAttempts = score.correct + score.wrong;

    const renderQuestionText = () => {
      if (isPctQuestion && q.questionFraction) {
        return <div className="flex items-center justify-center gap-2"><RenderFraction n={q.questionFraction.n} d={q.questionFraction.d} size="lg" /></div>;
      }
      if (isPctQuestion && q.questionMixed) {
        return <div className="flex flex-col items-center gap-2"><RenderMixed mixed={q.questionMixed} size="lg" /><span className="text-muted-foreground text-lg">= ? (fraction)</span></div>;
      }
      if (isPctQuestion && q.text.includes('% = ?')) {
        return <p className="font-display text-3xl font-bold text-foreground">{q.text}</p>;
      }
      return (
        <p className="font-display text-4xl font-bold text-foreground">
          {q.text}
          {q.superscript && <sup className="text-primary text-2xl">{q.superscript}</sup>}
        </p>
      );
    };

    const renderAnswerHint = () => {
      if (!isPctQuestion) return null;
      const hints: Record<string, string> = {
        'decimal-pct': 'Answer in decimal %',
        'mixed-pct': 'Answer in mixed %',
        'fraction': 'Answer as fraction',
        'trig': 'Use √, /, or "Not Defined"',
      };
      return q.answerType ? <span className="text-xs text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">{hints[q.answerType]}</span> : null;
    };

    const renderOption = (opt: string | number, index: number) => {
      if (isPctQuestion && q.optionsMixed?.[index]) return <RenderMixed mixed={q.optionsMixed[index]!} size="sm" />;
      return <span>{String(opt)}</span>;
    };

    const renderCorrectAnswer = () => {
      if (isPctQuestion && q.mixedPctAnswer) return <RenderMixed mixed={q.mixedPctAnswer} size="md" />;
      return <span className="text-primary">{String(q.answer)}</span>;
    };

    return (
      <SwipeBack onBack={handleExitRequest}>
      <div>
        <AlertDialog open={showExitDialog} onOpenChange={(open) => { if (!open) setShowExitDialog(false); }}>
          <AlertDialogContent className="rounded-2xl max-w-[320px]">
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

        <div className="flex items-center justify-between mb-4">
          <button onClick={handleExitRequest} className="text-primary flex items-center gap-1"><ArrowLeft size={18} /></button>
          <div className="flex-1 px-3 max-w-[180px]">
            <XPBar />
          </div>
          {score.correct >= 2 && (
            <motion.div
              key={`combo-${score.correct}`}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-warning/20 to-accent/20 border border-warning/40 text-warning text-xs font-bold mr-1 shadow-[0_0_12px_hsl(var(--warning)/0.35)]"
              aria-label="Combo"
            >
              <Flame size={12} /> x{score.correct}
            </motion.div>
          )}
          {!isTimerHidden && (
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${isLowTime ? 'bg-destructive/20 text-destructive animate-pulse' : 'bg-secondary text-secondary-foreground'}`}>
              <Timer size={14} />{timeLeft}s
            </div>
          )}
          {config.infinite ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Q{currentQ + 1}</span>
              <button onClick={handleSubmitInfinite} disabled={totalAttempts === 0}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${totalAttempts > 0 ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}>
                Submit
              </button>
            </div>
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

        {!config.infinite && (
          <div className="h-1 bg-secondary rounded-full mb-6 overflow-hidden">
            <motion.div className="h-full gradient-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
          </div>
        )}

        {config.infinite && (
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-xs text-muted-foreground">∞ Infinite Mode</span>
            <span className="text-xs text-muted-foreground">{formatTime(elapsedTime)}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className={`text-center mb-4 rounded-2xl py-4 ${
              feedback === 'correct'
                ? 'anim-pulse-card anim-flash-success'
                : feedback === 'wrong'
                ? 'anim-shake anim-flash-destructive'
                : ''
            }`}
          >
            {renderQuestionText()}
            <div className="mt-2">{renderAnswerHint()}</div>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {feedback && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
              {feedback === 'correct' ? (
                <div className="relative">
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: [0.4, 1.25, 1], opacity: 1 }}
                    transition={{ duration: 0.4, times: [0, 0.6, 1] }}
                  >
                    <CheckCircle2 size={80} className="text-success drop-shadow-[0_0_18px_hsl(var(--success)/0.6)]" />
                  </motion.div>
                  <Particles count={14} color="bg-success" spread={90} />
                  {(score.correct + 1) % 5 === 0 && (
                    <span
                      className="absolute inset-0 rounded-full border-2 border-warning"
                      style={{ animation: 'ring-burst 0.6s ease-out forwards' }}
                    />
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <XCircle size={80} className="text-destructive mx-auto" />
                  <p className="text-foreground mt-2 text-lg font-semibold flex items-center justify-center gap-2">Answer: {renderCorrectAnswer()}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

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
          <div className="grid grid-cols-2 gap-3 mt-4">
            {q.options.map((opt, i) => {
              let optStyle = 'glass text-foreground hover:border-primary/60 hover:shadow-[0_0_20px_-4px_hsl(var(--primary)/0.45)]';
              if (feedback && selectedOption === i) {
                optStyle = feedback === 'correct'
                  ? 'bg-success/20 border-2 border-success text-success shadow-[0_0_28px_hsl(var(--success)/0.55)]'
                  : 'bg-destructive/20 border-2 border-destructive text-destructive shadow-[0_0_24px_hsl(var(--destructive)/0.5)]';
              }
              return (
                <motion.button key={`${currentQ}-${i}`} whileTap={{ scale: 0.94 }} whileHover={{ y: -1 }}
                  onClick={() => { if (feedback) return; setSelectedOption(i); handleAnswer(opt); }}
                  className={`rounded-2xl py-4 px-2 flex items-center justify-center font-display font-bold text-base transition-all min-h-[60px] ${optStyle}`}>
                  {renderOption(opt, i)}
                </motion.button>
              );
            })}
          </div>
        )}

        {config.mode === 'input' && (
          <div className="flex flex-col items-center gap-4 mt-4">
            {q.answerType !== 'trig' ? (
              <>
                <div
                  className="w-full max-w-xs bg-card/60 border border-border rounded-2xl px-4 py-4 text-center text-2xl font-display font-bold text-foreground min-h-[64px] flex items-center justify-center"
                  aria-live="polite"
                >
                  {inputValue || (
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
                />
              </>
            ) : (
              <input ref={inputRef} type="text" inputMode={q.answerType === 'trig' ? 'text' : 'numeric'}
                value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                placeholder={q.answerType === 'trig' ? 'e.g. 1/2, √3/2, Not Defined' : 'Your answer'}
                autoFocus
                className="w-full max-w-xs bg-card border border-border rounded-2xl px-4 py-4 text-center text-2xl font-display font-bold text-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all" />
            )}
          </div>
        )}
      </div>
      </SwipeBack>
    );
  }

  // ═══════════════════════════════════
  // SETUP SCREEN - Game Style UI
  // ═══════════════════════════════════

  const canStart = selectedTopics.size > 0;

  return (
    <div className="pb-4">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="font-display font-bold text-2xl text-glow flex items-center gap-2">
          <Zap size={20} className="text-primary" /> Quiz Arena
        </h1>
        <div className="flex-1 max-w-[180px]">
          <XPBar />
        </div>
      </div>

      {/* Topic Chips - Multi Select */}
      <div className="mb-5">
        <label className="text-sm text-muted-foreground mb-3 block font-semibold">Select Topics</label>
        <div className="grid grid-cols-2 gap-3">
          {TOPICS.map((t) => {
            const isSelected = selectedTopics.has(t.id);
            return (
              <motion.button
                key={t.id}
                whileTap={{ scale: 0.93 }}
                onClick={() => toggleTopic(t.id)}
                className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all relative overflow-hidden ${
                  isSelected
                    ? 'gradient-primary text-primary-foreground shadow-lg shadow-primary/30'
                    : 'bg-card border border-border text-foreground hover:border-primary/50'
                }`}
              >
                <span className="relative z-10 flex items-center gap-2">
                  <span className="text-base">{t.icon}</span>
                  {t.label}
                </span>
                {isSelected && (
                  <motion.div layoutId="glow" className="absolute inset-0 bg-primary/10 rounded-2xl" initial={false} />
                )}
              </motion.button>
            );
          })}
        </div>
        {selectedTopics.size === 0 && (
          <p className="text-destructive text-xs mt-2">Select at least one topic</p>
        )}
      </div>

      {/* Per-Topic Range Controls */}
      {selectedTopics.size > 0 && (
        <div className="mb-5 space-y-2">
          <label className="text-sm text-muted-foreground mb-2 block font-semibold">Range per Topic</label>
          {Array.from(selectedTopics).map((tid) => {
            const topicInfo = TOPICS.find(t => t.id === tid)!;
            const range = topicRanges[tid];
            const isExpanded = expandedTopic === tid;

            const isTrig = tid === 'trig';

            return (
              <div key={tid} className="bg-card border border-border rounded-2xl overflow-hidden">
                <button
                  onClick={() => { if (!isTrig) setExpandedTopic(isExpanded ? null : tid); }}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{topicInfo.icon}</span>
                    <span className="font-semibold text-sm text-foreground">{topicInfo.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {isTrig ? '(Standard angles)' : `(${range.from}–${range.to})`}
                    </span>
                  </div>
                  {!isTrig && (isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />)}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border"
                    >
                      <div className="p-4 space-y-3">
                        {tid === 'percentage' ? (
                          <>
                            <div className="flex gap-2 mb-2">
                              <button
                                onClick={() => updateRange(tid, 'pctRangeMode', 'preset')}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${(range.pctRangeMode || 'preset') === 'preset' ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                              >Preset</button>
                              <button
                                onClick={() => updateRange(tid, 'pctRangeMode', 'custom')}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${range.pctRangeMode === 'custom' ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                              >Custom</button>
                            </div>
                            {(range.pctRangeMode || 'preset') === 'preset' ? (
                              <div className="grid grid-cols-1 gap-1.5">
                                {[
                                  { label: '1/1 – 1/10', f: 1, t: 10 },
                                  { label: '1/11 – 1/20', f: 11, t: 20 },
                                  { label: '1/21 – 1/30', f: 21, t: 30 },
                                  { label: '1/31 – 1/40', f: 31, t: 40 },
                                  { label: '1/41 – 1/50', f: 41, t: 50 },
                                ].map((g) => (
                                  <button key={g.label}
                                    onClick={() => { updateRange(tid, 'from', g.f); updateRange(tid, 'to', g.t); }}
                                    className={`py-2 rounded-xl text-xs font-semibold transition-colors ${range.from === g.f && range.to === g.t ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                                  >{g.label}</button>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 justify-center">
                                <div className="flex flex-col items-center">
                                  <input type="number" inputMode="numeric" value={range.pctNumFrom || 1}
                                    onChange={(e) => updateRange(tid, 'pctNumFrom', Math.max(0, Number(e.target.value)))}
                                    className="w-14 bg-secondary border border-border rounded-xl px-2 py-1.5 text-center text-sm font-bold text-foreground focus:border-primary outline-none" />
                                  <div className="w-14 h-px bg-foreground/40 my-0.5" />
                                  <input type="number" inputMode="numeric" value={range.pctDenFrom || 2}
                                    onChange={(e) => updateRange(tid, 'pctDenFrom', Math.max(1, Number(e.target.value)))}
                                    className="w-14 bg-secondary border border-border rounded-xl px-2 py-1.5 text-center text-sm font-bold text-foreground focus:border-primary outline-none" />
                                </div>
                                <span className="text-muted-foreground text-xs font-semibold">to</span>
                                <div className="flex flex-col items-center">
                                  <input type="number" inputMode="numeric" value={range.pctNumTo || 5}
                                    onChange={(e) => updateRange(tid, 'pctNumTo', Math.max(0, Number(e.target.value)))}
                                    className="w-14 bg-secondary border border-border rounded-xl px-2 py-1.5 text-center text-sm font-bold text-foreground focus:border-primary outline-none" />
                                  <div className="w-14 h-px bg-foreground/40 my-0.5" />
                                  <input type="number" inputMode="numeric" value={range.pctDenTo || 2}
                                    onChange={(e) => updateRange(tid, 'pctDenTo', Math.max(1, Number(e.target.value)))}
                                    className="w-14 bg-secondary border border-border rounded-xl px-2 py-1.5 text-center text-sm font-bold text-foreground focus:border-primary outline-none" />
                                </div>
                              </div>
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
      <div className="mb-5">
        <label className="text-sm text-muted-foreground mb-2 block font-semibold">Questions</label>
        <div className="flex gap-2">
          {COUNTS.map((c) => (
            <button key={c} onClick={() => { setCount(c); setInfinite(false); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${!infinite && count === c ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>
              {c}
            </button>
          ))}
          <button onClick={() => setInfinite(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${infinite ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>
            ∞
          </button>
        </div>
      </div>

      {/* Answer Mode */}
      <div className="mb-5">
        <label className="text-sm text-muted-foreground mb-2 block font-semibold">Answer Mode</label>
        <div className="flex gap-2">
          <button onClick={() => setMode('mcq')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${mode === 'mcq' ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>MCQ</button>
          <button onClick={() => setMode('input')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${mode === 'input' ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>Type Answer</button>
        </div>
      </div>

      {/* Timer Toggle */}
      <div className="mb-5 bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Timer size={18} className="text-primary" />
            <span className="font-semibold text-sm text-foreground">Timer</span>
          </div>
          <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
        </div>
        <AnimatePresence>
          {timerEnabled && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="flex gap-2 mt-2">
                {[5, 10, 15, 30].map((s) => (
                  <button key={s} onClick={() => setTimerSeconds(s)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${timerSeconds === s ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'}`}>{s}s</button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Order */}
      <div className="mb-5">
        <label className="text-sm text-muted-foreground mb-2 block font-semibold">Order</label>
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
        whileTap={{ scale: 0.97 }}
        disabled={!canStart}
        onClick={() => {
          const topics = Array.from(selectedTopics).map(tid => {
            const info = TOPICS.find(t => t.id === tid)!;
            return { id: tid, label: info.label, range: topicRanges[tid] };
          });
          const cfg: PracticeConfig = {
            topics, count, infinite, mode,
            timerEnabled,
            timerSeconds: timerEnabled ? timerSeconds : 9999,
            sequential,
          };
          startPractice(cfg);
        }}
        className={`w-full py-4 rounded-2xl font-display font-bold text-lg shadow-lg mt-2 transition-all flex items-center justify-center gap-2 ${
          canStart
            ? 'gradient-primary text-primary-foreground shadow-primary/30'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        }`}
      >
        <Play size={18} fill="currentColor" /> Start Quiz
      </motion.button>

      {selectedTopics.size > 1 && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          Mixed mode: {selectedTopics.size} topics selected
        </p>
      )}
    </div>
  );
};

export default PracticePage;
