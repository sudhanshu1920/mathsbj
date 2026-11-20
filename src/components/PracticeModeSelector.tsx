import { useState } from 'react';
import { m as motion } from 'framer-motion';
import { ListChecks, Keyboard, Timer, Infinity as InfinityIcon, ListOrdered, Shuffle } from 'lucide-react';
import { MOTION } from '@/lib/motion';
import { Switch } from '@/components/ui/switch';
import type { LearningQuestionOrder } from '@/lib/practiceNavigation';

export interface PracticeSettings {
  mode: 'mcq' | 'input';
  timerEnabled: boolean;
  timerSeconds: number;
  infinite: boolean;
  questionOrder: LearningQuestionOrder;
}

interface PracticeModeSelectorProps {
  onSelect: (settings: PracticeSettings) => void;
  onQuestionOrderChange?: (order: LearningQuestionOrder) => void;
  initialSettings?: Partial<PracticeSettings>;
}

const PracticeModeSelector = ({ onSelect, onQuestionOrderChange, initialSettings }: PracticeModeSelectorProps) => {
  const [mode, setMode] = useState<'mcq' | 'input'>(initialSettings?.mode ?? 'mcq');
  const [timerEnabled, setTimerEnabled] = useState(initialSettings?.timerEnabled ?? false);
  const [timerSeconds, setTimerSeconds] = useState(initialSettings?.timerSeconds ?? 10);
  const [infinite, setInfinite] = useState(initialSettings?.infinite ?? false);
  const [questionOrder, setQuestionOrder] = useState<LearningQuestionOrder>(initialSettings?.questionOrder ?? 'mix');

  const handleQuestionOrderChange = (nextOrder: LearningQuestionOrder) => {
    setQuestionOrder(nextOrder);
    onQuestionOrderChange?.(nextOrder);
  };

  const handleStart = () => {
    onSelect({ mode, timerEnabled, timerSeconds, infinite, questionOrder });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: MOTION.distance.small }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.duration.standard, ease: MOTION.ease.enter }}
      className="flex flex-col gap-5 py-4"
      data-swipe-ignore-app-section="true"
    >
      <div className="rounded-2xl border border-border/70 bg-card/40 p-3">
        <label className="mb-2 block text-xs font-semibold text-muted-foreground">Question Order</label>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Question Order">
          <button
            type="button"
            aria-label="Sequence"
            aria-pressed={questionOrder === 'sequence'}
            onClick={() => handleQuestionOrderChange('sequence')}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${questionOrder === 'sequence' ? 'gradient-primary text-primary-foreground shadow-sm' : 'border border-border bg-background/70 text-foreground hover:bg-secondary'}`}
          >
            <ListOrdered size={15} />
            <span>Sequence</span>
          </button>
          <button
            type="button"
            aria-label="Mix"
            aria-pressed={questionOrder === 'mix'}
            onClick={() => handleQuestionOrderChange('mix')}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${questionOrder === 'mix' ? 'gradient-primary text-primary-foreground shadow-sm' : 'border border-border bg-background/70 text-foreground hover:bg-secondary'}`}
          >
            <Shuffle size={15} />
            <span>Mix</span>
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-2 block">Answer Mode</label>
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: MOTION.scale.press }}
            onClick={() => setMode('mcq')}
            className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl font-semibold shadow-lg transition-colors ${mode === 'mcq' ? 'gradient-primary text-primary-foreground' : 'glass border border-border text-foreground'}`}
          >
            <ListChecks size={24} />
            <span className="text-sm">MCQ</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: MOTION.scale.press }}
            onClick={() => setMode('input')}
            className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl font-semibold shadow-lg transition-colors ${mode === 'input' ? 'bg-accent text-accent-foreground' : 'glass border border-border text-foreground'}`}
          >
            <Keyboard size={24} />
            <span className="text-sm">Type Answer</span>
          </motion.button>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Timer size={18} className="text-primary" />
            <span className="font-semibold text-foreground text-sm">Timer</span>
          </div>
          <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
        </div>
        <p className="text-xs text-muted-foreground mb-3">Per question countdown</p>
        {timerEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-2"
          >
            {[5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setTimerSeconds(s)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${timerSeconds === s ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
              >
                {s}s
              </button>
            ))}
          </motion.div>
        )}
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <InfinityIcon size={18} className="text-primary" />
            <span className="font-semibold text-foreground text-sm">Infinite Questions</span>
          </div>
          <Switch checked={infinite} onCheckedChange={setInfinite} />
        </div>
        <p className="text-xs text-muted-foreground">
          {infinite ? 'Unlimited questions – tap Submit to finish' : 'Uses default question count'}
        </p>
      </div>

      <motion.button
        whileTap={{ scale: MOTION.scale.press }}
        onClick={handleStart}
        className="w-full py-4 rounded-2xl gradient-primary text-primary-foreground font-display font-bold text-lg shadow-lg"
      >
        Start Practice
      </motion.button>
    </motion.div>
  );
};

export default PracticeModeSelector;