import { motion } from 'framer-motion';

export type MascotExpression = 'happy' | 'thinking' | 'celebrating' | 'sad';

interface MascotProps {
  expression?: MascotExpression;
  size?: number;
  className?: string;
  animate?: boolean;
}

// Friendly math-owl mascot. Pure SVG so it themes via currentColor & works offline.
const Mascot = ({ expression = 'happy', size = 96, className = '', animate = true }: MascotProps) => {
  const eyeY = expression === 'sad' ? 44 : 42;
  const mouthPath =
    expression === 'celebrating'
      ? 'M40 58 Q50 72 60 58'
      : expression === 'sad'
      ? 'M40 62 Q50 54 60 62'
      : expression === 'thinking'
      ? 'M42 60 L58 60'
      : 'M40 58 Q50 66 60 58';

  const Wrap: any = animate ? motion.div : 'div';
  const motionProps = animate
    ? {
        animate: { y: [0, -4, 0] },
        transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
      }
    : {};

  return (
    <Wrap {...motionProps} className={`inline-block ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        {/* body */}
        <ellipse cx="50" cy="58" rx="34" ry="36" fill="hsl(var(--primary))" />
        {/* belly */}
        <ellipse cx="50" cy="68" rx="22" ry="22" fill="hsl(var(--primary-foreground) / 0.18)" />
        {/* ears */}
        <path d="M20 32 L28 18 L34 30 Z" fill="hsl(var(--primary))" />
        <path d="M80 32 L72 18 L66 30 Z" fill="hsl(var(--primary))" />
        {/* eye whites */}
        <circle cx="40" cy={eyeY} r="10" fill="white" />
        <circle cx="60" cy={eyeY} r="10" fill="white" />
        {/* pupils */}
        <circle cx="41" cy={eyeY + 1} r="4.5" fill="hsl(265 60% 12%)" />
        <circle cx="61" cy={eyeY + 1} r="4.5" fill="hsl(265 60% 12%)" />
        <circle cx="42" cy={eyeY - 1} r="1.5" fill="white" />
        <circle cx="62" cy={eyeY - 1} r="1.5" fill="white" />
        {/* beak */}
        <path d="M46 52 L54 52 L50 58 Z" fill="hsl(var(--warning))" />
        {/* mouth */}
        <path d={mouthPath} fill="none" stroke="hsl(265 60% 12%)" strokeWidth="2" strokeLinecap="round" />
        {/* cheeks */}
        <circle cx="30" cy="56" r="4" fill="hsl(var(--accent) / 0.55)" />
        <circle cx="70" cy="56" r="4" fill="hsl(var(--accent) / 0.55)" />
        {/* feet */}
        <ellipse cx="40" cy="94" rx="6" ry="3" fill="hsl(var(--warning))" />
        <ellipse cx="60" cy="94" rx="6" ry="3" fill="hsl(var(--warning))" />
      </svg>
    </Wrap>
  );
};

export default Mascot;