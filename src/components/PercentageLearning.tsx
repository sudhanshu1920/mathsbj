import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, Target } from 'lucide-react';
import StackedFraction from './StackedFraction';
import PracticeModeSelector from './PracticeModeSelector';

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

interface FractionRow {
  numerator: number;
  denominator: number;
  decimalPct: string;
  mixed: { whole: number; numerator: number; denominator: number } | null;
  wholePct: string | null;
}

function buildRow(n: number, d: number): FractionRow {
  const val = (n / d) * 100;
  const decimalPct = val % 1 === 0 ? `${val}%` : `${val.toFixed(2)}%`;
  const whole = Math.floor(val);
  const remNum = Math.round((val - whole) * d);
  let mixed: FractionRow['mixed'] = null;
  let wholePct: string | null = null;
  if (remNum > 0) {
    const g = gcd(remNum, d);
    mixed = { whole, numerator: remNum / g, denominator: d / g };
  } else {
    wholePct = `${whole}%`;
  }
  return { numerator: n, denominator: d, decimalPct, mixed, wholePct };
}

const GROUPS = [
  { label: '1/1 – 1/10', from: 1, to: 10 },
  { label: '1/11 – 1/20', from: 11, to: 20 },
  { label: '1/21 – 1/30', from: 21, to: 30 },
  { label: '1/31 – 1/40', from: 31, to: 40 },
  { label: '1/41 – 1/50', from: 41, to: 50 },
];

interface PercentageLearningProps {
  onStartPractice?: (topic: string, context?: { from?: number; to?: number }, mode?: 'mcq' | 'input') => void;
}

const PercentageLearning = ({ onStartPractice }: PercentageLearningProps) => {
  const [selectedGroup, setSelectedGroup] = useState<typeof GROUPS[0] | null>(null);
  const [expandedFraction, setExpandedFraction] = useState<number | null>(null);
  const [showPracticeMode, setShowPracticeMode] = useState<'group' | 'expanded' | null>(null);

  const handlePracticeSelect = (mode: 'mcq' | 'input') => {
    if (!onStartPractice) return;
    if (showPracticeMode === 'expanded' && expandedFraction && selectedGroup) {
      // Practice only this fraction's multiples - encode as special range
      onStartPractice('percentage', { from: expandedFraction, to: expandedFraction }, mode);
    } else if (showPracticeMode === 'group' && selectedGroup) {
      onStartPractice('percentage', { from: selectedGroup.from, to: selectedGroup.to }, mode);
    }
    setShowPracticeMode(null);
  };

  // Practice mode selector overlay
  if (showPracticeMode) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setShowPracticeMode(null)} className="flex items-center gap-2 text-primary">
            <ArrowLeft size={20} />
            <span className="font-medium">Back</span>
          </button>
          <h2 className="font-display font-bold text-lg text-foreground">Practice Mode</h2>
          <div className="w-20" />
        </div>
        <PracticeModeSelector onSelect={handlePracticeSelect} />
      </div>
    );
  }

  // Expanded view: multiples of 1/d up to 10/d
  if (selectedGroup && expandedFraction) {
    const d = expandedFraction;
    const rows = Array.from({ length: 10 }, (_, i) => buildRow(i + 1, d));

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setExpandedFraction(null)} className="flex items-center gap-2 text-primary">
            <ArrowLeft size={20} />
            <span className="font-medium">Back</span>
          </button>
          <h2 className="font-display font-bold text-lg text-foreground">Multiples of 1/{d}</h2>
          <button
            onClick={() => setShowPracticeMode('expanded')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full gradient-primary text-primary-foreground text-xs font-semibold"
          >
            <Target size={14} />
            Practice
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3 text-xs font-semibold text-muted-foreground">
          <div className="text-center">Fraction</div>
          <div className="text-center">Mixed %</div>
          <div className="text-center">Decimal %</div>
        </div>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-card border border-border rounded-xl px-3 py-3 grid grid-cols-3 gap-2 text-center text-sm items-center"
            >
              <span className="text-foreground font-medium">{row.numerator}/{row.denominator}</span>
              <span className="flex justify-center">
                {row.mixed ? (
                  <StackedFraction
                    whole={row.mixed.whole}
                    numerator={row.mixed.numerator}
                    denominator={row.mixed.denominator}
                  />
                ) : (
                  <span className="text-primary font-bold">{row.wholePct}</span>
                )}
              </span>
              <span className="text-foreground">{row.decimalPct}</span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // Group content: show all 1/from to 1/to
  if (selectedGroup) {
    const rows: FractionRow[] = [];
    for (let d = selectedGroup.from; d <= selectedGroup.to; d++) {
      rows.push(buildRow(1, d));
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setSelectedGroup(null)} className="flex items-center gap-2 text-primary">
            <ArrowLeft size={20} />
            <span className="font-medium">Back</span>
          </button>
          <h2 className="font-display font-bold text-lg text-foreground">{selectedGroup.label}</h2>
          <button
            onClick={() => setShowPracticeMode('group')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full gradient-primary text-primary-foreground text-xs font-semibold"
          >
            <Target size={14} />
            Practice
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3 text-xs font-semibold text-muted-foreground">
          <div className="text-center">Fraction</div>
          <div className="text-center">Mixed %</div>
          <div className="text-center">Decimal %</div>
        </div>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <motion.button
              key={row.denominator}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setExpandedFraction(row.denominator)}
              className="w-full bg-card border border-border rounded-xl px-3 py-3 grid grid-cols-3 gap-2 text-center text-sm items-center"
            >
              <span className="text-foreground font-medium flex items-center justify-center gap-1">
                1/{row.denominator}
                <ChevronRight size={12} className="text-muted-foreground" />
              </span>
              <span className="flex justify-center">
                {row.mixed ? (
                  <StackedFraction
                    whole={row.mixed.whole}
                    numerator={row.mixed.numerator}
                    denominator={row.mixed.denominator}
                  />
                ) : (
                  <span className="text-primary font-bold">{row.wholePct}</span>
                )}
              </span>
              <span className="text-foreground">{row.decimalPct}</span>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  // Group selection
  return (
    <div>
      <h3 className="font-display font-bold text-lg text-center mb-4 text-foreground">Select a Range</h3>
      <div className="grid grid-cols-1 gap-3">
        {GROUPS.map((g, i) => (
          <motion.button
            key={g.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setSelectedGroup(g)}
            className="bg-card border border-border rounded-xl py-4 text-center font-display font-semibold text-foreground hover:border-primary transition-colors"
          >
            {g.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default PercentageLearning;
