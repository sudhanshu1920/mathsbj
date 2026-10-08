import { PERIODIC_RANGES } from '@/lib/periodicRanges';

export const PERIODIC_GROUPS = PERIODIC_RANGES;

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
