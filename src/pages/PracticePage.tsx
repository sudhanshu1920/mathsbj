import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Timer, CheckCircle2, XCircle } from 'lucide-react';
import SwipeBack from '@/components/SwipeBack';
import StackedFraction from '@/components/StackedFraction';
import { saveResult } from '@/lib/progress';

type PracticeMode = 'mcq' | 'input';
type TimerMode = 'per-question' | 'full-session';

interface PracticeConfig {
  topic: string;
  from: number;
  to: number;
  count: number;
  mode: PracticeMode;
  timerMode: TimerMode;
  timerSeconds: number;
  sequential: boolean;
  exponentFrom?: number;
  exponentTo?: number;
  // For percentage custom fraction range
  pctNumFrom?: number;
  pctDenFrom?: number;
  pctNumTo?: number;
  pctDenTo?: number;
}

type AnswerType = 'decimal-pct' | 'mixed-pct' | 'fraction';

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
}

const TOPICS = [
  { id: 'tables', label: 'Tables' },
  { id: 'squares', label: 'Squares' },
  { id: 'roots', label: 'Square Roots' },
  { id: 'cubes', label: 'Cubes' },
  { id: 'cube-roots', label: 'Cube Roots' },
  { id: 'powers', label: 'Powers' },
  { id: 'percentage', label: 'Percentage' },
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

function generateQuestions(config: PracticeConfig): Question[] {
  const questions: Question[] = [];
  const { topic, from, to } = config;

  if (topic === 'tables') {
    for (let n = from; n <= to; n++) {
      for (let m = 1; m <= 10; m++) {
        questions.push({ text: `${n} × ${m} = ?`, answer: n * m });
      }
    }
  } else if (topic === 'squares') {
    for (let n = from; n <= to; n++) {
      questions.push({ text: `${n}² = ?`, answer: n * n });
    }
  } else if (topic === 'roots' || topic === 'square-roots') {
    for (let n = from; n <= to; n++) {
      questions.push({ text: `√${n * n} = ?`, answer: n });
    }
  } else if (topic === 'cubes') {
    for (let n = from; n <= to; n++) {
      questions.push({ text: `${n}³ = ?`, answer: n * n * n });
    }
  } else if (topic === 'cube-roots') {
    for (let n = from; n <= to; n++) {
      questions.push({ text: `∛${n * n * n} = ?`, answer: n });
    }
  } else if (topic === 'powers') {
    const expFrom = config.exponentFrom || 1;
    const expTo = config.exponentTo || 10;
    for (let n = from; n <= to; n++) {
      for (let e = expFrom; e <= expTo; e++) {
        questions.push({ text: `${n}`, superscript: `${e}`, answer: Math.pow(n, e) });
      }
    }
  } else if (topic === 'percentage') {
    // Custom fraction range or preset range
    const pairs: { n: number; d: number }[] = [];

    if (config.pctNumFrom !== undefined && config.pctDenFrom !== undefined &&
        config.pctNumTo !== undefined && config.pctDenTo !== undefined) {
      // Custom range: generate n/d pairs where n goes from pctNumFrom..pctNumTo and d from pctDenFrom..pctDenTo
      // Actually generate all combos of numerator/denominator in range
      const startVal = config.pctNumFrom / config.pctDenFrom;
      const endVal = config.pctNumTo / config.pctDenTo;
      // Generate fractions n/d where d is fixed as pctDenFrom for simplicity,
      // or enumerate: same denominator, varying numerator
      if (config.pctDenFrom === config.pctDenTo) {
        const d = config.pctDenFrom;
        const nFrom = Math.min(config.pctNumFrom, config.pctNumTo);
        const nTo = Math.max(config.pctNumFrom, config.pctNumTo);
        for (let n = nFrom; n <= nTo; n++) {
          pairs.push({ n, d });
        }
      } else {
        // Different denominators: enumerate all unit fractions in range
        for (let d = Math.min(config.pctDenFrom, config.pctDenTo); d <= Math.max(config.pctDenFrom, config.pctDenTo); d++) {
          if (d === 0) continue;
          pairs.push({ n: 1, d });
        }
      }
    } else {
      const isExpanded = from === to;
      if (isExpanded) {
        for (let n = 1; n <= 10; n++) pairs.push({ n, d: from });
      } else {
        for (let d = Math.max(1, from); d <= Math.min(50, to); d++) {
          pairs.push({ n: 1, d });
        }
      }
    }

    for (const { n, d } of pairs) {
      const decPct = toDecimalPct(n, d);
      const mixed = toMixed(n, d);

      // Type 1: Fraction → Decimal %
      questions.push({
        text: `fraction-to-decimal`,
        questionFraction: { n, d },
        answer: decPct,
        answerType: 'decimal-pct',
      });

      // Type 2: Fraction → Mixed %
      if (mixed) {
        questions.push({
          text: `fraction-to-mixed`,
          questionFraction: { n, d },
          answer: mixedToString(mixed),
          answerType: 'mixed-pct',
          mixedPctAnswer: mixed,
        });
      }

      // Type 3: Decimal % → Fraction
      questions.push({
        text: `${decPct} = ? (fraction)`,
        answer: `${n}/${d}`,
        answerType: 'fraction',
      });

      // Type 4: Mixed % → Fraction
      if (mixed) {
        questions.push({
          text: `mixed-to-fraction`,
          questionMixed: mixed,
          answer: `${n}/${d}`,
          answerType: 'fraction',
        });
      }
    }
  }

  if (!config.sequential) {
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
  }

  if (config.mode === 'mcq') {
    return questions.slice(0, config.count).map((q) => {
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

      // Build mixed data for options that are mixed percentages
      const optionsMixed: (MixedPct | null)[] = shuffled.map((opt) => {
        if (q.answerType === 'mixed-pct') {
          // Parse "whole num/den%" format
          const match = opt.match(/^(\d+)\s+(\d+)\/(\d+)%$/);
          if (match) return { whole: Number(match[1]), numerator: Number(match[2]), denominator: Number(match[3]) };
          const match2 = opt.match(/^(\d+)\/(\d+)%$/);
          if (match2) return { whole: 0, numerator: Number(match2[1]), denominator: Number(match2[2]) };
        }
        return null;
      });

      return { ...q, options: shuffled.map(s => s), optionsMixed };
    });
  }

  return questions.slice(0, config.count);
}

// Normalize answer for comparison
function normalizeAnswer(input: string, expected: string): boolean {
  const a = input.trim().replace(/\s+/g, ' ');
  const b = expected.trim().replace(/\s+/g, ' ');
  if (a === b) return true;

  // Try numeric comparison (e.g., 16.67 vs 16.67%)
  const aNum = parseFloat(a.replace('%', ''));
  const bNum = parseFloat(b.replace('%', ''));
  if (!isNaN(aNum) && !isNaN(bNum) && Math.abs(aNum - bNum) < 0.01) return true;

  // Accept "16 2/3" for "16 2/3%"
  if (a + '%' === b || a === b.replace('%', '')) return true;

  return false;
}

// Render stacked fraction component for question/option display
const RenderMixed = ({ mixed, size = 'md' }: { mixed: MixedPct; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: { whole: 'text-sm', frac: 'text-[10px]', pct: 'text-sm' },
    md: { whole: 'text-lg', frac: 'text-xs', pct: 'text-lg' },
    lg: { whole: 'text-3xl', frac: 'text-sm', pct: 'text-3xl' },
  };
  const s = sizeClasses[size];

  return (
    <span className="inline-flex items-center gap-0.5">
      {mixed.whole > 0 && (
        <span className={`font-bold text-primary ${s.whole}`}>{mixed.whole}</span>
      )}
      <span className={`inline-flex flex-col items-center leading-none ${s.frac} relative`} style={{ verticalAlign: 'middle' }}>
        <span className="text-primary font-semibold">{mixed.numerator}</span>
        <span className="w-full h-px bg-primary/60 my-0.5" />
        <span className="text-primary font-semibold">{mixed.denominator}</span>
      </span>
      <span className={`text-primary font-bold ${s.pct}`}>%</span>
    </span>
  );
};

const RenderFraction = ({ n, d, size = 'lg' }: { n: number; d: number; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-3xl',
  };
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex flex-col items-center leading-none relative" style={{ verticalAlign: 'middle' }}>
        <span className={`text-foreground font-bold ${sizeClasses[size]}`}>{n}</span>
        <span className="w-full h-px bg-foreground/40 my-0.5" />
        <span className={`text-foreground font-bold ${sizeClasses[size]}`}>{d}</span>
      </span>
      <span className={`text-foreground font-bold ${sizeClasses[size]}`}= ?</span>
    </span>
  );
};

