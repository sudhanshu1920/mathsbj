import { useEffect, useState, lazy, Suspense } from 'react';
import { m as motion } from 'framer-motion';
import { Grid3x3, Square, Radical, Box, Zap, Percent, ArrowLeft, Target, BookOpen, Flame, Heart, Atom, Crown } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import DesktopModeToggle from '@/components/DesktopModeToggle';
import StatPill from '@/components/duo/StatPill';
import { Switch } from '@/components/ui/switch';
import { getTablesProMode, setTablesProMode } from '@/lib/settings';

import SwipeContainer from '@/components/SwipeContainer';
import SwipeBack from '@/components/SwipeBack';
import PercentageLearning, { PercentageExpanded, PERCENTAGE_GROUPS } from '@/components/PercentageLearning';
import PracticeModeSelector, { type PracticeSettings } from '@/components/PracticeModeSelector';
const FormulasLearning = lazy(() => import('@/components/FormulasLearning'));
import { getTable, getSquares, getSquareRoots, getCubes, getCubeRoots, getPowers, getExtendedRangeGroups } from '@/lib/mathData';
import type { LearningState } from '@/pages/Index';
const PeriodicTableLearning = lazy(() => import('@/components/PeriodicTableLearning'));
import { getStreak } from '@/lib/streak';
import { getXP, levelFromXP } from '@/lib/xp';

type Topic = 'tables' | 'squares' | 'square-roots' | 'cubes' | 'cube-roots' | 'powers' | 'percentage' | 'formulas' | 'periodic-table';

interface LearningPageProps {
  onBack?: () => void;
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
  { id: 'periodic-table', title: 'Periodic Table', icon: Atom, gradient: 'gradient-success' },
];

