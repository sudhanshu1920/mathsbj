import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Atom, Check, Circle, MoreVertical, X } from 'lucide-react';
import { m as motion } from 'framer-motion';
import type { ChemElement } from '@/lib/periodicTable';
import { CATEGORY_LABEL, ELEMENTS, formatMass } from '@/lib/periodicTable';
import {
  getAdjacentPeriodicRangeIndex,
  getPeriodicSwipeDirection,
  isValidPeriodicRangeIndex,
  PERIODIC_GROUPS,
} from '@/lib/periodicRangeNavigation';

interface PeriodicTableLearningProps {
  selectedElement: number | null;
  onSelectElement: (number: number | null) => void;
}

type AtomicMassMode = 'exact' | 'round';

const CATEGORY_STYLES: Record<ChemElement['category'], string> = {
  'alkali-metal': 'border-rose-400/60 bg-rose-500/10 hover:bg-rose-500/20',
  'alkaline-earth': 'border-orange-400/60 bg-orange-500/10 hover:bg-orange-500/20',
  'transition-metal': 'border-sky-400/60 bg-sky-500/10 hover:bg-sky-500/20',
  'post-transition': 'border-emerald-400/60 bg-emerald-500/10 hover:bg-emerald-500/20',
  metalloid: 'border-violet-400/60 bg-violet-500/10 hover:bg-violet-500/20',
  nonmetal: 'border-lime-400/60 bg-lime-500/10 hover:bg-lime-500/20',
  halogen: 'border-cyan-400/60 bg-cyan-500/10 hover:bg-cyan-500/20',
  'noble-gas': 'border-pink-400/60 bg-pink-500/10 hover:bg-pink-500/20',
  lanthanide: 'border-amber-400/60 bg-amber-500/10 hover:bg-amber-500/20',
  actinide: 'border-red-400/60 bg-red-500/10 hover:bg-red-500/20',
  unknown: 'border-slate-400/60 bg-slate-500/10 hover:bg-slate-500/20',
};

const CATEGORY_DOTS: Record<ChemElement['category'], string> = {
  'alkali-metal': 'bg-rose-400',
  'alkaline-earth': 'bg-orange-400',
  'transition-metal': 'bg-sky-400',
  'post-transition': 'bg-emerald-400',
  metalloid: 'bg-violet-400',
  nonmetal: 'bg-lime-400',
  halogen: 'bg-cyan-400',
  'noble-gas': 'bg-pink-400',
  lanthanide: 'bg-amber-400',
  actinide: 'bg-red-400',
  unknown: 'bg-slate-400',
};

const MAIN_ROWS = Array.from({ length: 7 }, (_, i) => i + 1);
const GROUPS = Array.from({ length: 18 }, (_, i) => i + 1);
const PERIODIC_CELL_SIZE = 76;
const PERIODIC_LABEL_WIDTH = 48;
const PERIODIC_GRID_GAP = 4;
const PERIODIC_GRID_WIDTH =
  PERIODIC_LABEL_WIDTH +
  GROUPS.length * PERIODIC_CELL_SIZE +
  GROUPS.length * PERIODIC_GRID_GAP;

const periodicGridStyle = {
  gridTemplateColumns: `${PERIODIC_LABEL_WIDTH}px repeat(${GROUPS.length}, ${PERIODIC_CELL_SIZE}px)`,
  gap: `${PERIODIC_GRID_GAP}px`,
  width: `${PERIODIC_GRID_WIDTH}px`,
  minWidth: `${PERIODIC_GRID_WIDTH}px`,
  maxWidth: 'none',
};
const F_BLOCK_ROWS = [
  { ypos: 9, label: 'Lanthanides', range: '57–71' },
  { ypos: 10, label: 'Actinides', range: '89–103' },
] as const;

const MAIN_ELEMENT_BY_POSITION = new Map(
  ELEMENTS
    .filter((el) => el.ypos <= 7)
    .map((el) => [`${el.ypos}-${el.xpos}`, el] as const)
);

const F_ELEMENT_BY_POSITION = new Map(
  ELEMENTS
    .filter((el) => el.ypos >= 9)
    .map((el) => [`${el.ypos}-${el.xpos}`, el] as const)
);

const findMainElement = (period: number, group: number) =>
  MAIN_ELEMENT_BY_POSITION.get(`${period}-${group}`);

