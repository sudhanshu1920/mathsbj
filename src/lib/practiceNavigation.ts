export type PracticePhase = 'setup' | 'active' | 'finished';

export const isUnsavedPracticePhase = (phase: PracticePhase): boolean => phase === 'active';

export const getPracticeNavDepth = (phase: PracticePhase): string => {
  if (phase === 'active') return 'practice-active';
  if (phase === 'finished') return 'practice-result';
  return 'practice-setup';
};

/** The navigation bar is omitted for the duration of a quiz and its result screen. */
export const isPracticeSessionInProgress = (phase: PracticePhase): boolean =>
  phase === 'active' || phase === 'finished';
