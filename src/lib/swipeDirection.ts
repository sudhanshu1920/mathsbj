export type HorizontalSwipeDirection = 'left' | 'right' | null;

export const DEFAULT_SWIPE_THRESHOLD = 72;
export const DEFAULT_AXIS_DOMINANCE = 1.15;

export const getHorizontalSwipeDirection = (
  dx: number,
  dy: number,
  threshold = DEFAULT_SWIPE_THRESHOLD,
  axisDominance = DEFAULT_AXIS_DOMINANCE,
): HorizontalSwipeDirection => {
  if (
    !Number.isFinite(dx) ||
    !Number.isFinite(dy) ||
    !Number.isFinite(threshold) ||
    !Number.isFinite(axisDominance) ||
    threshold <= 0 ||
    axisDominance <= 0
  ) {
    return null;
  }

  const horizontal = Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * axisDominance;
  if (!horizontal) return null;

  return dx < 0 ? 'left' : 'right';
};
