import { useRef, useCallback } from 'react';
import { m as motion, type PanInfo } from 'framer-motion';

interface SwipeBackProps {
  onBack: () => void;
  children: React.ReactNode;
  enabled?: boolean;
}

const SwipeBack = ({ onBack, children, enabled = true }: SwipeBackProps) => {
  const startX = useRef(0);

  const handleDragStart = useCallback((_: any, info: PanInfo) => {
    startX.current = info.point.x;
  }, []);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (!enabled) return;
      // Only trigger if drag started near left edge (within 40px) and moved right enough
      const startedFromEdge = startX.current < 40;
      const movedEnough = info.offset.x > 80;
      const fastEnough = info.velocity.x > 300;

      if (startedFromEdge && (movedEnough || fastEnough)) {
        onBack();
      }
    },
    [onBack, enabled]
  );

  if (!enabled) return <>{children}</>;

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.3 }}
      dragDirectionLock
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="w-full"
    >
      {children}
    </motion.div>
  );
};

export default SwipeBack;