interface PracticePageProps {
  initialTopic?: string;
  initialContext?: { from?: number; to?: number; number?: number };
  initialMode?: 'mcq' | 'input';
  onExit?: () => void;
}

const PracticePage = ({ initialTopic, initialContext, initialMode, onExit }: PracticePageProps) => {
  const [config, setConfig] = useState<PracticeConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [finished, setFinished] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Setup form state
  const [topic, setTopic] = useState(initialTopic || 'tables');
  const [from, setFrom] = useState(initialContext?.from || initialContext?.number || 1);
  const [to, setTo] = useState(initialContext?.to || initialContext?.number || 10);
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<PracticeMode>(initialMode || 'mcq');
  const [timerMode, setTimerMode] = useState<TimerMode>('per-question');
  const [timerSeconds, setTimerSeconds] = useState(10);
  const [sequential, setSequential] = useState(false);
  const [expFrom, setExpFrom] = useState(1);
  const [expTo, setExpTo] = useState(5);

  // Custom fraction range for percentage
  const [pctNumFrom, setPctNumFrom] = useState(1);
  const [pctDenFrom, setPctDenFrom] = useState(2);
  const [pctNumTo, setPctNumTo] = useState(5);
  const [pctDenTo, setPctDenTo] = useState(2);
  const [pctRangeMode, setPctRangeMode] = useState<'preset' | 'custom'>('preset');

  useEffect(() => {
    if (initialTopic && initialMode) {
      const mappedTopic = initialTopic === 'square-roots' ? 'roots' : initialTopic;
      const cfg: PracticeConfig = {
        topic: mappedTopic,
        from: initialContext?.from || initialContext?.number || 1,
        to: initialContext?.to || initialContext?.number || (initialTopic === 'percentage' ? 50 : 10),
        count: 10,
        mode: initialMode,
        timerMode: 'per-question',
        timerSeconds: 10,
        sequential: false,
      };
      startPractice(cfg);
    }
  }, [initialTopic, initialMode]);

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
    if (cfg.timerMode === 'per-question') {
      setTimeLeft(cfg.timerSeconds);
    } else {
      setTimeLeft(cfg.timerSeconds * qs.length);
    }
  };

  useEffect(() => {
    if (!config || finished) return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAnswer(null);
          return config.timerMode === 'per-question' ? config.timerSeconds : 0;
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
        if (typeof q.answer === 'number') {
          isCorrect = Number(answer) === q.answer;
        } else {
          isCorrect = normalizeAnswer(String(answer), String(q.answer));
        }
      }

      setFeedback(isCorrect ? 'correct' : 'wrong');
      saveResult(config.topic, isCorrect);

      const newScore = {
        correct: score.correct + (isCorrect ? 1 : 0),
        wrong: score.wrong + (isCorrect ? 0 : 1),
      };
      setScore(newScore);

      setTimeout(() => {
        setFeedback(null);
        setInputValue('');
        setSelectedOption(null);
        if (currentQ + 1 >= questions.length) {
          setFinished(true);
          if (timerRef.current) clearInterval(timerRef.current);
        } else {
          setCurrentQ(currentQ + 1);
          if (config.timerMode === 'per-question') setTimeLeft(config.timerSeconds);
        }
      }, 600);
    },
    [config, currentQ, questions, score, finished, feedback]
  );

  // Auto-submit for input mode
  useEffect(() => {
    if (!config || config.mode !== 'input' || !inputValue.trim() || feedback) return;
    const q = questions[currentQ];
    if (!q) return;

    if (typeof q.answer === 'number') {
      const numVal = Number(inputValue);
      if (!isNaN(numVal) && numVal === q.answer) handleAnswer(numVal);
    } else {
      if (normalizeAnswer(inputValue.trim(), String(q.answer))) handleAnswer(inputValue.trim());
    }
  }, [inputValue, config, currentQ, questions, feedback, handleAnswer]);

  useEffect(() => {
    if (config?.mode === 'input' && inputRef.current) inputRef.current.focus();
  }, [currentQ, config]);

  const handleExit = () => {
    if (onExit) onExit();
    else setConfig(null);
  };

  // RESULTS
  if (finished && config) {
    const accuracy = Math.round((score.correct / questions.length) * 100);
    return (
      <SwipeBack onBack={handleExit}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
            <div className="text-6xl mb-4">{accuracy >= 80 ? '🏆' : accuracy >= 50 ? '👍' : '💪'}</div>
            <h2 className="font-display font-bold text-3xl text-foreground mb-2">
              {accuracy >= 80 ? 'Excellent!' : accuracy >= 50 ? 'Good Job!' : 'Keep Practicing!'}
            </h2>
            <p className="text-muted-foreground mb-6">Score: {accuracy}%</p>
            <div className="flex gap-8 mb-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-success">{score.correct}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-destructive">{score.wrong}</p>
                <p className="text-xs text-muted-foreground">Wrong</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => startPractice(config)} className="px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold">Retry</button>
              <button onClick={handleExit} className="px-6 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold">
                {onExit ? 'Back to Learning' : 'New Practice'}
              </button>
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
    const isLowTime = timeLeft <= 3;
    const isPctQuestion = config.topic === 'percentage';

    // Render question text with stacked fractions
    const renderQuestionText = () => {
      if (isPctQuestion && q.questionFraction) {
        return (
          <div className="flex items-center justify-center gap-2">
            <RenderFraction n={q.questionFraction.n} d={q.questionFraction.d} size="lg" />
          </div>
        );
      }
      if (isPctQuestion && q.questionMixed) {
        return (
          <div className="flex flex-col items-center gap-2">
            <RenderMixed mixed={q.questionMixed} size="lg" />
            <span className="text-muted-foreground text-lg">= ? (fraction)</span>
          </div>
        );
      }
      if (isPctQuestion && q.text.includes('% = ?')) {
        return (
          <p className="font-display text-3xl font-bold text-foreground">{q.text}</p>
        );
      }
      return (
        <p className="font-display text-4xl font-bold text-foreground">
          {q.text}
          {q.superscript && <sup className="text-primary text-2xl">{q.superscript}</sup>}
        </p>
      );
    };

    // Render answer type label
    const renderAnswerHint = () => {
      if (!isPctQuestion) return null;
      const hints: Record<string, string> = {
        'decimal-pct': 'Answer in decimal %',
        'mixed-pct': 'Answer in mixed %',
        'fraction': 'Answer as fraction',
      };
      return q.answerType ? (
        <span className="text-xs text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">{hints[q.answerType]}</span>
      ) : null;
    };

    // Render option content
    const renderOption = (opt: string | number, index: number) => {
      if (isPctQuestion && q.optionsMixed?.[index]) {
        return <RenderMixed mixed={q.optionsMixed[index]!} size="sm" />;
      }
      return <span>{String(opt)}</span>;
    };

    // Render correct answer in feedback
    const renderCorrectAnswer = () => {
      if (isPctQuestion && q.mixedPctAnswer) {
        return <RenderMixed mixed={q.mixedPctAnswer} size="md" />;
      }
      return <span className="text-primary">{String(q.answer)}</span>;
    };

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={handleExit} className="text-primary flex items-center gap-1">
            <ArrowLeft size={18} />
            <span className="text-sm">Exit</span>
          </button>
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${isLowTime ? 'bg-destructive/20 text-destructive animate-pulse' : 'bg-secondary text-secondary-foreground'}`}>
            <Timer size={14} />
            {timeLeft}s
          </div>
          <span className="text-sm text-muted-foreground">{currentQ + 1}/{questions.length}</span>
        </div>

        <div className="h-1 bg-secondary rounded-full mb-6 overflow-hidden">
          <motion.div className="h-full gradient-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentQ} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} className="text-center mb-4">
            {renderQuestionText()}
            <div className="mt-2">{renderAnswerHint()}</div>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {feedback && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
              {feedback === 'correct' ? (
                <CheckCircle2 size={80} className="text-success" />
              ) : (
                <div className="text-center">
                  <XCircle size={80} className="text-destructive mx-auto" />
                  <p className="text-foreground mt-2 text-lg font-semibold flex items-center justify-center gap-2">
                    Answer: {renderCorrectAnswer()}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {config.mode === 'mcq' && q.options && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            {q.options.map((opt, i) => {
              let optStyle = 'bg-card border border-border text-foreground hover:border-primary';
              if (feedback && selectedOption === i) {
                optStyle = feedback === 'correct'
                  ? 'bg-success/20 border-2 border-success text-success'
                  : 'bg-destructive/20 border-2 border-destructive text-destructive';
              }
              return (
                <motion.button
                  key={`${currentQ}-${i}`}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { if (feedback) return; setSelectedOption(i); handleAnswer(opt); }}
                  className={`rounded-2xl py-4 px-2 flex items-center justify-center font-display font-bold text-base transition-colors min-h-[60px] ${optStyle}`}
                >
                  {renderOption(opt, i)}
                </motion.button>
              );
            })}
          </div>
        )}

        {config.mode === 'input' && (
          <div className="flex flex-col items-center gap-4 mt-4">
            <input
              ref={inputRef}
              type="text"
              inputMode={topic === 'percentage' ? 'text' : 'numeric'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={q.answerType === 'fraction' ? 'e.g. 1/3' : q.answerType === 'mixed-pct' ? 'e.g. 16 2/3' : 'Your answer'}
              autoFocus
              className="w-full max-w-xs bg-card border border-border rounded-2xl px-4 py-4 text-center text-2xl font-display font-bold text-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
            />
          </div>
        )}
      </div>
    );
  }

  // SETUP SCREEN
  const pctDenFromValid = pctDenFrom > 0;
  const pctDenToValid = pctDenTo > 0;
  const pctCustomValid = pctDenFromValid && pctDenToValid && pctNumFrom > 0 && pctNumTo > 0;

  const fromValid = from > 0;
  const toValid = to > 0 && to >= from;
  const canStart = topic === 'percentage'
    ? (pctRangeMode === 'preset' ? fromValid && toValid : pctCustomValid)
    : (fromValid && toValid);

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-6 text-glow">Practice</h1>

      <div className="mb-5">
        <label className="text-sm text-muted-foreground mb-2 block">Topic</label>
        <div className="grid grid-cols-3 gap-2">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTopic(t.id)}
              className={`py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                topic === t.id ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {topic === 'percentage' ? (
        <div className="mb-5">
          <label className="text-sm text-muted-foreground mb-2 block">Fraction Range</label>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setPctRangeMode('preset')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${pctRangeMode === 'preset' ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}
            >
              Preset
            </button>
            <button
              onClick={() => setPctRangeMode('custom')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${pctRangeMode === 'custom' ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}
            >
              Custom
            </button>
          </div>

          {pctRangeMode === 'preset' ? (
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: '1/1 – 1/10', f: 1, t: 10 },
                { label: '1/11 – 1/20', f: 11, t: 20 },
                { label: '1/21 – 1/30', f: 21, t: 30 },
                { label: '1/31 – 1/40', f: 31, t: 40 },
                { label: '1/41 – 1/50', f: 41, t: 50 },
              ].map((g) => (
                <button
                  key={g.label}
                  onClick={() => { setFrom(g.f); setTo(g.t); }}
                  className={`py-3 rounded-xl text-sm font-semibold transition-colors ${
                    from === g.f && to === g.t ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Custom fraction input with stacked UI */}
              <div className="flex items-center gap-3 justify-center">
                {/* From fraction */}
                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={pctNumFrom}
                    onChange={(e) => setPctNumFrom(Math.max(0, Number(e.target.value)))}
                    placeholder="Num"
                    className="w-16 bg-card border border-border rounded-xl px-2 py-2 text-center text-lg font-bold text-foreground focus:border-primary outline-none"
                  />
                  <div className="w-16 h-px bg-foreground/40 my-1" />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={pctDenFrom}
                    onChange={(e) => setPctDenFrom(Math.max(0, Number(e.target.value)))}
                    placeholder="Den"
                    className={`w-16 bg-card border rounded-xl px-2 py-2 text-center text-lg font-bold text-foreground focus:border-primary outline-none ${pctDenFrom === 0 ? 'border-destructive' : 'border-border'}`}
                  />
                </div>

                <span className="text-muted-foreground font-semibold text-sm">to</span>

                {/* To fraction */}
                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={pctNumTo}
                    onChange={(e) => setPctNumTo(Math.max(0, Number(e.target.value)))}
                    placeholder="Num"
                    className="w-16 bg-card border border-border rounded-xl px-2 py-2 text-center text-lg font-bold text-foreground focus:border-primary outline-none"
                  />
                  <div className="w-16 h-px bg-foreground/40 my-1" />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={pctDenTo}
                    onChange={(e) => setPctDenTo(Math.max(0, Number(e.target.value)))}
                    placeholder="Den"
                    className={`w-16 bg-card border rounded-xl px-2 py-2 text-center text-lg font-bold text-foreground focus:border-primary outline-none ${pctDenTo === 0 ? 'border-destructive' : 'border-border'}`}
                  />
                </div>
              </div>

              {(pctDenFrom === 0 || pctDenTo === 0) && (
                <p className="text-destructive text-xs text-center">Denominator cannot be 0</p>
              )}

              {/* Preview */}
              {pctCustomValid && (
                <div className="bg-secondary/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Practice range</p>
                  <p className="text-foreground font-semibold text-sm">
                    {pctNumFrom}/{pctDenFrom} → {pctNumTo}/{pctDenTo}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-5">
          <label className="text-sm text-muted-foreground mb-2 block">Number Range</label>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">From</label>
              <input type="number" inputMode="numeric" value={from} onChange={(e) => setFrom(Number(e.target.value))}
                className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-center font-display font-bold text-foreground focus:border-primary outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">To</label>
              <input type="number" inputMode="numeric" value={to} onChange={(e) => setTo(Number(e.target.value))}
                className={`w-full bg-card border rounded-2xl px-4 py-3 text-center font-display font-bold text-foreground focus:border-primary outline-none ${to < from ? 'border-destructive' : 'border-border'}`} />
              {to < from && <p className="text-destructive text-xs mt-1">To must be ≥ From</p>}
            </div>
          </div>
        </div>
      )}

      {topic === 'powers' && (
        <div className="mb-5">
          <label className="text-sm text-muted-foreground mb-2 block">Exponent Range</label>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Exponent From</label>
              <input type="number" inputMode="numeric" value={expFrom} onChange={(e) => setExpFrom(Number(e.target.value))}
                className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-center font-display font-bold text-foreground focus:border-primary outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Exponent To</label>
              <input type="number" inputMode="numeric" value={expTo} onChange={(e) => setExpTo(Number(e.target.value))}
                className={`w-full bg-card border rounded-2xl px-4 py-3 text-center font-display font-bold text-foreground focus:border-primary outline-none ${expTo < expFrom ? 'border-destructive' : 'border-border'}`} />
              {expTo < expFrom && <p className="text-destructive text-xs mt-1">To must be ≥ From</p>}
            </div>
          </div>
        </div>
      )}

      <div className="mb-5">
        <label className="text-sm text-muted-foreground mb-2 block">Questions</label>
        <div className="flex gap-2">
          {COUNTS.map((c) => (
            <button key={c} onClick={() => setCount(c)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${count === c ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <label className="text-sm text-muted-foreground mb-2 block">Answer Mode</label>
        <div className="flex gap-2">
          <button onClick={() => setMode('mcq')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${mode === 'mcq' ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>MCQ</button>
          <button onClick={() => setMode('input')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${mode === 'input' ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>Type Answer</button>
        </div>
      </div>

      <div className="mb-5">
        <label className="text-sm text-muted-foreground mb-2 block">Order</label>
        <div className="flex gap-2">
          <button onClick={() => setSequential(false)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${!sequential ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>Random</button>
          <button onClick={() => setSequential(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${sequential ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>Sequential</button>
        </div>
      </div>

      <div className="mb-5">
        <label className="text-sm text-muted-foreground mb-2 block">Timer</label>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setTimerMode('per-question')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${timerMode === 'per-question' ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>Per Question</button>
          <button onClick={() => setTimerMode('full-session')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${timerMode === 'full-session' ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>Full Session</button>
        </div>
        <div className="flex gap-2">
          {[5, 10, 15, 30].map((s) => (
            <button key={s} onClick={() => setTimerSeconds(s)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${timerSeconds === s ? 'bg-accent text-accent-foreground' : 'bg-card border border-border text-foreground'}`}>{s}s</button>
          ))}
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={!canStart}
        onClick={() => {
          const cfg: PracticeConfig = {
            topic, from, to, count, mode, timerMode, timerSeconds, sequential,
            exponentFrom: expFrom, exponentTo: expTo,
            ...(topic === 'percentage' && pctRangeMode === 'custom' ? {
              pctNumFrom, pctDenFrom, pctNumTo, pctDenTo,
            } : {}),
          };
          startPractice(cfg);
        }}
        className={`w-full py-4 rounded-2xl font-display font-bold text-lg shadow-lg mt-4 ${canStart ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
      >
        Start Practice
      </motion.button>
    </div>
  );
};

export default PracticePage;
