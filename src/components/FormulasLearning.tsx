import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import SwipeBack from '@/components/SwipeBack';
import SwipeContainer from '@/components/SwipeContainer';
import { FORMULA_CATEGORIES } from '@/lib/formulaData';

interface FormulasLearningProps {
  selectedCategoryIndex: number | null;
  onCategorySelect: (index: number | null) => void;
}

const FormulasLearning = ({ selectedCategoryIndex, onCategorySelect }: FormulasLearningProps) => {
  // Category detail view with swipe between categories
  if (selectedCategoryIndex !== null) {
    const category = FORMULA_CATEGORIES[selectedCategoryIndex];
    
    const items = FORMULA_CATEGORIES.map((cat) => (
      <div key={cat.id} className="space-y-3">
        {cat.formulas.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="bg-card border border-border rounded-xl px-5 py-4"
          >
            <span
              className="text-foreground text-base leading-relaxed formula-text"
              dangerouslySetInnerHTML={{ __html: f.html }}
            />
          </motion.div>
        ))}
      </div>
    ));

    return (
      <SwipeBack onBack={() => onCategorySelect(null)}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => onCategorySelect(null)} className="p-2 -ml-2 text-primary">
              <ArrowLeft size={20} />
            </button>
            <h2 className="font-display font-bold text-lg text-foreground">
              {category?.title}
            </h2>
            <ThemeToggle />
          </div>
          <SwipeContainer
            items={items}
            currentIndex={selectedCategoryIndex}
            onIndexChange={(i) => onCategorySelect(i)}
          />
        </div>
      </SwipeBack>
    );
  }

  // Category list
  return (
    <div className="flex flex-col gap-3">
      {FORMULA_CATEGORIES.map((cat, i) => (
        <motion.button
          key={cat.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04, duration: 0.3 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onCategorySelect(i)}
          className="flex items-center gap-4 w-full bg-card border border-border rounded-2xl px-5 py-4 hover:border-primary transition-colors"
        >
          <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {cat.symbol}
          </span>
          <span className="font-display font-semibold text-foreground text-base flex-1 text-left">
            {cat.title}
          </span>
          <span className="text-muted-foreground">›</span>
        </motion.button>
      ))}
    </div>
  );
};

export default FormulasLearning;
