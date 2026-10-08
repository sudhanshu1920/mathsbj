import { useEffect, useState } from 'react';
import { m as motion } from 'framer-motion';
import { MOTION } from '@/lib/motion';
import { Zap } from 'lucide-react';
import { getXP, levelFromXP, xpInLevel, XP_PER_LEVEL } from '@/lib/xp';

interface XPBarProps {
  compact?: boolean;
}

const XPBar = ({ compact = false }: XPBarProps) => {
  const [xp, setXp] = useState(() => getXP().xp);
  useEffect(() => {
    const refresh = () => setXp(getXP().xp);
    refresh();
    window.addEventListener('xp-updated', refresh);
    return () => window.removeEventListener('xp-updated', refresh);
  }, []);

  const level = levelFromXP(xp);
  const inLvl = xpInLevel(xp);
  const pct = (inLvl / XP_PER_LEVEL) * 100;

  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'w-full'}`}>
      <motion.div
        key={level}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={MOTION.springGentle}
        className="flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full gradient-primary text-primary-foreground font-display font-bold text-xs"
      >
        {level}
      </motion.div>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden min-w-[60px]">
        <motion.div
          className="h-full gradient-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: MOTION.duration.data, ease: MOTION.ease.easeOut }}
        />
      </div>
      <span className="flex items-center gap-0.5 text-xs font-bold text-foreground tabular-nums">
        <Zap size={12} className="text-warning" />
        {inLvl}/{XP_PER_LEVEL}
      </span>
    </div>
  );
};

export default XPBar;
