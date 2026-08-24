import { useState } from 'react';
import { m as motion } from 'framer-motion';
import { TRIG_ANGLES, TRIG_FUNCTIONS, TRIG_RADIANS, NOT_DEFINED, trigValue } from '@/lib/trigData';

/**
 * Full textbook-style table of standard trigonometric angles.
 * Rows: Angle (°), Angle (rad), sin, cos, tan, cot, sec, cosec.
 * Horizontally scrollable on small screens.
 */
const TrigonometryLearning = () => {
  const [active, setActive] = useState<string | null>(null);

  const cellBase =
    'border border-border px-3 py-2.5 text-center font-semibold whitespace-nowrap text-sm';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[640px]">
          {/* Header — Degrees */}
          <thead>
            <tr className="bg-primary/15">
              <th className={`${cellBase} text-primary text-left sticky left-0 bg-primary/15 z-10`}>
                Angle (°)
              </th>
              {TRIG_ANGLES.map((a) => (
                <th key={a} className={`${cellBase} text-primary`}>
                  {a}°
                </th>
              ))}
            </tr>
            {/* Radians row */}
            <tr className="bg-primary/5">
              <th className={`${cellBase} text-primary text-left sticky left-0 bg-primary/5 z-10`}>
                Angle (rad)
              </th>
              {TRIG_ANGLES.map((a) => (
                <th key={a} className={`${cellBase} text-foreground font-medium`}>
                  {TRIG_RADIANS[a]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRIG_FUNCTIONS.map((fn, rowIdx) => (
              <motion.tr
                key={fn}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: rowIdx * 0.04 }}
              >
                <td
                  className={`${cellBase} text-left bg-card sticky left-0 z-10 font-display font-bold text-foreground`}
                >
                  {fn} θ
                </td>
                {TRIG_ANGLES.map((a) => {
                  const v = trigValue(fn, a);
                  const isND = v === NOT_DEFINED;
                  const key = `${fn}-${a}`;
                  const isActive = active === key;
                  return (
                    <td
                      key={a}
                      onClick={() => setActive(isActive ? null : key)}
                      className={`${cellBase} cursor-pointer transition-colors ${
                        isND ? 'text-destructive text-xs' : 'text-foreground'
                      } ${isActive ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                    >
                      {v}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default TrigonometryLearning;
