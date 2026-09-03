import { useCallback, useRef } from 'react';
import { m as motion, useDragControls, type PanInfo } from 'framer-motion';

interface SwipeBackProps {
  onBack: () => void;
  children: React.ReactNode;
  enabled?: boolean;
}

const EDGE_WIDTH = 40; // px from left edge that can start the gesture

const SwipeBack = ({ onBack, children, enabled = true }: SwipeBackProps) => {
  const controls = useDragControls();
  const fromEdge = useRef(false);

  // Drag NEVER starts on its own (dragListener=false). We only start it
  // manually when the pointer goes down within the left edge zone, so
  // taps/micro-drags on content (keypad, options) can never shift the layout.
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      if (e.clientX <= EDGE_WIDTH) {
        fromEdge.current = true;
        controls.start(e.nativeEvent);
      } else {
        fromEdge.current = false;
      }
    },
    [controls, enabled]
  );

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (!enabled || !fromEdge.current) return;
      const movedEnough = info.offset.x > 80;
      const fastEnough = info.velocity.x > 300;
      if (movedEnough || fastEnough) {
        onBack();
      }
    },
    [onBack, enabled]
  );

  if (!enabled) return <>{children}</>;

  return (
    <motion.div
      drag="x"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.3 }}
      dragDirectionLock
      onPointerDown={handlePointerDown}
      onDragEnd={handleDragEnd}
      className="w-full"
    >
      {children}
    </motion.div>
  );
};

export default SwipeBack;
