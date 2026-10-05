import { useState, useRef, useCallback, ReactNode, TouchEvent } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';

interface SwipeContainerProps {
  items?: ReactNode[];
  itemCount?: number;
  renderItem?: (index: number) => ReactNode;
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

const SwipeContainer = ({ items, itemCount, renderItem, currentIndex, onIndexChange }: SwipeContainerProps) => {
  const count = itemCount ?? items?.length ?? 0;
  const [direction, setDirection] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const axisLocked = useRef<'x' | 'y' | null>(null);
  const swiping = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    axisLocked.current = null;
    swiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStart.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;

    // Lock axis once movement exceeds threshold
    if (!axisLocked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axisLocked.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }

    // If horizontal swipe detected, prevent vertical scroll
    if (axisLocked.current === 'x') {
      e.preventDefault();
      swiping.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStart.current || axisLocked.current !== 'x') {
      touchStart.current = null;
      axisLocked.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const threshold = 50;

    if (dx < -threshold && currentIndex < count - 1) {
      setDirection(1);
      onIndexChange(currentIndex + 1);
    } else if (dx > threshold && currentIndex > 0) {
      setDirection(-1);
      onIndexChange(currentIndex - 1);
    }

    touchStart.current = null;
    axisLocked.current = null;
    swiping.current = false;
  }, [count, currentIndex, onIndexChange]);

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <div
      data-swipe-ignore-back="true"
      className="overflow-hidden relative min-h-[200px] touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      <AnimatePresence custom={direction} mode="popLayout">
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'tween', duration: 0.14, ease: 'easeOut' }}
          className="w-full"
        >
          {renderItem ? renderItem(currentIndex) : items?.[currentIndex] ?? null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SwipeContainer;
