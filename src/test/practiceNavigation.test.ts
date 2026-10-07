import { describe, expect, it } from 'vitest';
import { getPracticeNavDepth, isUnsavedPracticePhase, type PracticePhase } from '@/lib/practiceNavigation';

describe('Practice navigation lifecycle', () => {
  it('only treats the active phase as having unsaved progress', () => {
    const phases: PracticePhase[] = ['setup', 'active', 'finished'];

    expect(phases.filter(isUnsavedPracticePhase)).toEqual(['active']);
    expect(isUnsavedPracticePhase('setup')).toBe(false);
    expect(isUnsavedPracticePhase('finished')).toBe(false);
  });

  it('keeps setup, active, and result navigation states distinct', () => {
    expect(getPracticeNavDepth('setup')).toBe('practice-setup');
    expect(getPracticeNavDepth('active')).toBe('practice-active');
    expect(getPracticeNavDepth('finished')).toBe('practice-result');
  });

  it('does not classify the Learning -> Practice transition as active', () => {
    expect(isUnsavedPracticePhase('setup')).toBe(false);
    expect(getPracticeNavDepth('setup')).not.toBe('practice-active');
  });
});

// [BUILD_APK] release build requested after navigation exit-guard root-cause fix.
