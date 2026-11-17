import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProgress, resetProgress, saveResult } from '@/lib/progress';
import { recordAnswer } from '@/lib/analytics';

beforeEach(() => {
  localStorage.clear();
});

describe('progress persistence hot path', () => {
  it('reuses normalized state while the persisted value is unchanged', () => {
    localStorage.setItem('math-app-progress', JSON.stringify({
      totalAttempts: 3, correct: 2, wrong: 1, streak: 0, bestStreak: 2,
      byTopic: { tables: { attempts: 3, correct: 2 } },
    }));
    const parse = vi.spyOn(JSON, 'parse');
    const first = getProgress();
    const second = getProgress();

    expect(parse).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it('invalidates the normalized cache after an external storage update', () => {
    getProgress();
    localStorage.setItem('math-app-progress', JSON.stringify({
      totalAttempts: 9, correct: 7, wrong: 2, streak: 1, bestStreak: 4,
      byTopic: {},
    }));

    expect(getProgress().totalAttempts).toBe(9);
  });

  it('returns defensive topic snapshots and persists consecutive answers', () => {
    const first = getProgress();
    first.byTopic.tables = { attempts: 500, correct: 500 };

    saveResult('tables', true);
    saveResult('tables', false);
    const saved = getProgress();

    expect(saved.totalAttempts).toBe(2);
    expect(saved.correct).toBe(1);
    expect(saved.wrong).toBe(1);
    expect(saved.streak).toBe(0);
    expect(saved.byTopic.tables).toEqual({ attempts: 2, correct: 1 });
  });

  it('can batch its refresh notification with the paired analytics write', () => {
    const onUpdate = vi.fn();
    window.addEventListener('analytics-updated', onUpdate);
    try {
      saveResult('tables', true, { notify: false });
      expect(onUpdate).not.toHaveBeenCalled();
      recordAnswer(true);
      expect(onUpdate).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('analytics-updated', onUpdate);
    }
  });

  it('keeps reset state visible after clearing the cache', () => {
    saveResult('tables', true);
    resetProgress();
    expect(getProgress().totalAttempts).toBe(0);
    expect(getProgress().byTopic).toEqual({});
  });
});
