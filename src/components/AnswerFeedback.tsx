import type { ReactNode } from 'react';
import { m as motion, useReducedMotion } from 'framer-motion';
import { Check, X } from 'lucide-react';

interface AnswerFeedbackProps {
  status: 'correct' | 'wrong';
  correctAnswer?: ReactNode;
}

const AnswerFeedback = ({ status, correctAnswer }: AnswerFeedbackProps) => {
  const reducedMotion = useReducedMotion() ?? false;
  const isCorrect = status === 'correct';

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
      animate={
        reducedMotion
          ? { opacity: 1 }
          : isCorrect
            ? { opacity: 1, y: 0 }
            : { opacity: 1, y: [0, 1.5, -1.2, 0] }
      }
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
      transition={{
        duration: reducedMotion ? 0.1 : isCorrect ? 0.2 : 0.22,
        ease: 'easeOut',
      }}
      className={[
        'glass-panel pointer-events-none relative w-fit max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1rem]',
        'px-3 py-1.5 backdrop-blur-md',
        isCorrect
          ? 'text-success shadow-[0_10px_26px_-20px_hsl(var(--success)/0.55)]'
          : 'text-destructive shadow-[0_10px_26px_-20px_hsl(var(--destructive)/0.5)]',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none absolute inset-0 rounded-[1rem]',
          isCorrect ? 'bg-success/[0.07]' : 'bg-destructive/[0.07]',
        ].join(' ')}
      />

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.16] to-transparent"
      />

      <motion.span
        aria-hidden="true"
        initial={reducedMotion ? { opacity: 0.08 } : { x: '-90%', opacity: 0 }}
        animate={reducedMotion ? { opacity: 0.08 } : { x: '190%', opacity: [0, 0.35, 0] }}
        transition={{ duration: 0.55, delay: 0.03, ease: 'easeInOut' }}
        className="pointer-events-none absolute -top-1/2 h-[220%] w-1/5 rotate-[18deg] bg-gradient-to-r from-transparent via-foreground/[0.09] to-transparent"
      />

      {isCorrect ? (
        <div className="relative flex items-center justify-center gap-1.5 whitespace-nowrap font-display">
          <Check size={14} strokeWidth={2.8} aria-hidden="true" />
          <span className="text-xs font-semibold tracking-[0.01em] text-foreground">Correct</span>
        </div>
      ) : (
        <div className="relative flex flex-col items-center justify-center gap-0.5 whitespace-nowrap text-center font-display">
          <div className="flex items-center gap-1.5">
            <X size={14} strokeWidth={2.8} aria-hidden="true" />
            <span className="text-xs font-semibold tracking-[0.01em] text-foreground">Wrong</span>
          </div>
          {correctAnswer !== undefined && (
            <div className="text-sm font-bold leading-5 text-foreground">
              <span className="text-[11px] font-medium text-muted-foreground">Correct Answer: </span>
              {correctAnswer}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AnswerFeedback;
