import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import StackedFraction from './StackedFraction';

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function getMultiples(denominator: number, maxMultiplier = 10) {
  const rows = [];
  for (let n = 1; n <= maxMultiplier; n++) {
    const val = (n / denominator) * 100;
    const decimal = val % 1 === 0 ? `${val}%` : `${val.toFixed(2)}%`;

    const whole = Math.floor(val);
    const remNumerator = Math.round((val - whole) * denominator);
    let mixed: { whole: number; numerator: number; denominator: number } | null = null;
    if (remNumerator > 0) {
      const g = gcd(remNumerator, denominator);
      mixed = { whole, numerator: remNumerator / g, denominator: denominator / g };
    }

    rows.push({ numerator: n, denominator, decimal, mixed, wholePercent: remNumerator === 0 ? `${whole}%` : null });
  }
  return rows;
}

const BASE_FRACTIONS = Array.from({ length: 9 }, (_, i) => i + 2); // 2 to 10

const PercentageLearning = () => {
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggle = (d: number) => setExpanded(expanded === d ? null : d);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs font-semibold text-muted-foreground">
        <div className="text-center">Fraction</div>
        <div className="text-center">Decimal %</div>
        <div className="text-center">Mixed %</div>
      </div>

      {BASE_FRACTIONS.map((d) => {
        const base = getMultiples(d, 1)[0];
        const isExpanded = expanded === d;

        return (
          <div key={d}>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => toggle(d)}
              className="w-full bg-card border border-border rounded-xl px-3 py-3 grid grid-cols-3 gap-2 text-center text-sm items-center"
            >
              <span className="text-foreground font-medium">1/{d}</span>
              <span className="text-primary font-bold">{base.decimal}</span>
              <span className="flex justify-center items-center gap-1">
                {base.mixed ? (
                  <StackedFraction
                    whole={base.mixed.whole}
                    numerator={base.mixed.numerator}
                    denominator={base.mixed.denominator}
                  />
                ) : (
                  <span className="text-primary font-bold">{base.wholePercent}</span>
                )}
                {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </span>
            </motion.button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1 pt-1 pb-2">
                    {getMultiples(d, 10).map((row, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="bg-secondary/50 rounded-lg px-3 py-2 grid grid-cols-3 gap-2 text-center text-sm items-center"
                      >
                        <span className="text-foreground font-medium">{row.numerator}/{row.denominator}</span>
                        <span className="text-primary font-bold">{row.decimal}</span>
                        <span className="flex justify-center">
                          {row.mixed ? (
                            <StackedFraction
                              whole={row.mixed.whole}
                              numerator={row.mixed.numerator}
                              denominator={row.mixed.denominator}
                            />
                          ) : (
                            <span className="text-primary font-bold">{row.wholePercent}</span>
                          )}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

export default PercentageLearning;
