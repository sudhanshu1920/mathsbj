import { m as motion } from 'framer-motion';
import { MOTION } from '@/lib/motion';
import {
  TRIG_ANGLES,
  TRIG_FUNCTIONS,
  TRIG_RADIANS,
  NOT_DEFINED,
  trigValue,
} from '@/lib/trigData';
import './trigonometry-table.css';

/**
 * Textbook-style trigonometric ratios table.
 * Each standard angle is a row; exact ratios and radians are columns.
 * The table scrolls horizontally on narrow screens and keeps angle labels visible.
 */
const TrigonometryLearning = () => {
  const cellBase =
    'trig-table-cell border border-border px-3 py-2.5 text-center whitespace-nowrap text-sm';

  return (
    <motion.div
      initial={{ opacity: 0, y: MOTION.distance.small }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden"
    >
      <div className="border-b border-border px-4 py-3">
        <p className="font-semibold text-foreground">Standard angles (0°–360°)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Exact trigonometric ratios in degrees and radians.
        </p>
      </div>

      <div
        className="overflow-x-auto"
        role="region"
        aria-label="Table of standard trigonometric ratios"
        tabIndex={0}
      >
        <table className="trig-table-grid w-full border-separate border-spacing-0 min-w-[780px]">
          <caption className="sr-only">
            Exact values of sine, cosine, tangent, cotangent, secant and cosecant for standard
            angles from zero to 360 degrees.
          </caption>
          <thead>
            <tr className="bg-primary/15">
              <th
                scope="col"
                className={`${cellBase} text-primary text-left trig-table-sticky trig-table-sticky-header trig-table-sticky-corner`}
              >
                Angle (°)
              </th>
              <th scope="col" className={`${cellBase} text-primary`}>
                Angle (rad)
              </th>
              {TRIG_FUNCTIONS.map((fn) => (
                <th key={fn} scope="col" className={`${cellBase} text-primary font-bold`}>
                  {fn} θ
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRIG_ANGLES.map((angle) => (
              <tr key={angle}>
                <th
                  scope="row"
                  className={`${cellBase} text-left trig-table-sticky font-display font-bold text-foreground`}
                >
                  {angle}°
                </th>
                <td className={`${cellBase} text-foreground`}>{TRIG_RADIANS[angle]}</td>
                {TRIG_FUNCTIONS.map((fn) => {
                  const value = trigValue(fn, angle);
                  const isUndefined = value === NOT_DEFINED;
                  return (
                    <td
                      key={fn}
                      className={`${cellBase} font-semibold ${
                        isUndefined ? 'text-destructive text-xs' : 'text-foreground'
                      }`}
                      aria-label={isUndefined ? `${fn} at ${angle} degrees: not defined` : undefined}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <span className="font-semibold">Not Defined</span> means the ratio has no finite value at
        that angle; it does not equal zero.
      </p>
    </motion.div>
  );
};

export default TrigonometryLearning;
