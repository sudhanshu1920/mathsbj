import { beforeEach, describe, expect, it } from 'vitest';
import {
  getLearningQuestionOrderPreference,
  setLearningQuestionOrderPreference,
} from '@/lib/practiceNavigation';

describe('Learning question-order preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to Mix to preserve existing Learning practice behavior', () => {
    expect(getLearningQuestionOrderPreference('tables')).toBe('mix');
  });

  it('persists Sequence and Mix independently for each topic', () => {
    setLearningQuestionOrderPreference('tables', 'sequence');
    setLearningQuestionOrderPreference('squares', 'mix');

    expect(getLearningQuestionOrderPreference('tables')).toBe('sequence');
    expect(getLearningQuestionOrderPreference('squares')).toBe('mix');
    expect(getLearningQuestionOrderPreference('powers')).toBe('mix');
  });

  it('ignores malformed stored values and invalid topic identifiers', () => {
    window.localStorage.setItem('math-master.learning-question-order.v1', JSON.stringify({
      tables: 'invalid',
      squares: 'sequence',
    }));

    expect(getLearningQuestionOrderPreference('tables')).toBe('mix');
    expect(getLearningQuestionOrderPreference('squares')).toBe('sequence');
    setLearningQuestionOrderPreference('__proto__', 'sequence');
    expect(getLearningQuestionOrderPreference('__proto__')).toBe('mix');
  });
});
