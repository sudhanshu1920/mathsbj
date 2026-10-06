import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, Atom, ChevronLeft, ChevronRight, Grid3X3, Layers3, MoreVertical, X } from 'lucide-react';
import { m as motion } from 'framer-motion';
import type { ChemElement } from '@/lib/periodicTable';
import { CATEGORY_LABEL, ELEMENTS, formatMass } from '@/lib/periodicTable';
import { getPeriodicRangeElements, movePeriodicRangeIndex, PERIODIC_RANGES } from '@/lib/periodicRanges';

interface PeriodicTableLearningProps {
  selectedElement: number | null;
  onSelectElement: (number: number | null) => void;
}

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
    .map((el) => [String(el.ypos) + '-' + String(el.xpos), el] as const),
);

const F_ELEMENT_BY_POSITION = new Map(
  ELEMENTS
    .filter((el) => el.ypos >= 9)
    .map((el) => [String(el.ypos) + '-' + String(el.xpos), el] as const),
);

const findMainElement = (period: number, group: number) =>
  MAIN_ELEMENT_BY_POSITION.get(String(period) + '-' + String(group));

const ElementCell = ({
  el,
  onClick,
}: {
  el: ChemElement;
  onClick: () => void;
}) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.96 }}
    whileHover={{ y: -1 }}
    onClick={onClick}
    aria-label={el.name + ', atomic number ' + String(el.number)}
    title={el.name + ' (' + el.symbol + ')'}
    className={'relative aspect-square h-[72px] min-w-[72px] rounded-lg border p-1.5 text-left transition-all ' +
      CATEGORY_STYLES[el.category] +
      ' hover:shadow-[0_0_18px_hsl(var(--primary)/0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background'}
  >
    <span className="absolute left-1.5 top-1 text-[9px] font-bold text-muted-foreground">{el.number}</span>
    <span className="absolute right-1.5 top-1 text-[9px] font-semibold text-muted-foreground">{formatMass(el)}</span>
    <div className="flex h-full flex-col items-center justify-end pb-1">
      <span className="font-display text-[22px] font-black leading-none text-foreground">{el.symbol}</span>
      <span className="mt-1 w-full truncate text-center text-[9px] font-bold leading-tight text-foreground" title={el.name}>{el.name}</span>
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
    'alkali-metal',
    'alkaline-earth',
    'transition-metal',
    'post-transition',
    'metalloid',
    'nonmetal',
    'halogen',
    'noble-gas',
    'lanthanide',
    'actinide',
    'unknown',
  ] as ChemElement['category'][];

  return (
    <div className="mt-4 border-t border-border/60 pt-3">
      <div className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        Color Code / Category
      </div>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
        {visibleCategories.map((category) => (
          <div key={category} className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
            <span className={'h-2 w-2 rounded-full ' + CATEGORY_DOTS[category]} />
            {CATEGORY_LABEL[category]}
          </div>
        ))}
      </div>
    </div>
  );
};

const RangeElementCell = ({ el, onClick }: { el: ChemElement; onClick: () => void }) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.97 }}
    whileHover={{ y: -1 }}
    onClick={onClick}
    aria-label={el.name + ', atomic number ' + String(el.number)}
    title={el.name + ' (' + el.symbol + ')'}
    className={'min-h-[96px] rounded-lg border px-2.5 py-2 text-left transition-all ' +
      CATEGORY_STYLES[el.category] +
      ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background'}
  >
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] font-black tabular-nums text-muted-foreground">{el.number}</span>
      <span className="text-[10px] font-semibold text-muted-foreground">{formatMass(el)}</span>
    </div>
    <div className="mt-3 flex items-end gap-2">
      <span className="font-display text-2xl font-black leading-none text-foreground">{el.symbol}</span>
      <span className="min-w-0 flex-1 break-words text-[11px] font-bold leading-tight text-foreground">{el.name}</span>
    </div>
  </motion.button>
);

