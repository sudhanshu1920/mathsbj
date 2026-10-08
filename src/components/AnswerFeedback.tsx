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
      transition={{ duration: reducedMotion ? 0.1 : isCorrect ? 0.2 : 0.22, ease: 'easeOut' }}
      className={[
        'glass-panel pointer-events-none relative w-fit max-w-[calc(100vw-2rem)] overflow-hidden rounded-full',
        'px-3 py-1.5 backdrop-blur-md',
        'shadow-[0_10px_28px_-20px_hsl(var(--foreground)/0.65)]',
        isCorrect
          ? 'text-success shadow-[0_10px_28px_-20px_hsl(var(--success)/0.55)]'
          : 'text-destructive shadow-[0_10px_28px_-20px_hsl(var(--destructive)/0.5)]',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none absolute inset-0 rounded-full',
          isCorrect ? 'bg-success/[0.08]' : 'bg-destructive/[0.08]',
        ].join(' ')}
      />

      <span
        aria-hidden="true"
        className={[
          'pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.16] to-transparent',
          isCorrect ? 'opacity-100' : 'opacity-90',
        ].join(' ')}
      />

      <motion.span
        aria-hidden="true"
        initial={reducedMotion ? { opacity: 0.12 } : { opacity: 0 }}
        animate={reducedMotion ? { opacity: 0.12 } : { opacity: [0, 0.45, 0] }}
        transition={{ duration: 0.55, delay: 0.04, ease: 'easeInOut' }}
        className={[
          'pointer-events-none absolute -top-1/2 h-[220%] w-1/5 rotate-[18deg]',
          'bg-gradient-to-r from-transparent via-foreground/[0.10] to-transparent',
        ].join(' ')}
      />

      <span className="relative flex items-center justify-center gap-1.5 whitespace-nowrap font-display">
        {isCorrect ? (
          <>
            <Check size={14} strokeWidth={2.8} aria-hidden="true" />
            <span className="text-xs font-semibold tracking-[0.01em] text-foreground">Correct</span>
          </>
        ) : (
          <>
            <X size={14} strokeWidth={2.8} aria-hidden="true" />
            <span className="text-xs font-semibold tracking-[0.01em] text-foreground">Wrong</span>
            {correctAnswer !== undefined && (
              <>
                <span aria-hidden="true" className="h-3.5 w-px bg-foreground/15" />
                <span className="text-[11px] font-medium text-muted-foreground">Correct Answer:</span>
                <span className="text-sm font-bold text-foreground">{correctAnswer}</span>
              </>
            )}
          </>
        )}
      </span>
    </motion.div>
  );
};

export default AnswerFeedback;
