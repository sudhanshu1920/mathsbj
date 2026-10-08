import type { ReactNode } from 'react';
import { m as motion, useReducedMotion } from 'framer-motion';
import { Check, X } from 'lucide-react';

interface AnswerFeedbackProps {
  status: 'correct' | 'wrong';
  correctAnswer?: ReactNode;
  milestone?: boolean;
}

const AnswerFeedback = ({ status, correctAnswer, milestone = false }: AnswerFeedbackProps) => {
  const reducedMotion = useReducedMotion();
  const isCorrect = status === 'correct';

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: reducedMotion ? 0.12 : 0.2, ease: 'easeOut' }}
      className={[
        'relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border px-4 py-3 backdrop-blur-md',
        'shadow-[0_14px_36px_-24px_hsl(var(--foreground)/0.45)]',
        isCorrect
          ? 'border-success/35 bg-success/10 text-success'
          : 'border-destructive/35 bg-destructive/10 text-destructive',
      ].join(' ')}
    >
      <motion.div
        aria-hidden="true"
        initial={reducedMotion ? { opacity: 0 } : { scale: 0.75, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: reducedMotion ? 0.12 : 0.24, ease: 'backOut' }}
        className={[
          'mx-auto flex h-9 w-9 items-center justify-center rounded-full border',
          isCorrect
            ? 'border-success/30 bg-success/15 shadow-[0_0_20px_hsl(var(--success)/0.28)]'
            : 'border-destructive/30 bg-destructive/15 shadow-[0_0_20px_hsl(var(--destructive)/0.24)]',
        ].join(' ')}
      >
        {isCorrect ? <Check size={18} strokeWidth={2.75} /> : <X size={18} strokeWidth={2.75} />}
      </motion.div>

      <div className="mt-2 text-center">
        <p className="font-display text-sm font-extrabold tracking-wide">
          {isCorrect ? 'Correct' : 'Incorrect'}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isCorrect
            ? (milestone ? 'Excellent streak!' : 'Great work!')
            : 'Review the correct answer and keep going.'}
        </p>
        {!isCorrect && correctAnswer !== undefined && (
          <p className="mt-1.5 text-sm font-semibold text-foreground">
            Correct answer: <span className="font-display font-bold text-primary">{correctAnswer}</span>
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default AnswerFeedback;
