import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Timer, CheckCircle2, XCircle } from 'lucide-react';
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
}

interface Question {
  text: string;
  superscript?: string;
  answer: number | string;
  options?: (number | string)[];
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
        questions.push({
          text: `${n}`,
          superscript: `${e}`,
          answer: Math.pow(n, e),
        });
      }
    }
  } else if (topic === 'percentage') {
    // If from === to, it's an expanded fraction practice (multiples of 1/d)
    const isExpanded = from === to;
    const denominators: number[] = [];
    
    if (isExpanded) {
      denominators.push(from);
    } else {
      for (let d = Math.max(1, from); d <= Math.min(50, to); d++) {
        denominators.push(d);
      }
    }

    for (const d of denominators) {
      const maxN = isExpanded ? 10 : 1;
      for (let n = 1; n <= maxN; n++) {
        const val = (n / d) * 100;
        const decimalPct = val % 1 === 0 ? `${val}%` : `${val.toFixed(2)}%`;

        // Fraction → Decimal %
        questions.push({ text: `${n}/${d} = ? (decimal %)`, answer: decimalPct });

        // Fraction → Mixed %
        const whole = Math.floor(val);
        const remNum = Math.round((val - whole) * d);
        let mixedStr: string;
        if (remNum === 0) {
          mixedStr = `${whole}%`;
        } else {
          const g = gcd(remNum, d);
          mixedStr = `${whole > 0 ? whole + ' ' : ''}${remNum / g}/${d / g}%`;
        }
        questions.push({ text: `${n}/${d} = ? (mixed %)`, answer: mixedStr });

        // % → Fraction
        questions.push({ text: `${decimalPct} = ? (fraction)`, answer: `${n}/${d}` });

        // Mixed % → Fraction
        if (mixedStr !== decimalPct) {
          questions.push({ text: `${mixedStr} = ? (fraction)`, answer: `${n}/${d}` });
        }
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
      const opts = new Set<number | string>();
      opts.add(correct);
      while (opts.size < 4) {
        if (typeof correct === 'number') {
          const offset = Math.floor(Math.random() * 20) - 10;
          const wrong = correct + offset;
          if (wrong !== correct && wrong >= 0) opts.add(wrong);
        } else {
          const d = Math.floor(Math.random() * 49) + 2;
          const val = (1 / d) * 100;
          const pct = val % 1 === 0 ? `${val}%` : `${val.toFixed(2)}%`;
          const wrongAns = q.text.includes('fraction') ? `1/${d}` : pct;
          opts.add(wrongAns);
        }
      }
      const shuffled = Array.from(opts).sort(() => Math.random() - 0.5);
      return { ...q, options: shuffled };
    });
  }

  return questions.slice(0, config.count);
}

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
      const isCorrect = answer !== null && String(answer).trim() === String(q.answer).trim();

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
      }, 500);
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
      if (inputValue.trim() === String(q.answer)) handleAnswer(inputValue.trim());
    }
  }, [inputValue, config, currentQ, questions, feedback, handleAnswer]);

  useEffect(() => {
    if (config?.mode === 'input' && inputRef.current) inputRef.current.focus();
  }, [currentQ, config]);

  const handleExit = () => {
    if (onExit) {
      onExit();
    } else {
      setConfig(null);
    }
  };

  // RESULTS
  if (finished && config) {
    const accuracy = Math.round((score.correct / questions.length) * 100);
    return (
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
    );
  }

  // ACTIVE QUESTION
  if (config && questions.length > 0) {
    const q = questions[currentQ];
    if (!q) return null;
    const isLowTime = timeLeft <= 3;

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

        <div className="h-1 bg-secondary rounded-full mb-8 overflow-hidden">
          <motion.div className="h-full gradient-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentQ} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} className="text-center mb-8">
            <p className="font-display text-4xl font-bold text-foreground">
              {q.text}
              {q.superscript && <sup className="text-primary text-2xl">{q.superscript}</sup>}
            </p>
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
                  <p className="text-foreground mt-2 text-lg font-semibold">Answer: <span className="text-primary">{String(q.answer)}</span></p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {config.mode === 'mcq' && q.options && (
          <div className="grid grid-cols-2 gap-3">
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
                  className={`rounded-xl py-4 text-center font-display font-bold text-lg transition-colors ${optStyle}`}
                >
                  {String(opt)}
                </motion.button>
              );
            })}
          </div>
        )}

        {config.mode === 'input' && (
          <div className="flex flex-col items-center gap-4">
            <input
              ref={inputRef}
              type="text"
              inputMode={topic === 'percentage' ? 'text' : 'numeric'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Your answer"
              autoFocus
              className="w-full max-w-xs bg-card border border-border rounded-xl px-4 py-4 text-center text-2xl font-display font-bold text-foreground focus:border-primary outline-none"
            />
          </div>
        )}
      </div>
    );
  }

  // SETUP SCREEN
  const fromValid = from > 0;
  const toValid = to > 0 && to >= from;
  const canStart = fromValid && toValid;

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
        onClick={() => startPractice({ topic, from, to, count, mode, timerMode, timerSeconds, sequential, exponentFrom: expFrom, exponentTo: expTo })}
        className={`w-full py-4 rounded-2xl font-display font-bold text-lg shadow-lg mt-4 ${canStart ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
      >
        Start Practice
      </motion.button>
    </div>
  );
};

export default PracticePage;
