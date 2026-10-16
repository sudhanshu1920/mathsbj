import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { getHorizontalSwipeDirection } from '@/lib/swipeDirection';

interface SwipeBackProps {
  onBack: () => void;
  children: React.ReactNode;
  enabled?: boolean;
  /** Permit an edge-back gesture to start inside a swipe surface that normally opts out of back gestures. */
  allowIgnoredEdgeSwipe?: boolean;
}

export const SWIPE_BACK_EDGE_WIDTH = 28;
const TRIGGER_DISTANCE = 72;
const TRIGGER_VELOCITY = 700;
const AXIS_LOCK_THRESHOLD = 10;
const MAX_FOLLOW = 120;

const SwipeBack = ({ onBack, children, enabled = true, allowIgnoredEdgeSwipe = false }: SwipeBackProps) => {
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<'x' | 'y' | null>(null);
  const active = useRef(false);
  const pointerId = useRef<number | null>(null);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const velocityX = useRef(0);

  const reset = useCallback(() => {
    start.current = null;
    axis.current = null;
    active.current = false;
    pointerId.current = null;
    lastX.current = 0;
    lastTime.current = 0;
    velocityX.current = 0;
  }, []);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || e.pointerType === 'mouse') return;
    const startsInsideIgnoredSurface = Boolean((e.target as HTMLElement | null)?.closest('[data-swipe-ignore-back="true"]'));
    if (e.clientX > SWIPE_BACK_EDGE_WIDTH || (startsInsideIgnoredSurface && !allowIgnoredEdgeSwipe)) {
      reset();
      return;
    }

    start.current = { x: e.clientX, y: e.clientY };
    axis.current = null;
    active.current = false;
    pointerId.current = e.pointerId;
    lastX.current = e.clientX;
    lastTime.current = performance.now();
    velocityX.current = 0;
  }, [allowIgnoredEdgeSwipe, enabled, reset]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || pointerId.current !== e.pointerId || !start.current) return;

    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (!axis.current && (Math.abs(dx) > AXIS_LOCK_THRESHOLD || Math.abs(dy) > AXIS_LOCK_THRESHOLD)) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axis.current === 'y') {
        reset();
        return;
      }
      active.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture is optional; the gesture can still finish normally.
      }
    }

    if (axis.current !== 'x' || !active.current) return;

    e.preventDefault();
    const now = performance.now();
    const dt = Math.max(1, now - lastTime.current);
    velocityX.current = ((e.clientX - lastX.current) / dt) * 1000;
    lastX.current = e.clientX;
    lastTime.current = now;

    const follow = Math.min(Math.max(0, dx), MAX_FOLLOW);
    e.currentTarget.style.setProperty('--swipe-back-offset', `${follow}px`);
  }, [enabled, reset]);

  const finish = useCallback((e: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!start.current || pointerId.current !== e.pointerId) return;

    const dx = e.clientX - start.current.x;
    const direction = getHorizontalSwipeDirection(dx, 0, TRIGGER_DISTANCE);
    const shouldGoBack =
      !cancelled &&
      axis.current === 'x' &&
      active.current &&
      (direction === 'right' || velocityX.current >= TRIGGER_VELOCITY);

    e.currentTarget.style.removeProperty('--swipe-back-offset');
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // The pointer may already have been released/cancelled by the platform.
    }
    reset();

    if (shouldGoBack) onBack();
  }, [onBack, reset]);

  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => finish(e), [finish]);
  const handlePointerCancel = useCallback((e: ReactPointerEvent<HTMLDivElement>) => finish(e, true), [finish]);

  if (!enabled) return <>{children}</>;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className="w-full"
      style={{
        touchAction: 'pan-y',
        transform: 'translate3d(var(--swipe-back-offset, 0px), 0, 0)',
      }}
    >
      {children}
    </div>
  );
};

export default SwipeBack;
