import { useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react';
import { ArrowLeft, Atom, Layers3, MoreVertical, X } from 'lucide-react';
import { m as motion } from 'framer-motion';
import type { ChemElement } from '@/lib/periodicTable';
import { CATEGORY_LABEL, ELEMENTS, formatMass } from '@/lib/periodicTable';

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
    className={`relative aspect-square h-[72px] min-w-[72px] rounded-lg border p-1.5 text-left transition-all ${CATEGORY_STYLES[el.category]} hover:shadow-[0_0_18px_hsl(var(--primary)/0.15)] ${compact ? 'h-[72px] min-w-[72px]' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background`}
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
  <div className="flex aspect-square h-[72px] min-w-[72px] items-center justify-center rounded-lg border border-dashed border-primary/25 bg-primary/5 px-1 text-center">
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
    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 border-y border-border/60 bg-background/30 px-3 py-2.5">
      {visibleCategories.map((category) => (
        <div key={category} className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${CATEGORY_DOTS[category]}`} />
          {CATEGORY_LABEL[category]}
        </div>
      ))}
    </div>
  );
};

const PERIODIC_GROUPS = Array.from(
  { length: Math.ceil(ELEMENTS.length / 10) },
  (_, index) => {
    const from = index * 10 + 1;
    return { from, to: Math.min(from + 9, ELEMENTS.length) };
  },
);

const PeriodicRangePicker = ({
  onSelectRange,
}: {
  onSelectRange: (index: number) => void;
}) => (
  <div className="w-full py-1">
    <div className="mb-3 text-center">
      <p className="font-display text-sm font-black uppercase tracking-wide text-foreground">Element Groups</p>
      <p className="mt-1 text-[11px] font-semibold text-muted-foreground">Select a range, then swipe left/right to move to the next or previous group.</p>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {PERIODIC_GROUPS.map(({ from, to }, index) => (
        <button
          key={from}
          type="button"
          onClick={() => onSelectRange(index)}
          className="rounded-2xl border border-border bg-secondary/70 px-3 py-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="block font-display text-lg font-black text-foreground">{from}–{to}</span>
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {to - from + 1} elements
          </span>
        </button>
      ))}
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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const group = PERIODIC_GROUPS[rangeIndex];
  const elements = ELEMENTS.slice(group.from - 1, group.to);
  const hasPrevious = rangeIndex > 0;
  const hasNext = rangeIndex < PERIODIC_GROUPS.length - 1;

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 55 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;

    if (dx < 0 && hasNext) onChangeRange(rangeIndex + 1);
    if (dx > 0 && hasPrevious) onChangeRange(rangeIndex - 1);
  };

  return (
    <div
      data-swipe-ignore-back="true"
      className="w-full touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label={`Periodic Table elements ${group.from} to ${group.to}`}
    >
      <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <button
          type="button"
          onClick={() => onChangeRange(rangeIndex - 1)}
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
          onClick={() => onChangeRange(rangeIndex + 1)}
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
          ← All element groups
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

      <div className="mt-3 flex justify-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary">Swipe left/right for next/previous group</span>
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
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const morePressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rangeView, setRangeView] = useState(false);
  const [selectedRangeIndex, setSelectedRangeIndex] = useState<number | null>(null);
  const [massMode, setMassMode] = useState<AtomicMassMode>('exact');
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
    setRangeView((value) => {
      const next = !value;
      if (next) setSelectedRangeIndex(null);
      return next;
    });
  };

  const handleRangeChange = (index: number) => {
    if (index < 0 || index >= PERIODIC_GROUPS.length) return;
    setSelectedRangeIndex(index);
  };
  const selected = selectedElement ? ELEMENTS[selectedElement - 1] : undefined;

  return (
    <div className="pb-6">
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><Layers3 size={19} /></div>
          <div>
            <h2 className="font-display text-lg font-black text-foreground">Periodic Table</h2>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {rangeView ? `Element groups • ${massMode === 'exact' ? 'Exact mass' : 'Round mass'}` : `18 groups • 7 periods • 118 elements • ${massMode === 'exact' ? 'Exact mass' : 'Round mass'}`}
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
          onContextMenu={(event) => { event.preventDefault(); setLongPressTriggered(true); setMassMenuOpen(true); }}
          aria-label={rangeView ? 'Show standard periodic table grid; long press for atomic mass format' : 'Show element groups 1 to 10, 11 to 20, and so on; long press for atomic mass format'}
          title={rangeView ? 'Tap to show standard table • Long press for atomic mass format' : 'Tap to show element groups • Long press for atomic mass format'}
          aria-pressed={rangeView}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-secondary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <MoreVertical size={19} />
        </button>

        {massMenuOpen && (
          <div className="absolute right-4 top-14 z-40 w-56 rounded-2xl border border-border bg-popover p-2 shadow-xl" role="dialog" aria-label="Atomic mass format">
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

      {rangeView ? (
        <div className="w-full py-1">
          {selectedRangeIndex === null ? (
            <PeriodicRangePicker onSelectRange={handleRangeChange} />
          ) : (
            <PeriodicRangeView
              rangeIndex={selectedRangeIndex}
              onSelectElement={(number) => onSelectElement(number)}
              onChangeRange={handleRangeChange}
              onBackToGroups={() => setSelectedRangeIndex(null)}
              massMode={massMode}
            />
          )}
        </div>
      ) : (
        <div
          ref={tableScrollRef}
          data-swipe-ignore-back="true"
          className="periodic-table-scroll w-full max-h-[70dvh] min-h-0 overflow-x-auto overflow-y-auto overscroll-contain py-1"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x pan-y',
            scrollBehavior: 'smooth',
          }}
        >
        <div
          className="periodic-table-content w-max min-w-[1416px] pb-1"
          style={{ width: 'max-content', minWidth: '1416px', maxWidth: 'none' }}
        >
          <div className="grid grid-cols-[48px_repeat(18,72px)] gap-1 pb-1 text-center">
            <div />
            {GROUPS.map((g) => <div key={g} className="text-[9px] font-black text-muted-foreground">{g}</div>)}
          </div>

          <div className="space-y-1">
            {MAIN_ROWS.map((period) => (
              <div key={period} className="grid grid-cols-[48px_repeat(18,72px)] gap-1">
                <div className="flex items-center justify-center rounded-lg bg-background/40 text-[9px] font-black tabular-nums text-muted-foreground">{period}</div>
                {GROUPS.map((group) => {
                  const el = findMainElement(period, group);
                  if (el) return <ElementCell key={`${period}-${group}`} el={el} massMode={massMode} onClick={() => onSelectElement(el.number)} />;
                  if (period === 6 && group === 3) return <FPlaceholder key={`${period}-${group}`} label="57–71" text="Lanthanides ↓" />;
                  if (period === 7 && group === 3) return <FPlaceholder key={`${period}-${group}`} label="89–103" text="Actinides ↓" />;
                  return <div key={`${period}-${group}`} className="aspect-square h-[72px] rounded-lg border border-transparent" aria-hidden="true" />;
                })}
              </div>
            ))}
          </div>

          <div className="my-3 flex items-center gap-2"><div className="h-px flex-1 bg-border/70" /><span className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">f-block</span><div className="h-px flex-1 bg-border/70" /></div>
          <div className="space-y-1">
            {F_BLOCK_ROWS.map(({ ypos: row, label, range }) => (
              <div key={row} className="grid grid-cols-[48px_repeat(18,72px)] gap-1">
                <div className="flex flex-col items-center justify-center rounded-lg bg-background/40 text-center"><span className="text-[8px] font-black uppercase text-muted-foreground">{label}</span><span className="mt-0.5 text-[8px] font-bold text-primary">{range}</span></div>
                {GROUPS.map((group) => {
                  if (group < 4 || group > 18) return <div key={group} className="aspect-square h-[72px] rounded-lg border border-transparent" aria-hidden="true" />;
                  const el = F_ELEMENT_BY_POSITION.get(`${row}-${group}`);
                  return el ? <ElementCell key={group} el={el} compact massMode={massMode} onClick={() => onSelectElement(el.number)} /> : <div key={group} className="aspect-square h-[72px] min-w-[72px]" />;
                })}
              </div>
            ))}
          </div>

          <div className="periodic-table-legend mt-4">
            <Legend />
          </div>
        </div>
        </div>
      )}

      {rangeView ? (
        <div className="hidden" aria-hidden="true" />
      ) : (
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
