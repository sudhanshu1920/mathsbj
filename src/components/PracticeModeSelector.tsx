import { useState } from 'react';
import { motion } from 'framer-motion';
import { ListChecks, Keyboard, Timer, Infinity } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export interface PracticeSettings {
  mode: 'mcq' | 'input';
  timerEnabled: boolean;
  timerSeconds: number;
  infinite: boolean;
}

interface PracticeModeSelectorProps {
  onSelect: (settings: PracticeSettings) => void;
}

const PracticeModeSelector = ({ onSelect }: PracticeModeSelectorProps) => {
  const [mode, setMode] = useState<'mcq' | 'input'>('mcq');
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(10);
  const [infinite, setInfinite] = useState(false);

  const handleStart = () => {
    onSelect({ mode, timerEnabled, timerSeconds, infinite });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 py-4"
    >
      {/* Answer Mode */}
      <div>
        <label className="text-sm text-muted-foreground mb-2 block">Answer Mode</label>
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setMode('mcq')}
            className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl font-semibold shadow-lg transition-colors ${
              mode === 'mcq' ? 'gradient-primary text-primary-foreground' : 'bg-card border border-border text-foreground'
            }`}
          >
            <ListChecks size={24} />
            <span className="text-sm">MCQ</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setMode('input')}
            className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl font-semibold shadow-lg transition-colors ${
              mode === 'input' ? 'bg-accent text-accent-foreground' : 'bg-card border border-border text-foreground'
            }`}
          >
            <Keyboard size={24} />
            <span className="text-sm">Type Answer</span>
          </motion.button>
        </div>
      </div>

      {/* Timer Toggle */}
      <div className="bg-card border border-border rounded-2xl p-4">
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
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                  timerSeconds === s ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {s}s
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Infinite Mode Toggle */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Infinity size={18} className="text-primary" />
            <span className="font-semibold text-foreground text-sm">Infinite Questions</span>
          </div>
          <Switch checked={infinite} onCheckedChange={setInfinite} />
        </div>
        <p className="text-xs text-muted-foreground">
          {infinite ? 'Unlimited questions – tap Submit to finish' : 'Uses default question count'}
        </p>
      </div>

      {/* Start Button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleStart}
        className="w-full py-4 rounded-2xl gradient-primary text-primary-foreground font-display font-bold text-lg shadow-lg"
      >
        Start Practice
      </motion.button>
    </motion.div>
  );
};

export default PracticeModeSelector;
