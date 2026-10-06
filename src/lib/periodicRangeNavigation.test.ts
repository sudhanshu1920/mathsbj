import {
  getAdjacentPeriodicRangeIndex,
  isValidPeriodicRangeIndex,
  PERIODIC_GROUPS,
} from './periodicRangeNavigation';

describe('periodic range navigation', () => {
  it('keeps the requested range list stable and exact', () => {
    expect(PERIODIC_GROUPS.map(({ from, to }) => `${from}–${to}`)).toEqual([
      '1–10',
      '11–20',
      '21–30',
      '31–40',
      '41–50',
      '51–60',
      '61–70',
      '71–80',
      '81–90',
      '91–100',
      '101–110',
      '110–118',
    ]);
  });

  it('moves to next and previous ranges without leaving valid bounds', () => {
    expect(getAdjacentPeriodicRangeIndex(0, 'next')).toBe(1);
    expect(getAdjacentPeriodicRangeIndex(2, 'next')).toBe(3);
    expect(getAdjacentPeriodicRangeIndex(11, 'next')).toBe(11);

    expect(getAdjacentPeriodicRangeIndex(11, 'previous')).toBe(10);
    expect(getAdjacentPeriodicRangeIndex(2, 'previous')).toBe(1);
    expect(getAdjacentPeriodicRangeIndex(0, 'previous')).toBe(0);
  });

  it('rejects invalid range indexes', () => {
    expect(isValidPeriodicRangeIndex(0)).toBe(true);
    expect(isValidPeriodicRangeIndex(11)).toBe(true);
    expect(isValidPeriodicRangeIndex(-1)).toBe(false);
    expect(isValidPeriodicRangeIndex(12)).toBe(false);
    expect(isValidPeriodicRangeIndex(1.5)).toBe(false);
    expect(isValidPeriodicRangeIndex(Number.NaN)).toBe(false);
  });
});
