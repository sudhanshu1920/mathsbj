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

  const surfaceTint = isCorrect ? 'bg-success/[0.075]' : 'bg-destructive/[0.075]';
  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      initial={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 8, scale: 0.985 }
      }
      animate={
        reducedMotion
          ? { opacity: 1 }
          : isCorrect
            ? { opacity: 1, y: 0, scale: 1 }
            : { opacity: 1, y: 0, scale: 1, x: [0, -2.5, 2.2, -1.3, 0] }
      }
      exit={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, y: -5, scale: 0.99 }
      }
      transition={{
        duration: reducedMotion ? 0.12 : isCorrect ? 0.24 : 0.34,
        ease: 'easeOut',
      }}
      className="glass-panel relative mx-auto w-full max-w-sm overflow-hidden rounded-[1.35rem] px-4 py-3 will-change-transform"
    >
      <div
        aria-hidden="true"
        className={[
          'pointer-events-none absolute inset-0 rounded-[1.35rem] opacity-100',
          surfaceTint,
        ].join(' ')}
      />

      <motion.div
        aria-hidden="true"
        initial={reducedMotion ? { opacity: 0.2, scale: 0.94 } : { opacity: 0, scale: 0.86 }}
        animate={
          reducedMotion
            ? { opacity: 0.2, scale: 0.94 }
            : { opacity: [0, 0.7, 0], scale: [0.86, 1.06, 1.12] }
        }
        transition={{ duration: reducedMotion ? 0.1 : 0.7, ease: 'easeOut' }}
        className={[
          'pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl',
          isCorrect ? 'bg-success/25' : 'bg-destructive/22',
        ].join(' ')}
      />

      <motion.span
        aria-hidden="true"
        initial={reducedMotion ? { opacity: 0 } : { x: '-70%', opacity: 0 }}
        animate={reducedMotion ? { opacity: 0 } : { x: '210%', opacity: [0, 0.55, 0] }}
        transition={{ duration: 0.9, delay: 0.08, ease: 'easeInOut' }}
        className="pointer-events-none absolute -top-1/2 h-[220%] w-1/3 rotate-[16deg] bg-gradient-to-r from-transparent via-foreground/[0.10] to-transparent"
      />

      <div
        aria-hidden="true"
        className={[
          'pointer-events-none absolute inset-px rounded-[1.28rem] border border-foreground/[0.08]',
          isCorrect ? 'shadow-[inset_0_1px_0_hsl(var(--success)/0.22)]' : 'shadow-[inset_0_1px_0_hsl(var(--destructive)/0.20)]',
        ].join(' ')}
      />

      <div className="relative flex items-center gap-3">
        <motion.div
          aria-hidden="true"
          initial={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.72 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reducedMotion ? 0.1 : 0.22, delay: reducedMotion ? 0 : 0.04, ease: 'backOut' }}
          className={[
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background/[0.18]',
            'backdrop-blur-sm',
            isCorrect
              ? 'border-success/30 text-success shadow-[0_0_24px_hsl(var(--success)/0.20)]'
              : 'border-destructive/30 text-destructive shadow-[0_0_24px_hsl(var(--destructive)/0.18)]',
          ].join(' ')}
        >
          {isCorrect ? <Check size={19} strokeWidth={2.7} /> : <X size={19} strokeWidth={2.7} />}
        </motion.div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-display text-sm font-extrabold tracking-[0.02em] text-foreground">
              {isCorrect ? 'Correct' : 'Incorrect'}
            </p>
            <span
              aria-hidden="true"
              className={[
                'h-1.5 w-1.5 rounded-full opacity-70',
                isCorrect ? 'bg-success' : 'bg-destructive',
              ].join(' ')}
            />
          </div>

          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {isCorrect ? 'Great work. Keep going.' : 'Not quite. Try again.'}
          </p>

          {!isCorrect && correctAnswer !== undefined && (
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.10em] text-muted-foreground">
                Correct answer
              </span>
              <span className="font-display text-sm font-bold text-foreground">{correctAnswer}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AnswerFeedback;
