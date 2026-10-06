export const PERIODIC_GROUPS = [
  { from: 1, to: 10 },
  { from: 11, to: 20 },
  { from: 21, to: 30 },
  { from: 31, to: 40 },
  { from: 41, to: 50 },
  { from: 51, to: 60 },
  { from: 61, to: 70 },
  { from: 71, to: 80 },
  { from: 81, to: 90 },
  { from: 91, to: 100 },
  { from: 101, to: 110 },
  { from: 110, to: 118 },
] as const;

export function getAdjacentPeriodicRangeIndex(
  index: number,
  direction: 'previous' | 'next',
): number {
  const delta = direction === 'next' ? 1 : -1;
  const nextIndex = index + delta;
  return nextIndex >= 0 && nextIndex < PERIODIC_GROUPS.length ? nextIndex : index;
}

export function isValidPeriodicRangeIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < PERIODIC_GROUPS.length;
}

export function getPeriodicSwipeDirection(
  dx: number,
  dy: number,
  threshold = 56,
): 'next' | 'previous' | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(threshold) || threshold <= 0) {
    return null;
  }

  const horizontal = Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.15;
  if (!horizontal) return null;
  return dx < 0 ? 'next' : 'previous';
}