const LearningPage = ({ onBack, onStartPractice, learningState, onLearningStateChange }: LearningPageProps) => {
  const activeTopic = (learningState?.activeTopic as Topic | null) ?? null;
  const selectedNumber = learningState?.selectedNumber ?? null;
  const selectedRange = learningState?.selectedRange ?? null;
  const periodicSelectedElement = learningState?.periodicSelectedElement ?? null;
  const [showPracticeMode, setShowPracticeMode] = useState(false);
  const [proMode, setProModeState] = useState<boolean>(() => getTablesProMode());

  useEffect(() => {
    const sync = () => setProModeState(getTablesProMode());
    window.addEventListener('tables-pro-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tables-pro-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggleProMode = (v: boolean) => {
    setTablesProMode(v);
    setProModeState(v);
  };

  const updateState = (partial: Partial<LearningState>) => {
    if (onLearningStateChange && learningState) {
      onLearningStateChange({ ...learningState, ...partial });
    }
  };

  const setActiveTopic = (t: Topic | null) => updateState({ activeTopic: t, selectedNumber: null, selectedRange: null, formulaSectionIndex: null, formulaCategoryIndex: null, periodicSelectedElement: null });
  const setSelectedElement = (n: number | null) => updateState({ periodicSelectedElement: n });
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

  const renderHeader = (title: string, localBack: () => void, showPractice = true) => {
    const goBack = onBack ?? localBack;
    return (
    <div className="flex items-center justify-between mb-4">
      <button onClick={goBack} className="p-2 -ml-2 text-primary">
        <ArrowLeft size={20} />
      </button>
      <h2 className="font-display font-bold text-lg text-foreground">{title}</h2>
      <div className="flex items-center gap-2">
        {showPractice && (
          <button
            onClick={() => {
              if (activeTopic === 'periodic-table') onStartPractice?.(activeTopic);
              else setShowPracticeMode(true);
            }}
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
  };

  const renderDataCards = (items: { expression: string; answer: number; exponent?: number; approximate?: boolean }[]) => (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-card rounded-xl px-5 py-3 flex items-center justify-center text-center border border-border"
        >
          <span className="text-foreground text-base">
            {item.expression}
            {item.exponent !== undefined && <sup className="text-primary font-bold">{item.exponent}</sup>}
            {item.approximate ? ' ≈ ' : ' = '}
            <span className="font-bold text-primary text-lg">{item.answer.toLocaleString()}</span>
          </span>
        </div>
      ))}
    </div>
  );

  const renderNumberGrid = (max: number, onSelect: (n: number) => void) => (
    <div className="grid grid-cols-5 gap-2 perf-list">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          onClick={() => onSelect(n)}
          className="bg-card border border-border rounded-xl py-3 text-center font-display font-semibold text-foreground hover:border-primary/60 active:scale-95"
        >
          {n}
        </button>
      ))}
    </div>
  );

  const renderRangeGroups = (onSelect: (from: number, to: number) => void) => (
    <div className="grid grid-cols-2 gap-3">
      {rangeGroups.map((g, i) => (
        <button
          key={g.label}
          onClick={() => onSelect(g.from, g.to)}
          className="glass-panel rounded-xl py-4 text-center font-display font-semibold text-foreground hover:border-primary/60 active:scale-[0.97]"
        >
          {g.label}
        </button>
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

  // PERIODIC TABLE
  if (activeTopic === 'periodic-table') {
    return (
      <SwipeBack onBack={() => {
        if (onBack) onBack();
        else if (periodicSelectedElement) setSelectedElement(null);
        else setActiveTopic(null);
      }}>
        <div>
          {renderHeader('Periodic Table', () => {
            if (periodicSelectedElement) setSelectedElement(null);
            else setActiveTopic(null);
          })}
          <Suspense fallback={<div className="py-16 text-center text-sm font-semibold text-muted-foreground">Loading Periodic Table…</div>}>
            <PeriodicTableLearning
              selectedElement={periodicSelectedElement}
              onSelectElement={(n) => setSelectedElement(n)}
            />
          </Suspense>
        </div>
      </SwipeBack>
    );
  }

  // TABLES
  if (activeTopic === 'tables' && selectedNumber) {
    return (
      <SwipeBack onBack={() => {
        if (onBack) onBack();
        else setSelectedNumber(null);
      }}>
        <div>
          {renderHeader(`Table of ${selectedNumber}`, () => setSelectedNumber(null))}
          <SwipeContainer
            itemCount={200}
            currentIndex={selectedNumber - 1}
            onIndexChange={(i) => setSelectedNumber(i + 1)}
            renderItem={(index) => renderDataCards(getTable(index + 1, proMode ? 20 : 10))}
          />
        </div>
      </SwipeBack>
    );
  }

  if (activeTopic === 'tables') {
    return (
      <SwipeBack onBack={() => {
        if (onBack) onBack();
        else setActiveTopic(null);
      }}>
        <div>
          {renderHeader('Tables', () => setActiveTopic(null))}
          <div className={`glass-panel rounded-2xl px-4 py-3 mb-4 flex items-center justify-between ${proMode ? 'shadow-[0_0_0_1px_hsl(var(--primary)/0.6),0_0_24px_hsl(var(--primary)/0.35)]' : ''}`}>
            <div className="flex items-center gap-2">
              <Crown size={18} className={proMode ? 'text-primary' : 'text-muted-foreground'} />
              <div className="leading-tight">
                <p className="font-display font-extrabold text-sm uppercase tracking-wider text-foreground">Pro Mode</p>
                <p className="text-[11px] text-muted-foreground">{proMode ? '×1 – ×20 per table' : '×1 – ×10 per table'}</p>
              </div>
            </div>
            <Switch checked={proMode} onCheckedChange={toggleProMode} />
          </div>
          <p className="text-muted-foreground text-sm mb-4 text-center">Select a number (1–200)</p>
          {renderNumberGrid(200, setSelectedNumber)}
        </div>
      </SwipeBack>
    );
  }

  // POWERS
  if (activeTopic === 'powers' && selectedNumber) {
    return (
      <SwipeBack onBack={() => setSelectedNumber(null)}>
        <div>
          {renderHeader(`Powers of ${selectedNumber}`, () => setSelectedNumber(null))}
          <SwipeContainer
            itemCount={200}
            currentIndex={selectedNumber - 1}
            onIndexChange={(i) => setSelectedNumber(i + 1)}
            renderItem={(index) => renderDataCards(getPowers(index + 1))}
          />
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
      <SwipeBack onBack={() => {
        if (onBack) onBack();
        else setSelectedRange(null);
      }}>
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
      <SwipeBack onBack={() => {
        if (onBack) onBack();
        else updateState({ expandedDenominator: null });
      }}>
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
      <SwipeBack onBack={() => {
        if (onBack) onBack();
        else updateState({ percentageGroup: null });
      }}>
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
      <SwipeBack onBack={() => onBack?.() ?? handleBack()}>
        <div>
          {secIdx === null && renderHeader('Formulas', () => setActiveTopic(null), false)}
          <Suspense fallback={<div className="h-40" />}>
            <FormulasLearning
              sectionIndex={secIdx}
              categoryIndex={catIdx}
              onNavigate={(s, c) => updateState({ formulaSectionIndex: s, formulaCategoryIndex: c })}
            />
          </Suspense>
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
    'periodic-table': '⚛',
  };

  const cardTints: Record<Topic, { glow: string; text: string }> = {
    // Resting glow + hover glow + press glow so the neon effect shows on touch too
    tables:        { glow: 'shadow-[0_0_18px_-6px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.6),0_0_28px_hsl(var(--primary)/0.35)] active:shadow-[0_0_0_1px_hsl(var(--primary)/0.75),0_0_34px_hsl(var(--primary)/0.5)]',  text: 'text-primary' },
    squares:       { glow: 'shadow-[0_0_18px_-6px_hsl(var(--accent)/0.28)] hover:shadow-[0_0_0_1px_hsl(var(--accent)/0.6),0_0_28px_hsl(var(--accent)/0.30)] active:shadow-[0_0_0_1px_hsl(var(--accent)/0.75),0_0_34px_hsl(var(--accent)/0.45)]',  text: 'text-accent' },
    'square-roots':{ glow: 'shadow-[0_0_18px_-6px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.6),0_0_28px_hsl(var(--primary)/0.35)] active:shadow-[0_0_0_1px_hsl(var(--primary)/0.75),0_0_34px_hsl(var(--primary)/0.5)]',  text: 'text-primary' },
    cubes:         { glow: 'shadow-[0_0_18px_-6px_hsl(var(--warning)/0.28)] hover:shadow-[0_0_0_1px_hsl(var(--warning)/0.6),0_0_28px_hsl(var(--warning)/0.30)] active:shadow-[0_0_0_1px_hsl(var(--warning)/0.75),0_0_34px_hsl(var(--warning)/0.45)]',  text: 'text-warning' },
    'cube-roots':  { glow: 'shadow-[0_0_18px_-6px_hsl(var(--accent)/0.28)] hover:shadow-[0_0_0_1px_hsl(var(--accent)/0.6),0_0_28px_hsl(var(--accent)/0.30)] active:shadow-[0_0_0_1px_hsl(var(--accent)/0.75),0_0_34px_hsl(var(--accent)/0.45)]',  text: 'text-accent' },
    powers:        { glow: 'shadow-[0_0_18px_-6px_hsl(var(--warning)/0.28)] hover:shadow-[0_0_0_1px_hsl(var(--warning)/0.6),0_0_28px_hsl(var(--warning)/0.30)] active:shadow-[0_0_0_1px_hsl(var(--warning)/0.75),0_0_34px_hsl(var(--warning)/0.45)]',  text: 'text-warning' },
    percentage:    { glow: 'shadow-[0_0_18px_-6px_hsl(var(--destructive)/0.28)] hover:shadow-[0_0_0_1px_hsl(var(--destructive)/0.6),0_0_28px_hsl(var(--destructive)/0.30)] active:shadow-[0_0_0_1px_hsl(var(--destructive)/0.75),0_0_34px_hsl(var(--destructive)/0.45)]', text: 'text-destructive' },
    formulas:      { glow: 'shadow-[0_0_18px_-6px_hsl(var(--accent)/0.28)] hover:shadow-[0_0_0_1px_hsl(var(--accent)/0.6),0_0_28px_hsl(var(--accent)/0.30)] active:shadow-[0_0_0_1px_hsl(var(--accent)/0.75),0_0_34px_hsl(var(--accent)/0.45)]',  text: 'text-accent' },
    'periodic-table': { glow: 'shadow-[0_0_18px_-6px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.6),0_0_28px_hsl(var(--primary)/0.35)] active:shadow-[0_0_0_1px_hsl(var(--primary)/0.75),0_0_34px_hsl(var(--primary)/0.5)]', text: 'text-primary' },
  };

  return (
    <div>
      {/* Top stat bar — Duolingo style */}
      <TopStatBar />

      {/* HUD welcome strip */}
      <div className="glass-panel rounded-2xl px-4 py-3 mb-5 flex items-center justify-between">
        <div>
          <p className="font-display font-extrabold text-foreground leading-tight tracking-wide neon-text">
            READY PLAYER
          </p>
          <p className="text-[11px] text-muted-foreground font-display font-bold uppercase tracking-wider mt-0.5">
            Select a module to engage
          </p>
        </div>
        <span className="font-display font-black text-primary text-2xl neon-text">⌁</span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-extrabold text-lg uppercase tracking-wide text-foreground">Topics</h2>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DesktopModeToggle />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pb-6 animate-fade-in">
        {topics.map((t) => {
          const tint = cardTints[t.id];
          return (
            <button
              key={t.id}
              onClick={() => setActiveTopic(t.id)}
              className={`glass-panel relative overflow-hidden flex flex-col items-center justify-center gap-2 aspect-square w-full rounded-3xl active:scale-[0.97] ${tint.glow} ${tint.text}`}
            >
              <span className="font-display font-black text-4xl leading-none neon-text">
                {topicSymbols[t.id]}
              </span>
              <span className="font-display font-extrabold text-sm uppercase tracking-wider text-center text-foreground">
                {t.title}
              </span>
            </button>
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
