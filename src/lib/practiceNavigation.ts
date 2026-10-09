import type { TrigFunction } from '@/lib/trigData';

export type PracticePhase = 'setup' | 'active' | 'finished';

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
  };
}

export const LEARNING_PRACTICE_SELECTOR_DEPTH = 'learn-practice-selector';

export const isUnsavedPracticePhase = (phase: PracticePhase): boolean => phase === 'active';

export const getPracticeNavDepth = (phase: PracticePhase): string => {
  if (phase === 'active') return 'practice-active';
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
  phase === 'active' || phase === 'finished';