const ElementCell = ({ el, compact = false, massMode = 'exact', onClick }: { el: ChemElement; compact?: boolean; massMode?: AtomicMassMode; onClick: () => void }) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.96 }}
    whileHover={{ y: -1 }}
    onClick={onClick}
    aria-label={`${el.name}, atomic number ${el.number}`}
    title={`${el.name} (${el.symbol})`}
    className={`periodic-element-cell relative aspect-square h-[76px] min-w-[76px] rounded-lg max-w-none shrink-0 border p-1.5 text-left transition-all ${CATEGORY_STYLES[el.category]} hover:shadow-[0_0_18px_hsl(var(--primary)/0.15)] ${compact ? 'h-[76px] min-w-[76px] max-w-none shrink-0' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background`}
  >
    <span className="absolute left-1.5 top-1 text-[9px] font-bold text-muted-foreground">{el.number}</span>
    <span className="absolute right-1.5 top-1 text-[9px] font-semibold text-muted-foreground">{formatMass(el, massMode)}</span>
    <div className="flex h-full flex-col items-center justify-end pb-1">
      <span className="font-display text-[22px] sm:text-[24px] font-black leading-none text-foreground">{el.symbol}</span>
      <span className="mt-1 w-full truncate text-center text-[9px] sm:text-[10px] font-bold leading-tight text-foreground" title={el.name}>{el.name}</span>
    </div>
  </motion.button>
);

const FPlaceholder = ({ text, label }: { text: string; label: string }) => (
  <div className="periodic-table-placeholder flex aspect-square h-[76px] min-w-[76px] max-w-none shrink-0 items-center justify-center rounded-lg border border-dashed border-primary/25 bg-primary/5 px-1 text-center">
    <div>
      <div className="text-[9px] font-black uppercase tracking-wide text-primary">{label}</div>
      <div className="mt-1 text-[10px] font-semibold leading-tight text-muted-foreground">{text}</div>
    </div>
  </div>
);

