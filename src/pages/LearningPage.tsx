import { useState } from 'react';
import { motion } from 'framer-motion';
import { Grid3x3, Square, Radical, Box, Zap, Percent, ArrowLeft, Target } from 'lucide-react';
import TopicCard from '@/components/TopicCard';
import SwipeContainer from '@/components/SwipeContainer';
import StackedFraction from '@/components/StackedFraction';
import { getTable, getSquares, getSquareRoots, getCubes, getCubeRoots, getPowers, getPercentages, getExtendedRangeGroups } from '@/lib/mathData';

type Topic = 'tables' | 'squares' | 'square-roots' | 'cubes' | 'cube-roots' | 'powers' | 'percentage';

interface LearningPageProps {
  onStartPractice?: (topic: string, context?: { from?: number; to?: number; number?: number }) => void;
}

const topics: { id: Topic; title: string; icon: any; gradient: string }[] = [
  { id: 'tables', title: 'Tables', icon: Grid3x3, gradient: 'gradient-primary' },
  { id: 'squares', title: 'Squares', icon: Square, gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
  { id: 'square-roots', title: 'Square Roots', icon: Radical, gradient: 'bg-gradient-to-br from-cyan-500 to-blue-600' },
  { id: 'cubes', title: 'Cubes', icon: Box, gradient: 'bg-gradient-to-br from-orange-500 to-red-500' },
  { id: 'cube-roots', title: 'Cube Roots', icon: Box, gradient: 'bg-gradient-to-br from-pink-500 to-rose-600' },
  { id: 'powers', title: 'Powers', icon: Zap, gradient: 'bg-gradient-to-br from-violet-500 to-purple-600' },
  { id: 'percentage', title: 'Percentage', icon: Percent, gradient: 'bg-gradient-to-br from-amber-500 to-yellow-600' },
];

function parseMixedPercentage(mixed: string): { whole: number; numerator: number; denominator: number } | null {
  // e.g. "50%" or "33 1/3%" or "1/2%"
  const m = mixed.match(/^(\d+)?\s*(?:(\d+)\/(\d+))?\s*%$/);
  if (!m) return null;
  const whole = m[1] ? parseInt(m[1]) : 0;
  const num = m[2] ? parseInt(m[2]) : 0;
  const den = m[3] ? parseInt(m[3]) : 1;
  if (num === 0) return null; // pure whole number, no fraction needed
  return { whole, numerator: num, denominator: den };
}

const LearningPage = ({ onStartPractice }: LearningPageProps) => {
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ from: number; to: number } | null>(null);

  const rangeGroups = getExtendedRangeGroups();

  const handlePractice = (topicId: string) => {
    if (!onStartPractice) return;
    const ctx: { from?: number; to?: number; number?: number } = {};
    if (selectedNumber) ctx.number = selectedNumber;
    if (selectedRange) { ctx.from = selectedRange.from; ctx.to = selectedRange.to; }
    onStartPractice(topicId, ctx);
  };

  const renderHeader = (title: string, onBack: () => void, practiceTopicId?: string) => (
    <div className="flex items-center justify-between mb-4">
      <button onClick={onBack} className="flex items-center gap-2 text-primary">
        <ArrowLeft size={20} />
        <span className="font-medium">Back</span>
      </button>
      <h2 className="font-display font-bold text-lg text-foreground">{title}</h2>
      {practiceTopicId ? (
        <button
          onClick={() => handlePractice(practiceTopicId)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full gradient-primary text-primary-foreground text-xs font-semibold"
        >
          <Target size={14} />
          Practice
        </button>
      ) : (
        <div className="w-20" />
      )}
    </div>
  );

  const renderDataCards = (items: { expression: string; answer: number; exponent?: number }[]) => (
    <div className="space-y-2">
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          className="bg-card rounded-xl px-5 py-3 flex items-center justify-center text-center border border-border"
        >
          <span className="text-foreground text-base">
            {item.expression}
            {item.exponent !== undefined && <sup className="text-primary font-bold">{item.exponent}</sup>}
            {' = '}
            <span className="font-bold text-primary text-lg">{item.answer.toLocaleString()}</span>
          </span>
        </motion.div>
      ))}
    </div>
  );

  const renderNumberGrid = (max: number, onSelect: (n: number) => void) => (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <motion.button
          key={n}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: n * 0.005 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onSelect(n)}
          className="bg-card border border-border rounded-xl py-3 text-center font-display font-semibold text-foreground hover:border-primary transition-colors"
        >
          {n}
        </motion.button>
      ))}
    </div>
  );

  const renderRangeGroups = (onSelect: (from: number, to: number) => void) => (
    <div className="grid grid-cols-2 gap-3">
      {rangeGroups.map((g, i) => (
        <motion.button
          key={g.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(g.from, g.to)}
          className="bg-card border border-border rounded-xl py-4 text-center font-display font-semibold text-foreground hover:border-primary transition-colors"
        >
          {g.label}
        </motion.button>
      ))}
    </div>
  );

  // TABLES
  if (activeTopic === 'tables' && selectedNumber) {
    const allNumbers = Array.from({ length: 200 }, (_, i) => i + 1);
    const items = allNumbers.map((n) => {
      const tableData = getTable(n);
      return (
        <div key={n}>
          <h3 className="font-display font-bold text-xl text-center mb-4 text-primary">Table of {n}</h3>
          {renderDataCards(tableData)}
        </div>
      );
    });

    return (
      <div>
        {renderHeader(`Table of ${selectedNumber}`, () => setSelectedNumber(null), 'tables')}
        <SwipeContainer
          items={items}
          currentIndex={selectedNumber - 1}
          onIndexChange={(i) => setSelectedNumber(i + 1)}
        />
        <p className="text-center text-muted-foreground text-xs mt-4">Swipe left/right to navigate</p>
      </div>
    );
  }

  if (activeTopic === 'tables') {
    return (
      <div>
        {renderHeader('Tables', () => setActiveTopic(null), 'tables')}
        <p className="text-muted-foreground text-sm mb-4 text-center">Select a number (1–200)</p>
        {renderNumberGrid(200, setSelectedNumber)}
      </div>
    );
  }

  // POWERS
  if (activeTopic === 'powers' && selectedNumber) {
    const allNumbers = Array.from({ length: 200 }, (_, i) => i + 1);
    const items = allNumbers.map((n) => {
      const powerData = getPowers(n);
      return (
        <div key={n}>
          <h3 className="font-display font-bold text-xl text-center mb-4 text-primary">Powers of {n}</h3>
          {renderDataCards(powerData)}
        </div>
      );
    });

    return (
      <div>
        {renderHeader(`Powers of ${selectedNumber}`, () => setSelectedNumber(null), 'powers')}
        <SwipeContainer
          items={items}
          currentIndex={selectedNumber - 1}
          onIndexChange={(i) => setSelectedNumber(i + 1)}
        />
        <p className="text-center text-muted-foreground text-xs mt-4">Swipe left/right to navigate</p>
      </div>
    );
  }

  if (activeTopic === 'powers') {
    return (
      <div>
        {renderHeader('Powers', () => setActiveTopic(null), 'powers')}
        <p className="text-muted-foreground text-sm mb-4 text-center">Select a number (1–200)</p>
        {renderNumberGrid(200, setSelectedNumber)}
      </div>
    );
  }

  // SQUARES / ROOTS / CUBES / CUBE ROOTS
  if (['squares', 'square-roots', 'cubes', 'cube-roots'].includes(activeTopic || '') && selectedRange) {
    const allItems = rangeGroups.map((g) => {
      let data: any[];
      switch (activeTopic) {
        case 'squares': data = getSquares(g.from, g.to); break;
        case 'square-roots': data = getSquareRoots(g.from, g.to); break;
        case 'cubes': data = getCubes(g.from, g.to); break;
        case 'cube-roots': data = getCubeRoots(g.from, g.to); break;
        default: data = [];
      }
      return (
        <div key={g.label}>
          <h3 className="font-display font-bold text-xl text-center mb-4 text-primary">{g.label}</h3>
          {renderDataCards(data)}
        </div>
      );
    });

    const currentIdx = rangeGroups.findIndex(
      (g) => g.from === selectedRange.from && g.to === selectedRange.to
    );

    const topicTitle = activeTopic?.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '';

    return (
      <div>
        {renderHeader(topicTitle, () => setSelectedRange(null), activeTopic || undefined)}
        <SwipeContainer
          items={allItems}
          currentIndex={currentIdx >= 0 ? currentIdx : 0}
          onIndexChange={(i) => {
            const g = rangeGroups[i];
            if (g) setSelectedRange({ from: g.from, to: g.to });
          }}
        />
        <p className="text-center text-muted-foreground text-xs mt-4">Swipe left/right to navigate</p>
      </div>
    );
  }

  if (['squares', 'square-roots', 'cubes', 'cube-roots'].includes(activeTopic || '')) {
    const topicTitle = activeTopic?.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '';
    return (
      <div>
        {renderHeader(topicTitle, () => setActiveTopic(null), activeTopic || undefined)}
        <p className="text-muted-foreground text-sm mb-4 text-center">Select a range</p>
        {renderRangeGroups((from, to) => setSelectedRange({ from, to }))}
      </div>
    );
  }

  // PERCENTAGE
  if (activeTopic === 'percentage') {
    const data = getPercentages();
    return (
      <div>
        {renderHeader('Percentage', () => setActiveTopic(null), 'percentage')}
        <div className="grid grid-cols-3 gap-2 mb-3 text-xs font-semibold text-muted-foreground">
          <div className="text-center">Fraction</div>
          <div className="text-center">Percentage</div>
          <div className="text-center">Mixed</div>
        </div>
        <div className="space-y-2">
          {data.map((row, i) => {
            const parsed = parseMixedPercentage(row.mixed);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="bg-card border border-border rounded-xl px-3 py-3 grid grid-cols-3 gap-2 text-center text-sm items-center"
              >
                <span className="text-foreground font-medium">{row.fraction}</span>
                <span className="text-primary font-bold">{row.decimal}</span>
                <span className="flex justify-center">
                  {parsed ? (
                    <StackedFraction
                      whole={parsed.whole}
                      numerator={parsed.numerator}
                      denominator={parsed.denominator}
                    />
                  ) : (
                    <span className="text-primary font-bold">{row.mixed}</span>
                  )}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // TOPIC GRID
  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-6 text-glow">Learning</h1>
      <div className="grid grid-cols-2 gap-4">
        {topics.map((t, i) => (
          <TopicCard
            key={t.id}
            title={t.title}
            icon={t.icon}
            gradient={t.gradient}
            onClick={() => setActiveTopic(t.id)}
            delay={i}
          />
        ))}
      </div>
    </div>
  );
};

export default LearningPage;
