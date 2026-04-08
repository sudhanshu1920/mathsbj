import { useState } from 'react';
import { motion } from 'framer-motion';
import { Grid3x3, Square, Radical, Box, Zap, Percent, ArrowLeft, Target } from 'lucide-react';
import TopicCard from '@/components/TopicCard';
import SwipeContainer from '@/components/SwipeContainer';
import SwipeBack from '@/components/SwipeBack';
import PercentageLearning, { PercentageExpanded, PERCENTAGE_GROUPS } from '@/components/PercentageLearning';
import PracticeModeSelector from '@/components/PracticeModeSelector';
import { getTable, getSquares, getSquareRoots, getCubes, getCubeRoots, getPowers, getExtendedRangeGroups } from '@/lib/mathData';
import type { LearningState } from '@/pages/Index';

type Topic = 'tables' | 'squares' | 'square-roots' | 'cubes' | 'cube-roots' | 'powers' | 'percentage';

interface LearningPageProps {
  onStartPractice?: (topic: string, context?: { from?: number; to?: number; number?: number }, mode?: 'mcq' | 'input') => void;
  learningState?: LearningState;
  onLearningStateChange?: (state: LearningState) => void;
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

const LearningPage = ({ onStartPractice, learningState, onLearningStateChange }: LearningPageProps) => {
  const activeTopic = (learningState?.activeTopic as Topic | null) ?? null;
  const selectedNumber = learningState?.selectedNumber ?? null;
  const selectedRange = learningState?.selectedRange ?? null;
  const [showPracticeMode, setShowPracticeMode] = useState(false);

  const updateState = (partial: Partial<LearningState>) => {
    if (onLearningStateChange && learningState) {
      onLearningStateChange({ ...learningState, ...partial });
    }
  };

  const setActiveTopic = (t: Topic | null) => updateState({ activeTopic: t, selectedNumber: null, selectedRange: null });
  const setSelectedNumber = (n: number | null) => updateState({ selectedNumber: n });
  const setSelectedRange = (r: { from: number; to: number } | null) => updateState({ selectedRange: r });

  const rangeGroups = getExtendedRangeGroups();

  const handlePracticeSelect = (mode: 'mcq' | 'input') => {
    if (!onStartPractice || !activeTopic) return;
    const ctx: { from?: number; to?: number; number?: number } = {};
    if (selectedNumber) ctx.number = selectedNumber;
    if (selectedRange) { ctx.from = selectedRange.from; ctx.to = selectedRange.to; }
    onStartPractice(activeTopic, ctx, mode);
    setShowPracticeMode(false);
  };

  const renderHeader = (title: string, onBack: () => void, showPractice = true) => (
    <div className="flex items-center justify-between mb-4">
      <button onClick={onBack} className="flex items-center gap-2 text-primary">
        <ArrowLeft size={20} />
        <span className="font-medium">Back</span>
      </button>
      <h2 className="font-display font-bold text-lg text-foreground">{title}</h2>
      {showPractice ? (
        <button
          onClick={() => setShowPracticeMode(true)}
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

  const renderDataCards = (items: { expression: string; answer: number; exponent?: number; approximate?: boolean }[]) => (
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
            {item.approximate ? ' ≈ ' : ' = '}
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

  // Practice mode selector overlay
  if (showPracticeMode) {
    return (
      <div>
        {renderHeader('Choose Practice Mode', () => setShowPracticeMode(false), false)}
        <PracticeModeSelector onSelect={handlePracticeSelect} />
      </div>
    );
  }

  // TABLES
  if (activeTopic === 'tables' && selectedNumber) {
    const allNumbers = Array.from({ length: 200 }, (_, i) => i + 1);
    const items = allNumbers.map((n) => (
      <div key={n}>
        <h3 className="font-display font-bold text-xl text-center mb-4 text-primary">Table of {n}</h3>
        {renderDataCards(getTable(n))}
      </div>
    ));

    return (
      <SwipeBack onBack={() => setSelectedNumber(null)}>
        <div>
          {renderHeader(`Table of ${selectedNumber}`, () => setSelectedNumber(null))}
          <SwipeContainer items={items} currentIndex={selectedNumber - 1} onIndexChange={(i) => setSelectedNumber(i + 1)} />
          <p className="text-center text-muted-foreground text-xs mt-4">Swipe left/right to navigate</p>
        </div>
      </SwipeBack>
    );
  }

  if (activeTopic === 'tables') {
    return (
      <SwipeBack onBack={() => setActiveTopic(null)}>
        <div>
          {renderHeader('Tables', () => setActiveTopic(null))}
          <p className="text-muted-foreground text-sm mb-4 text-center">Select a number (1–200)</p>
          {renderNumberGrid(200, setSelectedNumber)}
        </div>
      </SwipeBack>
    );
  }

  // POWERS
  if (activeTopic === 'powers' && selectedNumber) {
    const allNumbers = Array.from({ length: 200 }, (_, i) => i + 1);
    const items = allNumbers.map((n) => (
      <div key={n}>
        <h3 className="font-display font-bold text-xl text-center mb-4 text-primary">Powers of {n}</h3>
        {renderDataCards(getPowers(n))}
      </div>
    ));

    return (
      <SwipeBack onBack={() => setSelectedNumber(null)}>
        <div>
          {renderHeader(`Powers of ${selectedNumber}`, () => setSelectedNumber(null))}
          <SwipeContainer items={items} currentIndex={selectedNumber - 1} onIndexChange={(i) => setSelectedNumber(i + 1)} />
          <p className="text-center text-muted-foreground text-xs mt-4">Swipe left/right to navigate</p>
        </div>
      </SwipeBack>
    );
  }

  if (activeTopic === 'powers') {
    return (
      <SwipeBack onBack={() => setActiveTopic(null)}>
        <div>
          {renderHeader('Powers', () => setActiveTopic(null))}
          <p className="text-muted-foreground text-sm mb-4 text-center">Select a number (1–200)</p>
          {renderNumberGrid(200, setSelectedNumber)}
        </div>
      </SwipeBack>
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
      <SwipeBack onBack={() => setSelectedRange(null)}>
        <div>
          {renderHeader(topicTitle, () => setSelectedRange(null))}
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
      </SwipeBack>
    );
  }

  if (['squares', 'square-roots', 'cubes', 'cube-roots'].includes(activeTopic || '')) {
    const topicTitle = activeTopic?.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '';
    return (
      <SwipeBack onBack={() => setActiveTopic(null)}>
        <div>
          {renderHeader(topicTitle, () => setActiveTopic(null))}
          <p className="text-muted-foreground text-sm mb-4 text-center">Select a range</p>
          {renderRangeGroups((from, to) => setSelectedRange({ from, to }))}
        </div>
      </SwipeBack>
    );
  }

  // PERCENTAGE - expanded denominator view
  if (activeTopic === 'percentage' && learningState?.expandedDenominator) {
    const d = learningState.expandedDenominator;
    return (
      <SwipeBack onBack={() => updateState({ expandedDenominator: null })}>
        <div>
          {renderHeader(`Multiples of 1/${d}`, () => updateState({ expandedDenominator: null }))}
          <PercentageExpanded denominator={d} />
        </div>
      </SwipeBack>
    );
  }

  // PERCENTAGE - group swipe view
  if (activeTopic === 'percentage') {
    const groupIndex = learningState?.percentageGroup
      ? PERCENTAGE_GROUPS.findIndex(g => g.from === learningState.percentageGroup!.from)
      : 0;

    return (
      <SwipeBack onBack={() => setActiveTopic(null)}>
        <div>
          {renderHeader('Percentage', () => setActiveTopic(null))}
          <PercentageLearning
            groupIndex={groupIndex >= 0 ? groupIndex : 0}
            onGroupIndexChange={(i) => {
              const g = PERCENTAGE_GROUPS[i];
              if (g) updateState({ percentageGroup: { from: g.from, to: g.to } });
            }}
            onExpandFraction={(d) => updateState({ expandedDenominator: d })}
          />
        </div>
      </SwipeBack>
    );
  }

  // TOPIC LIST
  const topicSymbols: Record<Topic, string> = {
    tables: '×',
    squares: 'x²',
    'square-roots': '√',
    cubes: 'x³',
    'cube-roots': '∛',
    powers: '⚡',
    percentage: '%',
  };

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-6 text-glow">Learning</h1>
      <div className="flex flex-col gap-3">
        {topics.map((t, i) => (
          <motion.button
            key={t.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTopic(t.id)}
            className="flex items-center gap-4 w-full bg-card border border-border rounded-2xl px-5 py-4 hover:border-primary transition-colors"
          >
            <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
              {topicSymbols[t.id]}
            </span>
            <span className="font-display font-semibold text-foreground text-base flex-1 text-left">{t.title}</span>
            <span className="text-muted-foreground">›</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default LearningPage;
