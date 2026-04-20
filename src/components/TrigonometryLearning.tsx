import { motion } from 'framer-motion';
import { TRIG_ANGLES, TRIG_FUNCTIONS, trigValue } from '@/lib/trigData';

/**
 * Table of standard trigonometric angles (0°, 30°, 45°, 60°, 90°)
 * for sin, cos, tan, cosec, sec, cot.
 */
const TrigonometryLearning = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary/10">
              <th className="px-3 py-3 text-left font-display font-bold text-primary text-xs uppercase tracking-wider">
                θ
              </th>
              {TRIG_ANGLES.map((a) => (
                <th
                  key={a}
                  className="px-2 py-3 text-center font-display font-bold text-primary text-xs"
                >
                  {a}°
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
                transition={{ delay: rowIdx * 0.05 }}
                className="border-t border-border"
              >
                <td className="px-3 py-3 font-display font-bold text-foreground">
                  {fn} θ
                </td>
                {TRIG_ANGLES.map((a) => {
                  const v = trigValue(fn, a);
                  const isInf = v === '∞';
                  return (
                    <td
                      key={a}
                      className={`px-2 py-3 text-center font-semibold ${
                        isInf ? 'text-destructive' : 'text-foreground'
                      }`}
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
