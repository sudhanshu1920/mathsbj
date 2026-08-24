import { m as motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { memo } from 'react';

interface TopicCardProps {
  title: string;
  icon: LucideIcon;
  gradient: string;
  onClick: () => void;
  delay?: number;
}

const TopicCard = ({ title, icon: Icon, gradient, onClick, delay = 0 }: TopicCardProps) => {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.08, duration: 0.3 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`${gradient} rounded-2xl p-5 flex flex-col items-center justify-center gap-3 aspect-square shadow-lg`}
    >
      <Icon size={32} className="text-primary-foreground" />
      <span className="text-sm font-display font-semibold text-primary-foreground">{title}</span>
    </motion.button>
  );
};

export default memo(TopicCard);
