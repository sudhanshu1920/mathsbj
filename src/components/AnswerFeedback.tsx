import type { ReactNode } from 'react';
import { m as motion, useReducedMotion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { MOTION } from '@/lib/motion';

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
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5, scale: 0.98 }}
      animate={
        reducedMotion
          ? { opacity: 1 }
          : isCorrect
            ? { opacity: 1, y: 0, scale: 1 }
            : { opacity: 1, y: [0, 1.2, -0.8, 0], scale: 1 }
      }
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.99 }}
      transition={{
        duration: reducedMotion ? MOTION.duration.instant : MOTION.duration.fast,
        ease: 'easeOut',
      }}
      className={[
        'glass-panel relative mx-auto w-fit max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.05rem]',
        'px-3.5 py-1 backdrop-blur-md',
        isCorrect
          ? 'text-success shadow-[0_10px_28px_-20px_hsl(var(--success)/0.55)]'
          : 'text-destructive shadow-[0_10px_28px_-20px_hsl(var(--destructive)/0.5)]',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none absolute inset-0 rounded-[1.05rem]',
          isCorrect ? 'bg-success/[0.075]' : 'bg-destructive/[0.075]',
        ].join(' ')}
      />

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.16] to-transparent"
      />

      <motion.span
        aria-hidden="true"
        initial={reducedMotion ? { opacity: 0.08 } : { x: '-90%', opacity: 0 }}
        animate={reducedMotion ? { opacity: 0.08 } : { x: '190%', opacity: [0, 0.35, 0] }}
        transition={{ duration: MOTION.duration.feedbackShine, delay: MOTION.stagger.micro, ease: MOTION.ease.easeInOut }}
        className="pointer-events-none absolute -top-1/2 h-[220%] w-1/5 rotate-[18deg] bg-gradient-to-r from-transparent via-foreground/[0.09] to-transparent"
      />

      {isCorrect ? (
        <div className="relative flex items-center justify-center gap-2 whitespace-nowrap font-display">
          <Check size={16} strokeWidth={2.8} aria-hidden="true" />
          <span className="text-[13px] font-semibold tracking-[0.01em] text-foreground">Correct</span>
        </div>
      ) : (
        <div className="relative flex flex-col items-center justify-center gap-0.5 text-center font-display">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <X size={16} strokeWidth={2.8} aria-hidden="true" />
            <span className="text-[13px] font-semibold tracking-[0.01em] text-foreground">Wrong</span>
          </div>
          {correctAnswer !== undefined && (
            <div className="flex items-baseline justify-center gap-1 whitespace-nowrap leading-5">
              <span className="text-[11px] font-medium text-muted-foreground">Correct Answer:</span>
              <span className="text-[15px] font-extrabold leading-4 tracking-[0.01em] text-primary">{correctAnswer}</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AnswerFeedback;
