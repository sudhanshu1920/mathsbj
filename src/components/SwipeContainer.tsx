import { useState, useRef, ReactNode } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

interface SwipeContainerProps {
  items: ReactNode[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

const SwipeContainer = ({ items, currentIndex, onIndexChange }: SwipeContainerProps) => {
  const [direction, setDirection] = useState(0);
  const constraintsRef = useRef(null);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold && currentIndex < items.length - 1) {
      setDirection(1);
      onIndexChange(currentIndex + 1);
    } else if (info.offset.x > threshold && currentIndex > 0) {
      setDirection(-1);
      onIndexChange(currentIndex - 1);
    }
  };

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <div ref={constraintsRef} className="overflow-hidden relative min-h-[200px]">
      <AnimatePresence custom={direction} mode="popLayout">
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          className="w-full"
        >
          {items[currentIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SwipeContainer;