const ElementDetails = ({
  element,
  onBack,
  onClose,
}: {
  element: ChemElement;
  onBack: () => void;
  onClose: () => void;
}) => {
  const facts = useMemo(() => [
    ['Atomic Number', String(element.number)],
    ['Symbol', element.symbol],
    ['Element Name', element.name],
    ['Atomic Mass', formatMass(element)],
    ['Group', element.group === null ? '— (f-block)' : String(element.group)],
    ['Period', String(element.period)],
    ['Block', element.block + '-block'],
    ['Category', CATEGORY_LABEL[element.category]],
    ['State', element.state],
    ['Radioactive', element.radioactive ? 'Yes' : 'No'],
    ['Electron Configuration', element.config],
  ], [element]);

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
            <div className={'flex min-h-[190px] flex-col items-center justify-center rounded-2xl border-2 ' + CATEGORY_STYLES[element.category]}>
              <span className="self-start px-4 pt-3 text-sm font-bold text-muted-foreground">{element.number}</span>
              <span className="font-display text-7xl font-black leading-none text-foreground">{element.symbol}</span>
              <span className="mt-2 text-center text-lg font-extrabold text-foreground">{element.name}</span>
              <span className="mt-2 rounded-full bg-background/50 px-3 py-1 text-sm font-bold text-primary">{formatMass(element)}</span>
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
  const [selectedRangeIndex, setSelectedRangeIndex] = useState<number | null>(null);
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const rangeMenuRef = useRef<HTMLDivElement | null>(null);
  const rangeSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const rangeSwipePointerId = useRef<number | null>(null);
  const suppressRangeClick = useRef(false);

  const selected = selectedElement ? ELEMENTS[selectedElement - 1] : undefined;
  const selectedRange = selectedRangeIndex === null ? null : PERIODIC_RANGES[selectedRangeIndex];
  const rangeElements = useMemo(
    () => selectedRangeIndex === null ? [] : getPeriodicRangeElements(selectedRangeIndex),
    [selectedRangeIndex],
  );

  useEffect(() => {
    if (!rangeMenuOpen) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !rangeMenuRef.current?.contains(target)) {
        setRangeMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [rangeMenuOpen]);

  const setRange = useCallback((index: number | null) => {
    if (index !== null && (index < 0 || index >= PERIODIC_RANGES.length)) return;
    setSelectedRangeIndex(index);
    setRangeMenuOpen(false);
  }, []);

  const moveRange = useCallback((delta: number) => {
    setSelectedRangeIndex((current) => movePeriodicRangeIndex(current, delta));
  }, []);

  const finishRangeSwipe = useCallback((event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    if (rangeSwipePointerId.current !== event.pointerId || !rangeSwipeStart.current) return;

    const dx = event.clientX - rangeSwipeStart.current.x;
    const dy = event.clientY - rangeSwipeStart.current.y;
    const horizontal = Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.2;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture can already be released by the browser.
    }

    rangeSwipePointerId.current = null;
    rangeSwipeStart.current = null;

    if (!cancelled && horizontal && selectedRangeIndex !== null) {
      if (dx < 0 && selectedRangeIndex < PERIODIC_RANGES.length - 1) moveRange(1);
      if (dx > 0 && selectedRangeIndex > 0) moveRange(-1);
    }
  }, [moveRange, selectedRangeIndex]);

  const handleRangePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (selectedRangeIndex === null) return;

    suppressRangeClick.current = false;
    rangeSwipeStart.current = { x: event.clientX, y: event.clientY };
    rangeSwipePointerId.current = event.pointerId;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional.
    }
  }, [selectedRangeIndex]);

  const handleRangePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (rangeSwipePointerId.current !== event.pointerId || !rangeSwipeStart.current) return;
    const dx = event.clientX - rangeSwipeStart.current.x;
    const dy = event.clientY - rangeSwipeStart.current.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      suppressRangeClick.current = true;
      event.preventDefault();
    }
  }, []);

  return (
    <div className="pb-6">
      <div className="top-panel mb-2 flex items-center justify-between gap-3 px-1 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-xl bg-primary/10 p-1.5 text-primary"><Layers3 size={18} /></div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-black text-foreground sm:text-lg">Periodic Table</h2>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {selectedRange
                ? 'Showing ' + String(rangeElements.length) + ' elements • ' + selectedRange.label
                : '18 groups • 7 periods • 118 elements'}
            </p>
          </div>
        </div>

        <div ref={rangeMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setRangeMenuOpen((open) => !open)}
            aria-label="Open Periodic Table range menu"
            aria-expanded={rangeMenuOpen}
            className="rounded-xl border border-border/70 bg-background/35 p-2 text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MoreVertical size={18} />
          </button>

          {rangeMenuOpen && (
            <div className="absolute right-0 top-11 z-40 w-[min(92vw,22rem)] rounded-xl border border-border bg-popover/95 p-2 shadow-xl backdrop-blur-md">
              <button
                type="button"
                onClick={() => setRange(null)}
                className={'mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ' +
                  (selectedRangeIndex === null
                    ? 'gradient-primary border-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80')}
              >
                <Grid3X3 size={14} /> Full Chart
              </button>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {PERIODIC_RANGES.map((range, index) => (
                  <button
                    key={range.label}
                    type="button"
                    role="menuitem"
                    aria-pressed={selectedRangeIndex === index}
                    onClick={() => setRange(index)}
                    className={'rounded-lg border px-2 py-2.5 text-[11px] font-bold transition-colors ' +
                      (selectedRangeIndex === index
                        ? 'gradient-primary border-primary text-primary-foreground'
                        : 'border-border bg-background/50 text-foreground hover:border-primary/50 hover:bg-primary/10')}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedRange ? (
        <div
          data-swipe-ignore-back="true"
          className="border-y border-border/60 bg-background/10 px-2 py-3 sm:px-3 sm:py-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={selectedRangeIndex === 0}
              onClick={() => moveRange(-1)}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-2 text-xs font-bold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Previous
            </button>

            <div className="text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">Selected Range</p>
              <h3 className="font-display text-lg font-black text-primary">{selectedRange.label}</h3>
            </div>

            <button
              type="button"
              disabled={selectedRangeIndex === PERIODIC_RANGES.length - 1}
              onClick={() => moveRange(1)}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-2 text-xs font-bold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>

          <div
            className="grid grid-cols-2 gap-2.5 select-none sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
            style={{ touchAction: 'pan-y' }}
            onPointerDown={handleRangePointerDown}
            onPointerMove={handleRangePointerMove}
            onPointerUp={finishRangeSwipe}
            onPointerCancel={(event) => finishRangeSwipe(event, true)}
            onClickCapture={(event) => {
              if (!suppressRangeClick.current) return;
              event.preventDefault();
              event.stopPropagation();
              suppressRangeClick.current = false;
            }}
          >
            {rangeElements.map((el) => (
              <RangeElementCell key={el.number} el={el} onClick={() => onSelectElement(el.number)} />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setRange(null)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground hover:bg-secondary/80"
            >
              <Grid3X3 size={14} /> Full Chart
            </button>
          </div>

          <p className="mt-2 text-center text-[10px] font-semibold text-muted-foreground">
            Swipe right-to-left for next range • left-to-right for previous range
          </p>
        </div>
      ) : (
        <>
          <div
            data-swipe-ignore-back="true"
            className="periodic-table-scroll w-full max-h-[70dvh] min-h-0 overflow-auto overscroll-contain border-y border-border/60 bg-background/10 px-1 py-2 sm:px-2 sm:py-3"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
              scrollBehavior: 'smooth',
            }}
          >
            <div className="periodic-table-content w-max min-w-[1320px] pb-2" style={{ width: 'max-content', maxWidth: 'none' }}>
              <div className="grid grid-cols-[42px_repeat(18,72px)] gap-1 pb-1 text-center">
                <div />
                {GROUPS.map((g) => <div key={g} className="text-[9px] font-black text-muted-foreground">{g}</div>)}
              </div>

              <div className="space-y-1">
                {MAIN_ROWS.map((period) => (
                  <div key={period} className="grid grid-cols-[42px_repeat(18,72px)] gap-1">
                    <div className="flex items-center justify-center rounded-lg bg-background/40 text-[9px] font-black tabular-nums text-muted-foreground">{period}</div>
                    {GROUPS.map((group) => {
                      const el = findMainElement(period, group);
                      if (el) return <ElementCell key={String(period) + '-' + String(group)} el={el} onClick={() => onSelectElement(el.number)} />;
                      if (period === 6 && group === 3) return <FPlaceholder key={String(period) + '-' + String(group)} label="57–71" text="Lanthanides ↓" />;
                      if (period === 7 && group === 3) return <FPlaceholder key={String(period) + '-' + String(group)} label="89–103" text="Actinides ↓" />;
                      return <div key={String(period) + '-' + String(group)} className="aspect-square h-[72px] rounded-lg border border-transparent" aria-hidden="true" />;
                    })}
                  </div>
                ))}
              </div>

              <div className="my-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-border/70" />
                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">f-block</span>
                <div className="h-px flex-1 bg-border/70" />
              </div>

              <div className="space-y-1">
                {F_BLOCK_ROWS.map(({ ypos: row, label, range }) => (
                  <div key={row} className="grid grid-cols-[42px_repeat(18,72px)] gap-1">
                    <div className="flex flex-col items-center justify-center rounded-lg bg-background/40 text-center">
                      <span className="text-[8px] font-black uppercase text-muted-foreground">{label}</span>
                      <span className="mt-0.5 text-[8px] font-bold text-primary">{range}</span>
                    </div>
                    {GROUPS.map((group) => {
                      if (group < 4 || group > 18) return <div key={group} className="aspect-square h-[72px] rounded-lg border border-transparent" aria-hidden="true" />;
                      const el = F_ELEMENT_BY_POSITION.get(String(row) + '-' + String(group));
                      return el
                        ? <ElementCell key={group} el={el} onClick={() => onSelectElement(el.number)} />
                        : <div key={group} className="aspect-square h-[72px] min-w-[72px]" />;
                    })}
                  </div>
                ))}
              </div>

              <Legend />
            </div>
          </div>

          <p className="mt-2 text-center text-[10px] font-semibold text-muted-foreground">
            Swipe or scroll horizontally to explore all 18 groups • scroll vertically to see the complete chart
          </p>
        </>
      )}

      {selected && (
        <ElementDetails
          element={selected}
          onBack={() => onSelectElement(null)}
          onClose={() => onSelectElement(null)}
        />
      )}
    </div>
  );
};

export default PeriodicTableLearning;
