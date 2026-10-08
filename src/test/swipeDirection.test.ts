import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AXIS_DOMINANCE,
  DEFAULT_SWIPE_THRESHOLD,
  getHorizontalSwipeDirection,
} from '@/lib/swipeDirection';

describe('app-level horizontal swipe direction', () => {
  it('accepts a dominant left swipe and rejects the opposite direction', () => {
    expect(getHorizontalSwipeDirection(-120, 12)).toBe('left');
    expect(getHorizontalSwipeDirection(120, 12)).toBe('right');
  });

  it('ignores taps, vertical movement, and diagonal movement that is not dominant', () => {
    expect(getHorizontalSwipeDirection(-40, 0)).toBeNull();
    expect(getHorizontalSwipeDirection(-120, 140)).toBeNull();
    expect(getHorizontalSwipeDirection(-120, -110)).toBeNull();
  });

  it('rejects invalid thresholds and keeps the shared defaults explicit', () => {
    expect(DEFAULT_SWIPE_THRESHOLD).toBe(72);
    expect(DEFAULT_AXIS_DOMINANCE).toBe(1.15);
    expect(getHorizontalSwipeDirection(-100, 0, 0)).toBeNull();
    expect(getHorizontalSwipeDirection(-100, 0, 72, 0)).toBeNull();
  });
});
