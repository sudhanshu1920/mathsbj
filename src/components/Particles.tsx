import { motion } from 'framer-motion';

interface ParticlesProps {
  count?: number;
  color?: string; // tailwind text/bg color class
  emoji?: string;
  spread?: number; // px radius
  duration?: number; // seconds
}

/** Lightweight one-shot particle burst. Render conditionally; remove after duration. */
const Particles = ({ count = 12, color = 'bg-success', emoji, spread = 80, duration = 0.7 }: ParticlesProps) => {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const dist = spread * (0.6 + Math.random() * 0.6);
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x, y, opacity: 0, scale: 1 }}
            transition={{ duration, ease: 'easeOut' }}
            className={emoji ? 'absolute text-sm' : `absolute w-1.5 h-1.5 rounded-full ${color}`}
          >
            {emoji || null}
          </motion.span>
        );
      })}
    </div>
  );
};

export default Particles;