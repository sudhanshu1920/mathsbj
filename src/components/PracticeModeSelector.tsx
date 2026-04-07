import { motion } from 'framer-motion';
import { ListChecks, Keyboard } from 'lucide-react';

interface PracticeModeSelectorProps {
  onSelect: (mode: 'mcq' | 'input') => void;
}

const PracticeModeSelector = ({ onSelect }: PracticeModeSelectorProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 py-8"
    >
      <h3 className="font-display font-bold text-lg text-foreground mb-2">Choose Mode</h3>
      <div className="flex gap-4 w-full max-w-xs">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect('mcq')}
          className="flex-1 flex flex-col items-center gap-2 py-6 rounded-2xl gradient-primary text-primary-foreground font-semibold shadow-lg"
        >
          <ListChecks size={28} />
          <span className="text-sm">MCQ</span>
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect('input')}
          className="flex-1 flex flex-col items-center gap-2 py-6 rounded-2xl bg-accent text-accent-foreground font-semibold shadow-lg"
        >
          <Keyboard size={28} />
          <span className="text-sm">Type Answer</span>
        </motion.button>
      </div>
    </motion.div>
  );
};

export default PracticeModeSelector;
