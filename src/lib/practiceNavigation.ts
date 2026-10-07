export type PracticePhase = 'setup' | 'active' | 'finished';

export const isUnsavedPracticePhase = (phase: PracticePhase): boolean => phase === 'active';

export const getPracticeNavDepth = (phase: PracticePhase): string => {
  if (phase === 'active') return 'practice-active';
  if (phase === 'finished') return 'practice-result';
  return 'practice-setup';
};
