import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_MINUTES,
  formatChallengeTime,
  getChallengeDurationSeconds,
  getRemainingSeconds,
  getTimerProgressPercent,
  getTimerModeFromToggle,
  isQuestionCountSelectionDisabled,
  shouldUseInfiniteQuestionPool,
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

  it('disables every fixed question-count option only while Challenge or Repetition is active', () => {
    expect(isQuestionCountSelectionDisabled(false, 'off')).toBe(false);
    expect(isQuestionCountSelectionDisabled(false, 'perQuestion')).toBe(false);
    expect(isQuestionCountSelectionDisabled(false, 'challenge')).toBe(true);
    expect(isQuestionCountSelectionDisabled(true, 'off')).toBe(true);
    expect(isQuestionCountSelectionDisabled(true, 'challenge')).toBe(true);
  });

  it('uses a recyclable question pool for Challenge regardless of the saved count or infinity selection', () => {
    expect(shouldUseInfiniteQuestionPool('challenge', false, false)).toBe(true);
    expect(shouldUseInfiniteQuestionPool('challenge', false, true)).toBe(true);
    expect(shouldUseInfiniteQuestionPool('challenge', true, false)).toBe(true);
    expect(shouldUseInfiniteQuestionPool('off', false, false)).toBe(false);
    expect(shouldUseInfiniteQuestionPool('perQuestion', false, false)).toBe(false);
    expect(shouldUseInfiniteQuestionPool('off', true, true)).toBe(false);
    expect(shouldUseInfiniteQuestionPool('perQuestion', false, true)).toBe(true);
  });

  it('calculates remaining time from the deadline rather than accumulated ticks', () => {
    const deadline = 61_000;
    expect(getRemainingSeconds(deadline, 1_000)).toBe(60);
    expect(getRemainingSeconds(deadline, 2_001)).toBe(59);
    expect(getRemainingSeconds(deadline, 60_999)).toBe(1);
    expect(getRemainingSeconds(deadline, 61_000)).toBe(0);
    expect(getRemainingSeconds(deadline, 90_000)).toBe(0);
  });

  it('converts the active timer deadline into a clamped percentage', () => {
    const deadline = 10_000;
    expect(getTimerProgressPercent(deadline, 10_000, 0)).toBe(100);
    expect(getTimerProgressPercent(deadline, 10_000, 2_000)).toBe(80);
    expect(getTimerProgressPercent(deadline, 10_000, 5_000)).toBe(50);
    expect(getTimerProgressPercent(deadline, 10_000, 8_000)).toBe(20);
    expect(getTimerProgressPercent(deadline, 10_000, 10_000)).toBe(0);
    expect(getTimerProgressPercent(deadline, 10_000, 12_000)).toBe(0);
  });

  it('safely handles missing deadlines and invalid duration values', () => {
    expect(getTimerProgressPercent(null, 10_000, 0)).toBe(0);
    expect(getTimerProgressPercent(10_000, 0, 0)).toBe(0);
    expect(getTimerProgressPercent(10_000, -1, 0)).toBe(0);
    expect(getTimerProgressPercent(Number.NaN, 10_000, 0)).toBe(0);
  });

  it('formats countdown values compactly without going negative', () => {
    expect(formatChallengeTime(600)).toBe('10:00');
    expect(formatChallengeTime(60)).toBe('01:00');
    expect(formatChallengeTime(59)).toBe('00:59');
    expect(formatChallengeTime(0)).toBe('00:00');
    expect(formatChallengeTime(-5)).toBe('00:00');
  });
});
