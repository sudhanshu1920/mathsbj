import { m as motion } from 'framer-motion';
import { MOTION } from '@/lib/motion';
import {
  TRIG_ANGLES,
  TRIG_FUNCTIONS,
  TRIG_RADIANS,
  NOT_DEFINED,
  trigValue,
} from '@/lib/trigData';
import TrigMathValue from '@/components/TrigMathValue';
import './trigonometry-table.css';

/**
 * Reference table with one row per function and one column per standard angle.
 * The first column stays pinned during horizontal scrolling on mobile.
 */
const TrigonometryLearning = () => {
  const cellBase =
    'trig-table-cell border border-border px-2 py-2 text-center whitespace-nowrap text-sm';

  return (
    <motion.div
      initial={{ opacity: 0, y: MOTION.distance.small }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden"
    >
      <div className="border-b border-border px-4 py-3">
        <p className="font-semibold text-foreground">Standard angles (0°–360°)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Angles run across the columns; trigonometric functions run down the rows.
        </p>
      </div>

      <div
        className="trig-table-scroll overflow-x-auto"
        role="region"
        aria-label="Table of standard trigonometric ratios"
        tabIndex={0}
      >
        <table className="trig-table-grid w-full border-separate border-spacing-0 min-w-[1320px]">
          <caption className="sr-only">
            Trigonometric ratios for standard angles from zero to 360 degrees and their radians.
            Each function is a row and each angle is a column.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                rowSpan={2}
                className={`${cellBase} text-primary text-left font-bold trig-table-sticky trig-table-sticky-header trig-table-sticky-corner min-w-[88px]`}
              >
                Function
              </th>
              {TRIG_ANGLES.map((angle) => (
                <th
                  key={angle}
                  scope="col"
                  className={`${cellBase} text-primary font-bold trig-table-angle-header min-w-[68px]`}
                  aria-label={`${angle} degrees`}
                >
                  {angle}°
                </th>
              ))}
            </tr>
            <tr className="trig-table-radian-row">
              {TRIG_ANGLES.map((angle) => (
                <th
                  key={angle}
                  scope="col"
                  className={`${cellBase} text-muted-foreground font-medium trig-table-radian-header min-w-[68px]`}
                  aria-label={`${angle} degrees in radians: ${TRIG_RADIANS[angle]}`}
                >
                  <TrigMathValue value={TRIG_RADIANS[angle]} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRIG_FUNCTIONS.map((fn) => (
              <tr key={fn}>
                <th
                  scope="row"
                  className={`${cellBase} text-left font-display font-bold text-foreground trig-table-sticky trig-table-function-label min-w-[88px]`}
                >
                  {fn} θ
                </th>
                {TRIG_ANGLES.map((angle) => {
                  const value = trigValue(fn, angle);
                  const isUndefined = value === NOT_DEFINED;
                  return (
                    <td
                      key={angle}
                      className={`${cellBase} min-w-[68px] font-semibold ${isUndefined ? 'text-destructive text-xs' : 'text-foreground'}`}
                      aria-label={`${fn} at ${angle} degrees: ${isUndefined ? 'Undefined' : value}`}
                    >
                      {isUndefined ? (
                        <span className="font-medium">Undefined</span>
                      ) : (
                        <TrigMathValue value={value} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <span className="font-semibold">Undefined</span> means the ratio has no finite value at
        that angle; it does not equal zero.
      </p>
    </motion.div>
  );
};

export default TrigonometryLearning;