const Legend = () => {
  const visibleCategories = [
    'alkali-metal', 'alkaline-earth', 'transition-metal', 'post-transition',
    'metalloid', 'nonmetal', 'halogen', 'noble-gas', 'lanthanide', 'actinide', 'unknown',
  ] as ChemElement['category'][];
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-border/45 px-1 pt-3">
      {visibleCategories.map((category) => (
        <div key={category} className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
          <span className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOTS[category]}`} />
          {CATEGORY_LABEL[category]}
        </div>
      ))}
    </div>
  );
};

const PeriodicRangeMenu = ({
  selectedRangeIndex,
  onSelectRange,
  onClose,
}: {
  selectedRangeIndex: number | null;
  onSelectRange: (index: number) => void;
  onClose: () => void;
}) => (
  <div
    className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] border border-border/70 bg-popover/95 p-3 shadow-xl backdrop-blur-md"
    role="dialog"
    aria-label="Element ranges"
  >
    <div className="mb-2 flex items-start justify-between gap-2">
      <div>
        <p className="font-display text-xs font-black uppercase tracking-wider text-foreground">Element Range</p>
        <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">Choose a range to open its study chart.</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close element range menu"
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X size={15} />
      </button>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {PERIODIC_GROUPS.map(({ from, to }, index) => {
        const active = selectedRangeIndex === index;
        return (
          <button
            key={`${from}-${to}`}
            type="button"
            onClick={() => onSelectRange(index)}
            aria-pressed={active}
            className={`min-h-12 rounded-xl border px-2 py-2 text-left transition-all hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active
                ? 'gradient-primary border-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'bg-secondary/70 text-foreground'
            }`}
          >
            <span className="block font-display text-sm font-black">{from}–{to}</span>
            <span className={`mt-0.5 block text-[9px] font-bold uppercase tracking-wider ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              {to - from + 1} elements
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

const PeriodicRangeView = ({
  rangeIndex,
  onSelectElement,
  onChangeRange,
  onBackToGroups,
  massMode,
}: {
  rangeIndex: number;
  onSelectElement: (number: number) => void;
  onChangeRange: (index: number) => void;
  onBackToGroups: () => void;
  massMode: AtomicMassMode;
}) => {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const group = PERIODIC_GROUPS[rangeIndex] || PERIODIC_GROUPS[0];
  const elements = useMemo(() => ELEMENTS.slice(group.from - 1, group.to), [group.from, group.to]);
  const hasPrevious = getAdjacentPeriodicRangeIndex(rangeIndex, 'previous') !== rangeIndex;
  const hasNext = getAdjacentPeriodicRangeIndex(rangeIndex, 'next') !== rangeIndex;

  const resetPointer = () => {
    pointerStartRef.current = null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const direction = getPeriodicSwipeDirection(dx, dy);

    resetPointer();

    if (direction === 'next' && hasNext) {
      onChangeRange(getAdjacentPeriodicRangeIndex(rangeIndex, 'next'));
    } else if (direction === 'previous' && hasPrevious) {
      onChangeRange(getAdjacentPeriodicRangeIndex(rangeIndex, 'previous'));
    }
  };

  return (
    <div
      data-swipe-ignore-back="true"
      className="w-full touch-pan-y select-none"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={() => { resetPointer(); }}
      aria-label={`Periodic Table elements ${group.from} to ${group.to}`}
    >
      <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <button
          type="button"
          onClick={() => onChangeRange(getAdjacentPeriodicRangeIndex(rangeIndex, 'previous'))}
          disabled={!hasPrevious}
          className="rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Prev
        </button>
        <div className="text-center">
          <h3 className="font-display text-lg font-black text-foreground">Elements {group.from}–{group.to}</h3>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{rangeIndex + 1}/{PERIODIC_GROUPS.length}</p>
        </div>
        <button
          type="button"
          onClick={() => onChangeRange(getAdjacentPeriodicRangeIndex(rangeIndex, 'next'))}
          disabled={!hasNext}
          className="rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </div>
      <div className="mb-3 flex justify-center">
        <button
          type="button"
          onClick={onBackToGroups}
          className="rounded-full bg-primary/10 px-3 py-1.5 text-[10px] font-bold text-primary hover:bg-primary/15"
        >
          ← Full Periodic Table
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">
        {elements.map((el) => (
          <ElementCell
            key={el.number}
            el={el}
            massMode={massMode}
            onClick={() => onSelectElement(el.number)}
          />
        ))}
      </div>

      <Legend />
    </div>
  );
};

const ElementDetails = ({ element, massMode, onBack, onClose }: { element: ChemElement; massMode: AtomicMassMode; onBack: () => void; onClose: () => void }) => {
  const facts = useMemo(() => [
    ['Atomic Number', String(element.number)],
    ['Symbol', element.symbol],
    ['Element Name', element.name],
    ['Atomic Mass', formatMass(element, massMode)],
    ['Group', element.group === null ? '— (f-block)' : String(element.group)],
    ['Period', String(element.period)],
    ['Block', `${element.block}-block`],
    ['Category', CATEGORY_LABEL[element.category]],
    ['State', element.state],
    ['Radioactive', element.radioactive ? 'Yes' : 'No'],
    ['Electron Configuration', element.config],
  ], [element, massMode]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 backdrop-blur-md">
      <div className="mx-auto min-h-screen w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="sticky top-0 z-10 mb-4 flex items-center justify-between rounded-2xl border border-border bg-card/90 px-2 py-2 backdrop-blur">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
            <ArrowLeft size={18} /> Back to Table
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-[0_0_40px_hsl(var(--primary)/0.12)]">
          <div className="grid gap-5 p-5 sm:grid-cols-[180px_1fr] sm:p-7">
            <div className={`flex min-h-[190px] flex-col items-center justify-center rounded-2xl border-2 ${CATEGORY_STYLES[element.category]}`}>
              <span className="self-start px-4 pt-3 text-sm font-bold text-muted-foreground">{element.number}</span>
              <span className="font-display text-7xl font-black leading-none text-foreground">{element.symbol}</span>
              <span className="mt-2 text-center text-lg font-extrabold text-foreground">{element.name}</span>
              <span className="mt-2 rounded-full bg-background/50 px-3 py-1 text-sm font-bold text-primary">{formatMass(element, massMode)}</span>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-xl bg-primary/10 p-2 text-primary"><Atom size={20} /></div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Element Details</p>
                  <h3 className="font-display text-2xl font-black text-foreground">{element.name}</h3>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {facts.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border bg-background/50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 break-words text-sm font-bold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-4 flex justify-center">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground hover:bg-secondary/80">
            <ArrowLeft size={16} /> Return to Periodic Table
          </button>
        </div>
      </div>
    </div>
  );
};

const PeriodicTableLearning = ({ selectedElement, onSelectElement }: PeriodicTableLearningProps) => {
  const morePressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedRangeIndex, setSelectedRangeIndex] = useState<number | null>(null);
  const [massMode, setMassMode] = useState<AtomicMassMode>('exact');
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [massMenuOpen, setMassMenuOpen] = useState(false);
  const [longPressTriggered, setLongPressTriggered] = useState(false);

  const clearMorePressTimer = () => {
    if (morePressTimerRef.current) {
      clearTimeout(morePressTimerRef.current);
      morePressTimerRef.current = null;
    }
  };

  const handleMorePointerDown = () => {
    clearMorePressTimer();
    setLongPressTriggered(false);
    morePressTimerRef.current = setTimeout(() => {
      setRangeMenuOpen(false);
      setLongPressTriggered(true);
      setMassMenuOpen(true);
    }, 550);
  };

  const handleMorePointerUp = () => {
    clearMorePressTimer();
  };

  useEffect(() => () => {
    if (morePressTimerRef.current) {
      clearTimeout(morePressTimerRef.current);
      morePressTimerRef.current = null;
    }
  }, []);

  const handleMoreClick = () => {
    if (longPressTriggered) {
      setLongPressTriggered(false);
      return;
    }
    setMassMenuOpen(false);
    setRangeMenuOpen((open) => !open);
  };

  const handleRangeChange = (index: number) => {
    if (!isValidPeriodicRangeIndex(index)) return;
    setSelectedRangeIndex(index);
    setRangeMenuOpen(false);
  };
  const handleBackToFullTable = () => {
    setSelectedRangeIndex(null);
    setRangeMenuOpen(false);
  };
  const selected = selectedElement ? ELEMENTS[selectedElement - 1] : undefined;

  return (
    <div className="pb-6">
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><Atom size={19} /></div>
          <div>
            <h2 className="font-display text-lg font-black text-foreground">Periodic Table</h2>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {selectedRangeIndex !== null
                ? `Elements ${PERIODIC_GROUPS[selectedRangeIndex].from}–${PERIODIC_GROUPS[selectedRangeIndex].to} • ${massMode === 'exact' ? 'Exact mass' : 'Round mass'}`
                : `18 groups • 7 periods • 118 elements • ${massMode === 'exact' ? 'Exact mass' : 'Round mass'}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onPointerDown={handleMorePointerDown}
          onPointerUp={handleMorePointerUp}
          onPointerCancel={handleMorePointerUp}
          onPointerLeave={handleMorePointerUp}
          onClick={handleMoreClick}
          onContextMenu={(event) => {
            event.preventDefault();
            setRangeMenuOpen(false);
            setLongPressTriggered(true);
            setMassMenuOpen(true);
          }}
          aria-label="Open element range menu; long press for atomic mass format"
          title="Choose element range • Long press for atomic mass format"
          aria-expanded={rangeMenuOpen || massMenuOpen}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-secondary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            rangeMenuOpen || massMenuOpen ? 'border-primary bg-primary/10 text-primary' : ''
          }`}
        >
          <MoreVertical size={19} />
        </button>

        {rangeMenuOpen && (
          <PeriodicRangeMenu
            selectedRangeIndex={selectedRangeIndex}
            onSelectRange={handleRangeChange}
            onClose={() => setRangeMenuOpen(false)}
          />
        )}

        {massMenuOpen && (
          <div className="absolute right-0 top-full z-40 mt-2 w-56 border border-border bg-popover p-2 shadow-xl backdrop-blur-md" role="dialog" aria-label="Atomic mass format">
            <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Atomic Mass</p>
            {(['exact', 'round'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setMassMode(mode); setMassMenuOpen(false); setLongPressTriggered(false); }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold text-foreground hover:bg-secondary"
                aria-pressed={massMode === mode}
              >
                <span>{mode === 'exact' ? 'Exact' : 'Round Figure'}</span>
                {massMode === mode && <span className="text-primary">✓</span>}
              </button>
            ))}
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold leading-relaxed text-muted-foreground">Long press the 3-dot button to change this format.</p>
          </div>
        )}

      </div>

      {selectedRangeIndex !== null ? (
        <section className="periodic-chart-workspace w-full border-y border-border/40 bg-gradient-to-b from-primary/[0.02] via-background/[0.04] to-primary/[0.01] py-2">
          <PeriodicRangeView
            rangeIndex={selectedRangeIndex}
            onSelectElement={(number) => onSelectElement(number)}
            onChangeRange={handleRangeChange}
            onBackToGroups={handleBackToFullTable}
            massMode={massMode}
          />
        </section>
      ) : (
        <section className="periodic-chart-workspace w-full border-y border-border/40 bg-gradient-to-b from-primary/[0.02] via-background/[0.04] to-primary/[0.01] py-2">
          <div
            data-swipe-ignore-back="true"
            className="periodic-table-scroll w-full max-h-[70dvh] min-h-0 overflow-x-auto overflow-y-auto overscroll-contain py-1"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
              scrollBehavior: 'smooth',
            }}
          >
            <div
              className="periodic-table-content w-max min-w-[1488px] max-w-none shrink-0 pb-1"
              style={{ width: `${PERIODIC_GRID_WIDTH}px`, minWidth: `${PERIODIC_GRID_WIDTH}px`, maxWidth: 'none' }}
            >
              <div className="periodic-table-row grid pb-1 text-center" style={periodicGridStyle}>
                <div />
                {GROUPS.map((g) => <div key={g} className="text-[9px] font-black text-muted-foreground">{g}</div>)}
              </div>

              <div className="space-y-1">
                {MAIN_ROWS.map((period) => (
                  <div key={period} className="periodic-table-row grid" style={periodicGridStyle}>
                    <div className="flex items-center justify-center rounded-lg bg-background/40 text-[9px] font-black tabular-nums text-muted-foreground">{period}</div>
                    {GROUPS.map((group) => {
                      const el = findMainElement(period, group);
                      if (el) return <ElementCell key={`${period}-${group}`} el={el} massMode={massMode} onClick={() => onSelectElement(el.number)} />;
                      if (period === 6 && group === 3) return <FPlaceholder key={`${period}-${group}`} label="57–71" text="Lanthanides ↓" />;
                      if (period === 7 && group === 3) return <FPlaceholder key={`${period}-${group}`} label="89–103" text="Actinides ↓" />;
                      return <div key={`${period}-${group}`} className="aspect-square h-[76px] min-w-[76px] max-w-none rounded-lg border border-transparent shrink-0" aria-hidden="true" />;
                    })}
                  </div>
                ))}
              </div>

              <div className="my-3 flex items-center gap-2"><div className="h-px flex-1 bg-border/70" /><span className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">f-block</span><div className="h-px flex-1 bg-border/70" /></div>
              <div className="space-y-1">
                {F_BLOCK_ROWS.map(({ ypos: row, label, range }) => (
                  <div key={row} className="periodic-table-row grid" style={periodicGridStyle}>
                    <div className="flex flex-col items-center justify-center rounded-lg bg-background/40 text-center"><span className="text-[8px] font-black uppercase text-muted-foreground">{label}</span><span className="mt-0.5 text-[8px] font-bold text-primary">{range}</span></div>
                    {GROUPS.map((group) => {
                      if (group < 4 || group > 18) return <div key={group} className="aspect-square h-[76px] min-w-[76px] max-w-none rounded-lg border border-transparent shrink-0" aria-hidden="true" />;
                      const el = F_ELEMENT_BY_POSITION.get(`${row}-${group}`);
                      return el ? <ElementCell key={group} el={el} compact massMode={massMode} onClick={() => onSelectElement(el.number)} /> : <div key={group} className="aspect-square h-[76px] min-w-[76px] max-w-none shrink-0" />;
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="periodic-table-legend">
            <Legend />
          </div>
        </section>
      )}

      {selectedRangeIndex === null && (
        <p className="mb-3 text-center text-[11px] font-semibold text-muted-foreground">← Swipe horizontally → to explore all 18 groups • scroll vertically for f-block + colour code</p>
      )}
      <p className="mt-3 text-center text-[11px] font-semibold text-muted-foreground">Tap any element to view its complete information.</p>
      {selected && (
        <ElementDetails
          element={selected}
          massMode={massMode}
          onBack={() => onSelectElement(null)}
          onClose={() => onSelectElement(null)}
        />
      )}
    </div>
  );
};

export default PeriodicTableLearning;
