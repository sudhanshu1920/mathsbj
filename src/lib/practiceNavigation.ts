import type { TrigFunction } from '@/lib/trigData';
import type { PeriodicMassMode, PeriodicQuestionType } from '@/lib/periodicTable';

export type PracticePhase = 'setup' | 'starting' | 'active' | 'finished';

export type LearningQuestionOrder = 'sequence' | 'mix';

const LEARNING_QUESTION_ORDER_STORAGE_KEY = 'math-master.learning-question-order.v1';
const isValidLearningOrderTopic = (topic: string): boolean => /^[a-z0-9-]{1,64}$/.test(topic);

export const getLearningQuestionOrderPreference = (topic: string): LearningQuestionOrder => {
  if (typeof window === 'undefined' || !isValidLearningOrderTopic(topic)) return 'mix';

  try {
    const saved = JSON.parse(window.localStorage.getItem(LEARNING_QUESTION_ORDER_STORAGE_KEY) ?? '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return 'mix';
    const value = (saved as Record<string, unknown>)[topic];
    return value === 'sequence' || value === 'mix' ? value : 'mix';
  } catch {
    return 'mix';
  }
};

export const setLearningQuestionOrderPreference = (
  topic: string,
  order: LearningQuestionOrder,
): void => {
  if (
    typeof window === 'undefined' ||
    !isValidLearningOrderTopic(topic) ||
    (order !== 'sequence' && order !== 'mix')
  ) return;

  try {
    const saved = JSON.parse(window.localStorage.getItem(LEARNING_QUESTION_ORDER_STORAGE_KEY) ?? '{}');
    const preferences: Record<string, LearningQuestionOrder> = {};
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
        if (isValidLearningOrderTopic(key) && (value === 'sequence' || value === 'mix')) {
          preferences[key] = value;
        }
      }
    }
    preferences[topic] = order;
    window.localStorage.setItem(LEARNING_QUESTION_ORDER_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // A blocked or unavailable storage area must not prevent practice from starting.
  }
};

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
    tablesProMode?: boolean;
    count?: number;
    periodicQuestionTypes?: PeriodicQuestionType[];
    periodicMassMode?: PeriodicMassMode;
    questionOrder?: LearningQuestionOrder;
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
