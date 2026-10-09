import { describe, expect, it } from 'vitest';
import {
  getPracticeNavDepth,
  getPracticeReturnDepth,
  isPracticeSessionInProgress,
  isUnsavedPracticePhase,
  LEARNING_PRACTICE_SELECTOR_DEPTH,
  type PracticePhase,
} from '@/lib/practiceNavigation';

describe('Practice navigation lifecycle', () => {
  it('protects the startup handoff and active quiz as in-progress navigation', () => {
    const phases: PracticePhase[] = ['setup', 'starting', 'active', 'finished'];
    expect(phases.filter(isUnsavedPracticePhase)).toEqual(['starting', 'active']);
    expect(isUnsavedPracticePhase('setup')).toBe(false);
    expect(isUnsavedPracticePhase('starting')).toBe(true);
    expect(isUnsavedPracticePhase('finished')).toBe(false);
  });

  it('hides the Floating Bar only after a quiz starts, including its result screen', () => {
    expect(isPracticeSessionInProgress('setup')).toBe(false);
    expect(isPracticeSessionInProgress('starting')).toBe(true);
    expect(isPracticeSessionInProgress('active')).toBe(true);
    expect(isPracticeSessionInProgress('finished')).toBe(true);
  });

  it('keeps setup, active, and result navigation states distinct', () => {
    expect(getPracticeNavDepth('setup')).toBe('practice-setup');
    expect(getPracticeNavDepth('starting')).toBe('practice-active');
    expect(getPracticeNavDepth('active')).toBe('practice-active');
    expect(getPracticeNavDepth('finished')).toBe('practice-result');
  });

  it('returns a Learning-origin quiz to the Practice selector before the topic parent', () => {
    expect(getPracticeReturnDepth(true, true, 'learn-tables-4'))
      .toBe(LEARNING_PRACTICE_SELECTOR_DEPTH);
  });

  it('returns directly to the exact originating topic when no selector state exists', () => {
    expect(getPracticeReturnDepth(true, false, 'learn-tables-4')).toBe('learn-tables-4');
  });

  it('keeps global Practice exits in the Practice setup section', () => {
    expect(getPracticeReturnDepth(false, false, 'learn-tables-4')).toBe('practice-setup');
  });

  it('does not classify the Learning → Practice transition as active', () => {
    expect(isUnsavedPracticePhase('setup')).toBe(false);
    expect(getPracticeNavDepth('setup')).not.toBe('practice-active');
  });
});

// [BUILD_APK] universal Learning topic practice-return stack.
