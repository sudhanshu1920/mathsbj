import type { TrigFunction } from '@/lib/trigData';
import type { PeriodicMassMode, PeriodicQuestionType } from '@/lib/periodicTable';

export type PracticePhase = 'setup' | 'starting' | 'active' | 'finished';

export interface PracticeLaunchContext {
  topic: string;
  context?: { from?: number; to?: number; number?: number };
  mode: 'mcq' | 'input';
  extras?: {
    timerEnabled?: boolean;
    timerSeconds?: number;
    infinite?: boolean;
    trigFunctions?: TrigFunction[];
    trigProMode?: boolean;
    count?: number;
    periodicQuestionTypes?: PeriodicQuestionType[];
    periodicMassMode?: PeriodicMassMode;
  };
}

export const LEARNING_PRACTICE_SELECTOR_DEPTH = 'learn-practice-selector';

// Treat the handoff to a Learning-origin quiz as an in-progress navigation so
// Back cannot expose the setup screen before the session is initialized.
export const isUnsavedPracticePhase = (phase: PracticePhase): boolean =>
  phase === 'starting' || phase === 'active';

export const getPracticeNavDepth = (phase: PracticePhase): string => {
  // Startup and active phases intentionally share one history depth, avoiding
  // a transient extra navigation entry when the question session mounts.
  if (phase === 'starting' || phase === 'active') return 'practice-active';
  if (phase === 'finished') return 'practice-result';
  return 'practice-setup';
};

export const getPracticeReturnDepth = (
  fromLearning: boolean,
  restorePracticeSelector: boolean,
  learningDepth: string,
): string => {
  if (!fromLearning) return 'practice-setup';
  return restorePracticeSelector ? LEARNING_PRACTICE_SELECTOR_DEPTH : learningDepth;
};

export const isPracticeSessionInProgress = (phase: PracticePhase): boolean =>
  phase === 'starting' || phase === 'active' || phase === 'finished';
