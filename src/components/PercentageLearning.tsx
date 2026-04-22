import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import StackedFraction from './StackedFraction';
import SwipeContainer from './SwipeContainer';

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

export const PERCENTAGE_GROUPS = [
  ...Array.from({ length: 20 }, (_, i) => ({
    label: `${i * 10 + 1}–${(i + 1) * 10}`,
    from: i * 10 + 1,
    to: (i + 1) * 10,
  })),
];

interface PercentageLearningProps {
  groupIndex: number;
  onGroupIndexChange: (index: number) => void;
  onExpandFraction: (denominator: number) => void;
}

const PercentageLearning = ({ groupIndex, onGroupIndexChange, onExpandFraction }: PercentageLearningProps) => {
  const groupItems = PERCENTAGE_GROUPS.map((group) => {
    const rows: FractionRow[] = [];
    for (let d = group.from; d <= group.to; d++) {
      rows.push(buildRow(1, d));
    }

    return (
      <div key={group.label}>
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
              onClick={() => onExpandFraction(row.denominator)}
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
  });

  return (
    <SwipeContainer items={groupItems} currentIndex={groupIndex} onIndexChange={onGroupIndexChange} />
  );
};

export interface PercentageExpandedProps {
  denominator: number;
  onDenominatorChange?: (denominator: number) => void;
}

export const PercentageExpanded = ({ denominator, onDenominatorChange }: PercentageExpandedProps) => {
  // Build items for all denominators 1–200 for swipe navigation
  const allDenominators = Array.from({ length: 200 }, (_, i) => i + 1);

  const items = allDenominators.map((d) => {
    const rows = Array.from({ length: 10 }, (_, i) => buildRow(i + 1, d));
    return (
      <div key={d}>
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
  });

  return (
    <SwipeContainer
      items={items}
      currentIndex={denominator - 1}
      onIndexChange={(i) => onDenominatorChange?.(i + 1)}
    />
  );
};

export default PercentageLearning;
