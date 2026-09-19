import { m as motion } from 'framer-motion';
import { memo, useMemo } from 'react';
import { isLowPower } from '@/lib/device';

interface ParticlesProps {
  count?: number;
  color?: string; // tailwind text/bg color class
  emoji?: string;
  spread?: number; // px radius
  duration?: number; // seconds
}

/** Lightweight one-shot particle burst. Render conditionally; remove after duration. */
const Particles = ({ count = 12, color = 'bg-success', emoji, spread = 80, duration = 0.7 }: ParticlesProps) => {
  const low = isLowPower();
  const n = low ? Math.min(4, Math.ceil(count / 3)) : count;

  const items = useMemo(
    () =>
      Array.from({ length: n }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const dist = spread * (0.6 + Math.random() * 0.6);
        return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
      }),
    [n, spread],
  );

  if (low && n === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {items.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 1 }}
          transition={{ duration, ease: 'easeOut' }}
          style={{ willChange: 'transform, opacity' }}
          className={emoji ? 'absolute text-sm' : `absolute w-1.5 h-1.5 rounded-full ${color}`}
        >
          {emoji || null}
        </motion.span>
      ))}
    </div>
  );
};

export default memo(Particles);
