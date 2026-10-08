import { describe, expect, it, beforeEach } from 'vitest';
import { evaluateStreak, type StreakState } from '@/lib/streak';

const baseState = (lastEvalDate: string): StreakState => ({
  enabled: true,
  targetMinutes: 5,
  current: 5,
  best: 5,
  freezeUsedMonth: '2026-09',
  freezesUsed: 0,
  days: {},
  lastEvalDate,
});

describe('streak calendar evaluation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses September freezes for a missed September day when evaluated in October', () => {
    const state = baseState('2026-09-29');

    const result = evaluateStreak(state, '2026-10-02');

    expect(result.days['2026-09-30']?.freeze).toBe(true);
    expect(result.days['2026-10-01']?.freeze).toBe(true);
    expect(result.current).toBe(5);
    expect(result.freezeUsedMonth).toBe('2026-10');
    expect(result.freezesUsed).toBe(1);
  });

  it('counts already recorded current-month freezes instead of resetting the allowance', () => {
    const state = baseState('2026-10-01');
    state.days['2026-10-01'] = { date: '2026-10-01', seconds: 0, completed: false, freeze: true };
    state.freezesUsed = 0;

    const result = evaluateStreak(state, '2026-10-03');

    expect(result.days['2026-10-02']?.freeze).toBe(true);
    expect(result.freezeUsedMonth).toBe('2026-10');
    expect(result.freezesUsed).toBe(2);
  });

  it('resets only after a calendar month has exhausted its three freezes', () => {
    const state = baseState('2026-10-01');
    state.days['2026-10-01'] = { date: '2026-10-01', seconds: 0, completed: false, freeze: true };
    state.days['2026-10-02'] = { date: '2026-10-02', seconds: 0, completed: false, freeze: true };
    state.days['2026-10-03'] = { date: '2026-10-03', seconds: 0, completed: false, freeze: true };
    state.freezesUsed = 3;
    state.freezeUsedMonth = '2026-10';

    const result = evaluateStreak(state, '2026-10-05');

    expect(result.days['2026-10-04']?.freeze).toBeUndefined();
    expect(result.days['2026-10-04']?.completed).toBe(false);
    expect(result.current).toBe(0);
  });
});
