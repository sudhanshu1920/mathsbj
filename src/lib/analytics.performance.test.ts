import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAnalytics, recordAnswer, todayStr } from '@/lib/analytics';

beforeEach(() => {
  localStorage.clear();
});

describe('analytics persistence hot path', () => {
  it('normalizes a historical dataset once until its persisted value changes', () => {
    const days = Object.fromEntries(Array.from({ length: 120 }, (_, index) => {
      const date = `2026-01-${String(index + 1).padStart(2, '0')}`;
      return [date, { date, hours: Array(24).fill(index), points: index, questions: index, correct: index }];
    }));
    localStorage.setItem('math-app-analytics-v1', JSON.stringify({ days }));

    const parse = vi.spyOn(JSON, 'parse');
    const first = getAnalytics();
    const second = getAnalytics();

    expect(parse).toHaveBeenCalledTimes(1);
    expect(Object.keys(second.days)).toHaveLength(120);
    expect(second).not.toBe(first);
    expect(second.days['2026-01-01'].hours).not.toBe(first.days['2026-01-01'].hours);
  });

  it('invalidates after an external restore or sync storage write', () => {
    getAnalytics();
    const date = todayStr();
    localStorage.setItem('math-app-analytics-v1', JSON.stringify({
      days: { [date]: { date, hours: Array(24).fill(0), points: 11, questions: 12, correct: 11 } },
    }));

    expect(getAnalytics().days[date].points).toBe(11);
  });

  it('updates the cached current day without reparsing historical analytics', () => {
    const date = todayStr();
    localStorage.setItem('math-app-analytics-v1', JSON.stringify({
      days: { [date]: { date, hours: Array(24).fill(0), points: 0, questions: 0, correct: 0 } },
    }));
    getAnalytics();

    const parse = vi.spyOn(JSON, 'parse');
    recordAnswer(true, 1);
    recordAnswer(false);

    expect(parse).not.toHaveBeenCalled();
    const today = getAnalytics().days[date];
    expect(today.questions).toBe(2);
    expect(today.correct).toBe(1);
    expect(today.points).toBe(2);
  });

  it('preserves persisted historical data and uses a fresh snapshot for readers', () => {
    recordAnswer(true);
    const first = getAnalytics();
    const date = todayStr();
    first.days[date].hours[0] = 999;

    expect(getAnalytics().days[date].hours[0]).not.toBe(999);
    expect(JSON.parse(localStorage.getItem('math-app-analytics-v1') || '{}').days[date].questions).toBe(1);
  });
});
