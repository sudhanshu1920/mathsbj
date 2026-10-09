import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_MINUTES,
  formatChallengeTime,
  getChallengeDurationSeconds,
  getRemainingSeconds,
  getTimerModeFromToggle,
  type QuizTimerMode,
} from './quizTimer';

describe('Quiz Challenge timer configuration', () => {
  it('exposes only the requested duration choices', () => {
    expect(CHALLENGE_MINUTES).toEqual([1, 2, 3, 4, 5, 10]);
  });

  it.each([
    [1, 60],
    [2, 120],
    [3, 180],
    [4, 240],
    [5, 300],
    [10, 600],
  ] as const)('converts %s minutes to %s seconds', (minutes, seconds) => {
    expect(getChallengeDurationSeconds(minutes)).toBe(seconds);
  });

  it('keeps timer modes mutually exclusive when either toggle changes', () => {
    const modes: QuizTimerMode[] = [];
    modes.push(getTimerModeFromToggle('perQuestion', true));
    modes.push(getTimerModeFromToggle('challenge', true));
    modes.push(getTimerModeFromToggle('challenge', false));
    modes.push(getTimerModeFromToggle('perQuestion', false));

    expect(modes).toEqual(['perQuestion', 'challenge', 'off', 'off']);
    expect(modes.every((mode) => mode === 'off' || mode === 'perQuestion' || mode === 'challenge')).toBe(true);
  });

  it('calculates remaining time from the deadline rather than accumulated ticks', () => {
    const deadline = 61_000;
    expect(getRemainingSeconds(deadline, 1_000)).toBe(60);
    expect(getRemainingSeconds(deadline, 2_001)).toBe(59);
    expect(getRemainingSeconds(deadline, 60_999)).toBe(1);
    expect(getRemainingSeconds(deadline, 61_000)).toBe(0);
    expect(getRemainingSeconds(deadline, 90_000)).toBe(0);
  });

  it('formats countdown values compactly without going negative', () => {
    expect(formatChallengeTime(600)).toBe('10:00');
    expect(formatChallengeTime(60)).toBe('01:00');
    expect(formatChallengeTime(59)).toBe('00:59');
    expect(formatChallengeTime(0)).toBe('00:00');
    expect(formatChallengeTime(-5)).toBe('00:00');
  });
});
