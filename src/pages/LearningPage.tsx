import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Grid3x3, Square, Radical, Box, Zap, Percent, ArrowLeft, Target, BookOpen, Flame, Heart } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import DesktopModeToggle from '@/components/DesktopModeToggle';
import Mascot from '@/components/duo/Mascot';
import StatPill from '@/components/duo/StatPill';

import SwipeContainer from '@/components/SwipeContainer';
import SwipeBack from '@/components/SwipeBack';
import PercentageLearning, { PercentageExpanded, PERCENTAGE_GROUPS } from '@/components/PercentageLearning';
import PracticeModeSelector, { type PracticeSettings } from '@/components/PracticeModeSelector';
import FormulasLearning from '@/components/FormulasLearning';
import { getTable, getSquares, getSquareRoots, getCubes, getCubeRoots, getPowers, getExtendedRangeGroups } from '@/lib/mathData';
import type { LearningState } from '@/pages/Index';
import { getStreak } from '@/lib/streak';
import { getXP, levelFromXP } from '@/lib/xp';

type Topic = 'tables' | 'squares' | 'square-roots' | 'cubes' | 'cube-roots' | 'powers' | 'percentage' | 'formulas';

interface LearningPageProps {
  onStartPractice?: (topic: string, context?: { from?: number; to?: number; number?: number }, mode?: 'mcq' | 'input', extras?: { timerEnabled?: boolean; timerSeconds?: number; infinite?: boolean }) => void;
  learningState?: LearningState;
  onLearningStateChange?: (state: LearningState) => void;
}

