import { useEffect, useState, lazy, Suspense } from 'react';
import { m as motion } from 'framer-motion';
import { Zap, ArrowLeft, Dumbbell, BookOpen, Flame, Heart, Crown } from 'lucide-react';
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
import { TOPIC_ICON_MAP, type LearningTopicId } from '@/lib/topicIcons';

type Topic = 'tables' | 'squares' | 'square-roots' | 'cubes' | 'cube-roots' | 'powers' | 'percentage' | 'formulas' | 'periodic-table';

interface LearningPageProps {
  onBack?: () => void;
  onStartPractice?: (topic: string, context?: { from?: number; to?: number; number?: number }, mode?: 'mcq' | 'input', extras?: { timerEnabled?: boolean; timerSeconds?: number; infinite?: boolean }) => void;
  learningState?: LearningState;
  onLearningStateChange?: (state: LearningState) => void;
}

const topics: { id: LearningTopicId; title: string }[] = [
  { id: 'tables', title: 'Tables' },
  { id: 'squares', title: 'Squares' },
  { id: 'square-roots', title: 'Square Roots' },
  { id: 'cubes', title: 'Cubes' },
  { id: 'cube-roots', title: 'Cube Roots' },
  { id: 'powers', title: 'Powers' },
  { id: 'percentage', title: 'Percentage' },
  { id: 'formulas', title: 'Formulas' },
  { id: 'periodic-table', title: 'Periodic Table' },
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
    <div className="app-topbar-page flex items-center justify-between gap-2" data-app-topbar>
      <button onClick={goBack} className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full text-primary" aria-label="Back">
        <ArrowLeft size={16} />
      </button>
      <h2 className="min-w-0 flex-1 text-center font-display font-bold text-sm text-foreground sm:text-base truncate">{title}</h2>
      <div className="flex items-center gap-1.5 shrink-0">
        {showPractice && (
          <button
            onClick={() => setShowPracticeMode(true)}
            className="h-7 inline-flex items-center gap-1 px-2 rounded-full gradient-primary text-primary-foreground text-[10px] font-semibold"
          >
            <Dumbbell size={12} />
            Practice
          </button>
        )}
        <ThemeToggle compact />
        <DesktopModeToggle compact />
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
      let data: { expression: string; answer: number; approximate?: boolean; exponent?: number }[];
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
  return (
    <div>
      <TopStatBar />

      <section className="mb-5 rounded-[1.35rem] border border-border/70 bg-card/75 p-4 sm:p-5 shadow-[var(--ds-shadow-card)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">Study dashboard</p>
            <h2 className="mt-1 font-display text-xl font-black tracking-tight text-foreground sm:text-2xl">
              Learn at your pace.
            </h2>
            <p className="mt-1 max-w-md text-sm leading-5 text-muted-foreground">
              Explore a topic, build your fundamentals, then practice when you are ready.
            </p>
          </div>
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
            <BookOpen size={20} strokeWidth={2.4} />
          </div>
        </div>
      </section>

      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black tracking-tight text-foreground sm:text-xl">Topics</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Choose a module to begin learning.</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DesktopModeToggle />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pb-6 animate-fade-in sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {topics.map((t, index) => {
          const { icon: TopicIcon, toneClass } = TOPIC_ICON_MAP[t.id];
          return (
            <motion.button
              key={t.id}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.035, duration: 0.24 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => setActiveTopic(t.id)}
              aria-label={`Open ${t.title} learning topic`}
              className="group relative flex min-h-[132px] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[1.15rem] border border-border/70 bg-card/80 px-3.5 py-4 text-center shadow-[var(--ds-shadow-card)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card hover:shadow-[var(--ds-shadow-elevated)] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0"
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-accent/[0.05] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/40 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)] backdrop-blur-sm transition-all duration-200 group-hover:border-primary/25 group-hover:bg-primary/[0.08] group-hover:-translate-y-px ${toneClass}`}>
                {TOPIC_ICON_MAP[t.id].symbol ? (
                  <span className="font-display text-lg font-black leading-none" aria-hidden="true">
                    {TOPIC_ICON_MAP[t.id].symbol}
                  </span>
                ) : TOPIC_ICON_MAP[t.id].icon ? (
                  <>
                    <TopicIcon size={20} strokeWidth={2.25} aria-hidden="true" />
                    {TOPIC_ICON_MAP[t.id].badge && (
                      <span className="absolute -right-0.5 -top-1 rounded-sm bg-background px-0.5 font-display text-[8px] font-black leading-none text-foreground" aria-hidden="true">
                        {TOPIC_ICON_MAP[t.id].badge}
                      </span>
                    )}
                  </>
                ) : null}
              </span>
              <span className="relative max-w-full text-balance font-display text-[13px] font-semibold leading-[1.15] tracking-[0.01em] text-foreground sm:text-sm">
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
    <div className="app-topbar-stats flex items-center justify-between gap-2" data-app-topbar>
      <div>
        <h1 className="font-display font-black text-base text-foreground leading-none">Math Master</h1>
        <p className="text-[9px] text-muted-foreground font-display font-bold uppercase tracking-wider mt-px leading-none">
          Level {levelFromXP(xp)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatPill compact icon={Flame} value={streak} color="warning" />
        <StatPill compact icon={Zap} value={xp} color="primary" />
        <StatPill compact icon={Heart} value={hearts} color="destructive" />
      </div>
    </div>
  );
};

export default LearningPage;