const topics: { id: Topic; title: string; icon: any; gradient: string }[] = [
  { id: 'tables', title: 'Tables', icon: Grid3x3, gradient: 'gradient-primary' },
  { id: 'squares', title: 'Squares', icon: Square, gradient: 'gradient-success' },
  { id: 'square-roots', title: 'Square Roots', icon: Radical, gradient: 'gradient-primary' },
  { id: 'cubes', title: 'Cubes', icon: Box, gradient: 'gradient-warm' },
  { id: 'cube-roots', title: 'Cube Roots', icon: Box, gradient: 'gradient-primary' },
  { id: 'powers', title: 'Powers', icon: Zap, gradient: 'gradient-success' },
  { id: 'percentage', title: 'Percentage', icon: Percent, gradient: 'gradient-warm' },
  { id: 'formulas', title: 'Formulas', icon: BookOpen, gradient: 'gradient-primary' },
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

  const setActiveTopic = (t: Topic | null) => updateState({ activeTopic: t, selectedNumber: null, selectedRange: null, formulaSectionIndex: null, formulaCategoryIndex: null });
  const setSelectedNumber = (n: number | null) => updateState({ selectedNumber: n });
  const setSelectedRange = (r: { from: number; to: number } | null) => updateState({ selectedRange: r });

  const rangeGroups = getExtendedRangeGroups();

  const handlePracticeSelect = (settings: PracticeSettings) => {
    if (!onStartPractice || !activeTopic) return;
    const ctx: { from?: number; to?: number; number?: number } = {};
    if (selectedNumber) ctx.number = selectedNumber;
    if (selectedRange) { ctx.from = selectedRange.from; ctx.to = selectedRange.to; }
    if (activeTopic === 'percentage') {
      const { expandedDenominator, percentageGroup } = learningState || {};
      if (expandedDenominator) {
        ctx.from = expandedDenominator;
        ctx.to = expandedDenominator;
      } else if (percentageGroup) {
        ctx.from = percentageGroup.from;
        ctx.to = percentageGroup.to;
      }
    }
    onStartPractice(activeTopic, ctx, settings.mode, {
      timerEnabled: settings.timerEnabled,
      timerSeconds: settings.timerSeconds,
      infinite: settings.infinite,
    });
    setShowPracticeMode(false);
  };

  const renderHeader = (title: string, onBack: () => void, showPractice = true) => (
    <div className="flex items-center justify-between mb-4">
      <button onClick={onBack} className="p-2 -ml-2 text-primary">
        <ArrowLeft size={20} />
      </button>
      <h2 className="font-display font-bold text-lg text-foreground">{title}</h2>
      <div className="flex items-center gap-2">
        {showPractice && (
          <button
            onClick={() => setShowPracticeMode(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full gradient-primary text-primary-foreground text-xs font-semibold"
          >
            <Target size={14} />
            Practice
          </button>
        )}
        <ThemeToggle />
        <DesktopModeToggle />
      </div>
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
        {renderDataCards(getTable(n))}
      </div>
    ));

    return (
      <SwipeBack onBack={() => setSelectedNumber(null)}>
        <div>
          {renderHeader(`Table of ${selectedNumber}`, () => setSelectedNumber(null))}
          <SwipeContainer items={items} currentIndex={selectedNumber - 1} onIndexChange={(i) => setSelectedNumber(i + 1)} />
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
        {renderDataCards(getPowers(n))}
      </div>
    ));

    return (
      <SwipeBack onBack={() => setSelectedNumber(null)}>
        <div>
          {renderHeader(`Powers of ${selectedNumber}`, () => setSelectedNumber(null))}
          <SwipeContainer items={items} currentIndex={selectedNumber - 1} onIndexChange={(i) => setSelectedNumber(i + 1)} />
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
          <PercentageExpanded
            denominator={d}
            onDenominatorChange={(newD) => updateState({ expandedDenominator: newD })}
          />
        </div>
      </SwipeBack>
    );
  }

  // PERCENTAGE - group swipe view
  if (activeTopic === 'percentage' && learningState?.percentageGroup) {
    const groupIndex = learningState?.percentageGroup
      ? PERCENTAGE_GROUPS.findIndex(g => g.from === learningState.percentageGroup!.from)
      : 0;

    return (
      <SwipeBack onBack={() => updateState({ percentageGroup: null })}>
        <div>
          {renderHeader(
            learningState.percentageGroup
              ? `1/${learningState.percentageGroup.from} – 1/${learningState.percentageGroup.to}`
              : 'Percentage',
            () => updateState({ percentageGroup: null })
          )}
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

  // PERCENTAGE - group selection grid (entry)
  if (activeTopic === 'percentage') {
    return (
      <SwipeBack onBack={() => setActiveTopic(null)}>
        <div>
          {renderHeader('Percentage', () => setActiveTopic(null))}
          <p className="text-muted-foreground text-sm mb-4 text-center">Select a range</p>
          <div className="grid grid-cols-2 gap-3">
            {PERCENTAGE_GROUPS.map((g, i) => (
              <motion.button
                key={g.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => updateState({ percentageGroup: { from: g.from, to: g.to } })}
                className="bg-card border border-border rounded-xl py-4 text-center font-display font-semibold text-foreground hover:border-primary transition-colors"
              >
                {g.label}
              </motion.button>
            ))}
          </div>
        </div>
      </SwipeBack>
    );
  }

  // FORMULAS
  if (activeTopic === 'formulas') {
    const secIdx = learningState?.formulaSectionIndex ?? null;
    const catIdx = learningState?.formulaCategoryIndex ?? null;

    const handleBack = () => {
      if (catIdx !== null) updateState({ formulaCategoryIndex: null });
      else if (secIdx !== null) updateState({ formulaSectionIndex: null });
      else setActiveTopic(null);
    };

    return (
      <SwipeBack onBack={handleBack}>
        <div>
          {secIdx === null && renderHeader('Formulas', () => setActiveTopic(null), false)}
          <FormulasLearning
            sectionIndex={secIdx}
            categoryIndex={catIdx}
            onNavigate={(s, c) => updateState({ formulaSectionIndex: s, formulaCategoryIndex: c })}
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
    powers: 'xⁿ',
    percentage: '%',
    formulas: 'f(x)',
  };

  const cardTints: Record<Topic, { bg: string; shadow: string }> = {
    tables:        { bg: 'bg-primary text-primary-foreground',     shadow: 'shadow-chunky' },
    squares:       { bg: 'bg-accent text-accent-foreground',       shadow: 'shadow-chunky-accent' },
    'square-roots':{ bg: 'bg-primary text-primary-foreground',     shadow: 'shadow-chunky' },
    cubes:         { bg: 'bg-warning text-warning-foreground',     shadow: 'shadow-chunky-warm' },
    'cube-roots':  { bg: 'bg-accent text-accent-foreground',       shadow: 'shadow-chunky-accent' },
    powers:        { bg: 'bg-warning text-warning-foreground',     shadow: 'shadow-chunky-warm' },
    percentage:    { bg: 'bg-destructive text-destructive-foreground', shadow: 'shadow-chunky-danger' },
    formulas:      { bg: 'bg-primary text-primary-foreground',     shadow: 'shadow-chunky' },
  };

  return (
    <div>
      {/* Top stat bar — Duolingo style */}
      <TopStatBar />

      {/* Mascot welcome bubble */}
      <div className="flex items-end gap-3 mb-5">
        <Mascot size={72} />
        <div className="relative flex-1 bg-card border-2 border-border rounded-2xl px-4 py-3 shadow-chunky">
          <div
            className="absolute -left-2 bottom-4 w-3 h-3 rotate-45 bg-card border-l-2 border-b-2 border-border"
            aria-hidden
          />
          <p className="font-display font-extrabold text-foreground leading-tight">
            Ready to level up?
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Pick a topic and earn XP!</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-extrabold text-lg uppercase tracking-wide text-foreground">Topics</h2>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DesktopModeToggle />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pb-6">
        {topics.map((t, i) => {
          const tint = cardTints[t.id];
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.28, ease: 'easeOut' }}
              onClick={() => setActiveTopic(t.id)}
              className={`press-chunky relative overflow-hidden flex flex-col items-center justify-center gap-2 aspect-square w-full rounded-3xl border-b-0 ${tint.bg} ${tint.shadow}`}
            >
              <span className="font-display font-black text-3xl leading-none drop-shadow-[0_2px_0_rgba(0,0,0,0.15)]">
                {topicSymbols[t.id]}
              </span>
              <span className="font-display font-extrabold text-sm uppercase tracking-wide text-center">
                {t.title}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

const TopStatBar = () => {
  const [streak, setStreak] = useState(() => getStreak().current);
  const [xp, setXp] = useState(() => getXP().xp);
  const [hearts] = useState(5);

  useEffect(() => {
    const refresh = () => {
      setStreak(getStreak().current);
      setXp(getXP().xp);
    };
    window.addEventListener('streak-updated', refresh);
    window.addEventListener('xp-updated', refresh);
    return () => {
      window.removeEventListener('streak-updated', refresh);
      window.removeEventListener('xp-updated', refresh);
    };
  }, []);

  return (
    <div className="flex items-center justify-between gap-2 mb-5">
      <div>
        <h1 className="font-display font-black text-2xl text-foreground leading-none">Math Quest</h1>
        <p className="text-[11px] text-muted-foreground font-display font-bold uppercase tracking-wider mt-0.5">
          Level {levelFromXP(xp)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatPill icon={Flame} value={streak} color="warning" />
        <StatPill icon={Zap} value={xp} color="primary" />
        <StatPill icon={Heart} value={hearts} color="destructive" />
      </div>
    </div>
  );
};

export default LearningPage;
