import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Atom, Check, Circle, Dumbbell, MoreVertical, X } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import SwipeContainer from '@/components/SwipeContainer';
import ThemeToggle from '@/components/ThemeToggle';
import DesktopModeToggle from '@/components/DesktopModeToggle';
import type { ChemElement } from '@/lib/periodicTable';
import { CATEGORY_LABEL, ELEMENTS, formatMass } from '@/lib/periodicTable';
import { getPeriodicRangeElements } from '@/lib/periodicRanges';
import {
  getAdjacentPeriodicRangeIndex,
  isValidPeriodicRangeIndex,
  PERIODIC_GROUPS,
} from '@/lib/periodicRangeNavigation';

interface PeriodicTableLearningProps {
  selectedElement: number | null;
  onSelectElement: (number: number | null) => void;
  /** Controlled by LearningState so range pages participate in app history. */
  selectedRangeIndex?: number | null;
  onSelectRange?: (index: number | null) => void;
  onBack?: () => void;
  onOpenPractice?: () => void;
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
  <button
    type="button"
    onClick={onClick}
    aria-label={`${el.name}, atomic number ${el.number}`}
    title={`${el.name} (${el.symbol})`}
    className={`periodic-element-cell relative aspect-square h-[76px] min-w-[76px] rounded-lg max-w-none shrink-0 border p-1.5 text-left transition-[transform,border-color,background-color,box-shadow] ${CATEGORY_STYLES[el.category]} hover:-translate-y-px hover:shadow-[0_0_18px_hsl(var(--primary)/0.15)] active:scale-[0.96] ${compact ? 'h-[76px] min-w-[76px] max-w-none shrink-0' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background`}
  >
    <span className="absolute left-1.5 top-1 text-[9px] font-bold text-muted-foreground">{el.number}</span>
    <span className="absolute right-1.5 top-1 text-[9px] font-semibold text-muted-foreground">{formatMass(el, massMode)}</span>
    <div className="flex h-full flex-col items-center justify-end pb-1">
      <span className="font-display text-[22px] sm:text-[24px] font-black leading-none text-foreground">{el.symbol}</span>
      <span className="mt-1 w-full truncate text-center text-[9px] sm:text-[10px] font-bold leading-tight text-foreground" title={el.name}>{el.name}</span>
    </div>
  </button>
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
  menuPosition,
}: {
  selectedRangeIndex: number | null;
  onSelectRange: (index: number) => void;
  onClose: () => void;
  menuPosition: { top: number; left: number; width: number; maxHeight: number };
}) => (
  <>
    <div
      className="periodic-range-backdrop fixed inset-0 z-[90]"
      aria-hidden="true"
      onClick={onClose}
    />
    <div
      className="periodic-range-menu fixed z-[100] max-h-[min(70dvh,34rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-border/75 shadow-xl"
      style={{
        position: 'fixed',
        top: menuPosition.top,
        left: menuPosition.left,
        width: menuPosition.width,
        maxHeight: menuPosition.maxHeight,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Element ranges"
    >
    <div className="mb-3 flex items-start justify-between gap-3 border-b border-border/60 pb-3">
      <div>
        <p className="font-display text-xs font-black uppercase tracking-[0.12em] text-foreground">Choose atomic range</p>
        <p className="mt-1 text-[10px] font-medium text-muted-foreground">118 elements · 12 study pages</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close element range menu"
        className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X size={15} />
      </button>
    </div>
    <div className="periodic-range-grid" data-periodic-range-grid="true">
      {PERIODIC_GROUPS.map(({ from, to, label }, index) => {
        const active = selectedRangeIndex === index;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelectRange(index)}
            aria-label={`${label} ${to - from + 1} elements`}
            aria-pressed={active}
            className={`periodic-range-card min-h-14 w-full min-w-0 rounded-xl border px-2 py-2.5 text-left transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-px hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active
                ? 'gradient-primary border-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'border-border/70 bg-card/70 text-foreground hover:bg-secondary/80'
            }`}
          >
            <span className="block font-display text-sm font-black tabular-nums">{label}</span>
            <span className={`mt-1 block text-[9px] font-bold uppercase tracking-wide ${
              active ? 'text-primary-foreground/80' : 'text-muted-foreground'
            }`}>
              {to - from + 1} elements
            </span>
          </button>
        );
      })}
    </div>
    </div>
  </>
);

const PeriodicRangeView = ({
  rangeIndex,
  onSelectElement,
  onChangeRange,
  massMode,
  initialScrollLeft,
  onScrollLeftChange,
}: {
  rangeIndex: number;
  onSelectElement: (number: number) => void;
  onChangeRange: (index: number) => void;
  massMode: AtomicMassMode;
  initialScrollLeft: number;
  onScrollLeftChange: (scrollLeft: number) => void;
}) => {
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const group = PERIODIC_GROUPS[rangeIndex] || PERIODIC_GROUPS[0];
  const elements = useMemo(() => getPeriodicRangeElements(rangeIndex), [rangeIndex]);
  useLayoutEffect(() => {
    if (scrollRegionRef.current) {
      scrollRegionRef.current.scrollLeft = initialScrollLeft;
    }
  }, [initialScrollLeft, rangeIndex]);
  const hasPrevious = getAdjacentPeriodicRangeIndex(rangeIndex, 'previous') !== rangeIndex;
  const hasNext = getAdjacentPeriodicRangeIndex(rangeIndex, 'next') !== rangeIndex;

  return (
    <section
      data-periodic-range-index={rangeIndex}
      className="periodic-range-page w-full min-w-0 space-y-2 pb-4"
      aria-label={`Periodic Table elements ${group.from} to ${group.to}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/60 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Atomic number range</p>
          <p className="mt-0.5 font-display text-sm font-bold text-foreground">
            {group.from}–{group.to}
            <span className="ml-2 text-xs font-medium text-muted-foreground">· {elements.length} elements</span>
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">Range {rangeIndex + 1} of {PERIODIC_GROUPS.length}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeRange(getAdjacentPeriodicRangeIndex(rangeIndex, 'previous'))}
            disabled={!hasPrevious}
            aria-label="Previous element range"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => onChangeRange(getAdjacentPeriodicRangeIndex(rangeIndex, 'next'))}
            disabled={!hasNext}
            aria-label="Next element range"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="rotate-180" size={16} />
          </button>
        </div>
      </div>

      <div
        role="region"
        aria-label={`Elements ${group.from}–${group.to} table`}
        data-periodic-table-scroll="true"
        ref={scrollRegionRef}
        onScroll={(event) => onScrollLeftChange(event.currentTarget.scrollLeft)}
        className="periodic-table-scroll w-full min-w-0 overflow-x-auto overscroll-x-contain"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
      >
        <table
          aria-label={`Elements ${group.from}–${group.to}`}
          className="w-full min-w-[36rem] table-fixed border-collapse text-sm sm:text-base"
        >
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '43%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '28%' }} />
          </colgroup>
          <thead className="border-b border-border/70 bg-background text-foreground">
            <tr>
              <th scope="col" className="px-3 py-3 text-center text-xs font-black uppercase tracking-wide sm:px-4 sm:py-3.5 sm:text-sm">ATOMIC NO.</th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-black uppercase tracking-wide sm:px-4 sm:py-3.5 sm:text-sm">ELEMENT</th>
              <th scope="col" className="px-3 py-3 text-center text-xs font-black uppercase tracking-wide sm:px-4 sm:py-3.5 sm:text-sm">SYMBOL</th>
              <th scope="col" className="px-3 py-3 text-right text-xs font-black uppercase tracking-wide sm:px-4 sm:py-3.5 sm:text-sm">ATOMIC MASS</th>
            </tr>
          </thead>
          <tbody>
            {elements.map((el) => (
              <tr key={el.number} className="border-b border-border/50 last:border-b-0 hover:bg-primary/[0.035]">
                <td className="px-3 py-2 text-center text-sm font-semibold tabular-nums text-muted-foreground sm:px-4 sm:py-3">{el.number}</td>
                <td className="px-3 py-2 sm:px-4 sm:py-3">
                  <button
                    type="button"
                    onClick={() => onSelectElement(el.number)}
                    aria-label={`${el.name}, atomic number ${el.number}`}
                    className="block min-h-10 w-full whitespace-normal break-words rounded-md py-1 text-left text-sm font-semibold leading-snug text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-base"
                  >
                    {el.name}
                  </button>
                </td>
                <td className="px-3 py-2 text-center sm:px-4 sm:py-3">
                  <button
                    type="button"
                    onClick={() => onSelectElement(el.number)}
                    aria-label={`Open ${el.name} details`}
                    className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md px-1 text-sm font-display font-black tabular-nums text-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-base"
                  >
                    {el.symbol}
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-medium tabular-nums text-foreground sm:px-4 sm:py-3 sm:text-base">{formatMass(el, massMode)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const ElementDetails = ({
  element,
  massMode,
  onBack,
  onClose,
}: {
  element: ChemElement;
  massMode: AtomicMassMode;
  onBack: () => void;
  onClose: () => void;
}) => {
  const facts = useMemo(() => [
    ['Atomic No.', String(element.number)],
    ['Element', element.name],
    ['Symbol', element.symbol],
    ['Atomic Mass', formatMass(element, massMode)],
    ['Category / Family', CATEGORY_LABEL[element.category]],
    ['Period', String(element.period)],
    ['Group', element.group === null ? 'Not assigned (f-block)' : String(element.group)],
    ['Block', `${element.block}-block`],
    ['State', element.state],
    ['Radioactive', element.radioactive ? 'Yes' : 'No'],
    ['Electron Configuration', element.config],
  ], [element, massMode]);

  return (
    <section
      data-periodic-element-detail="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background/95"
      style={{ WebkitOverflowScrolling: 'touch' }}
      aria-label={`${element.name} element details`}
    >
      <div className="mx-auto min-h-full w-full max-w-4xl px-3 py-3 sm:px-6 sm:py-5">
        <div className="app-topbar-page sticky top-0 z-10 mb-3 flex items-center gap-3 rounded-2xl px-2 py-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to previous Periodic Table page"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center font-display text-base font-black text-foreground sm:text-lg">{element.name}</h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close element details"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-[0_20px_50px_-38px_hsl(var(--foreground)/0.5)]">
          <div className="grid gap-4 p-4 sm:grid-cols-[minmax(150px,0.65fr)_minmax(0,1.35fr)] sm:gap-5 sm:p-5">
            <div className={`flex min-h-[170px] flex-col items-center justify-center rounded-2xl border p-4 text-center sm:min-h-[220px] ${CATEGORY_STYLES[element.category]}`}>
              <div className="mb-3 flex w-full items-center justify-between gap-2">
                <span className="rounded-lg bg-background/60 px-2 py-1 text-xs font-black tabular-nums text-foreground">{element.number}</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{element.block}-block</span>
              </div>
              <span className="font-display text-6xl font-black leading-none text-foreground sm:text-7xl">{element.symbol}</span>
              <span className="mt-3 text-center text-base font-extrabold text-foreground sm:text-lg">{element.name}</span>
              <span className="mt-2 rounded-full border border-border/50 bg-background/65 px-3 py-1 text-sm font-bold tabular-nums text-primary">{formatMass(element, massMode)}</span>
            </div>

            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">Element information</p>
                  <h2 className="mt-0.5 font-display text-lg font-black text-foreground sm:text-xl">{element.name}</h2>
                </div>
                <span className="shrink-0 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{CATEGORY_LABEL[element.category]}</span>
              </div>
              <dl className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                {facts.map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-xl border border-border/65 bg-background/55 px-3 py-2.5">
                    <dt className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground sm:text-[10px]">{label}</dt>
                    <dd className="mt-1 break-words text-sm font-semibold leading-snug text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
        <p className="px-2 py-3 text-center text-[10px] font-medium text-muted-foreground">
          Element properties shown are limited to information available in the app’s shared dataset.
        </p>
      </div>
    </section>
  );
};

const PeriodicTableLearning = ({
  selectedElement,
  onSelectElement,
  selectedRangeIndex,
  onSelectRange,
  onBack,
  onOpenPractice,
}: PeriodicTableLearningProps) => {
  const morePressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const longPressTriggeredRef = useRef(false);
  const [rangeMenuPosition, setRangeMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [internalSelectedRangeIndex, setInternalSelectedRangeIndex] = useState<number | null>(null);
  const hasControlledRange = selectedRangeIndex !== undefined;
  const requestedRangeIndex = hasControlledRange ? selectedRangeIndex : internalSelectedRangeIndex;
  const activeRangeIndex = requestedRangeIndex !== null && isValidPeriodicRangeIndex(requestedRangeIndex)
    ? requestedRangeIndex
    : null;
  const previousRangeIndexRef = useRef<number | null>(activeRangeIndex);
  const lastSelectedRangeIndexRef = useRef<number | null>(activeRangeIndex);
  const tableScrollLeftRef = useRef(0);
  const [massMode, setMassMode] = useState<AtomicMassMode>('exact');
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [massMenuOpen, setMassMenuOpen] = useState(false);

  useLayoutEffect(() => {
    if (!rangeMenuOpen) return;

    const updateMenuPosition = () => {
      const anchor = moreButtonRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const gutter = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.max(0, Math.min(672, viewportWidth - gutter * 2));
      const desiredHeight = Math.min(544, Math.max(160, viewportHeight * 0.7), viewportHeight - gutter * 2);
      const belowSpace = viewportHeight - rect.bottom - gutter - 8;
      const aboveSpace = rect.top - gutter - 8;
      const openAbove = belowSpace < Math.min(desiredHeight, 320) && aboveSpace > belowSpace;
      const top = openAbove
        ? Math.max(gutter, rect.top - desiredHeight - 8)
        : Math.min(rect.bottom + 8, viewportHeight - desiredHeight - gutter);
      const maxHeight = Math.max(120, Math.min(desiredHeight, viewportHeight - top - gutter));
      const left = Math.max(gutter, Math.min(rect.right - width, viewportWidth - width - gutter));

      setRangeMenuPosition({ top, left, width, maxHeight });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [rangeMenuOpen]);

  useEffect(() => {
    if (!rangeMenuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setRangeMenuOpen(false);
      moreButtonRef.current?.focus();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [rangeMenuOpen]);

  const clearMorePressTimer = () => {
    if (morePressTimerRef.current) {
      clearTimeout(morePressTimerRef.current);
      morePressTimerRef.current = null;
    }
  };

  const handleMorePointerDown = (event: { button: number }) => {
    if (event.button !== 0) return;
    clearMorePressTimer();
    longPressTriggeredRef.current = false;
    morePressTimerRef.current = setTimeout(() => {
      morePressTimerRef.current = null;
      longPressTriggeredRef.current = true;
      setRangeMenuOpen(false);
      setRangeMenuPosition(null);
      setMassMenuOpen(true);
    }, 550);
  };

  const handleMorePointerUp = () => {
    clearMorePressTimer();
  };

  const handleMoreContextMenu = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    clearMorePressTimer();
    if (longPressTriggeredRef.current) return;
    longPressTriggeredRef.current = true;
    setRangeMenuOpen(false);
    setRangeMenuPosition(null);
    setMassMenuOpen(true);
  };

  useEffect(() => () => {
    if (morePressTimerRef.current) {
      clearTimeout(morePressTimerRef.current);
      morePressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (previousRangeIndexRef.current !== null && activeRangeIndex === null) {
      // The app router has returned from a dedicated range page. Restore the
      // exact range picker context without adding another history entry.
      setRangeMenuOpen(true);
      setMassMenuOpen(false);
    }
    if (activeRangeIndex !== null) {
      lastSelectedRangeIndexRef.current = activeRangeIndex;
    }
    previousRangeIndexRef.current = activeRangeIndex;
  }, [activeRangeIndex]);

  const changeRange = (index: number | null) => {
    if (index !== null && !isValidPeriodicRangeIndex(index)) return;
    if (index !== null && index !== activeRangeIndex) tableScrollLeftRef.current = 0;
    if (index !== null) lastSelectedRangeIndexRef.current = index;
    if (hasControlledRange) {
      onSelectRange?.(index);
    } else {
      setInternalSelectedRangeIndex(index);
    }
  };

  const handleMoreClick = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    setMassMenuOpen(false);
    setRangeMenuOpen((open) => !open);
  };

  const handleRangeChange = (index: number) => {
    if (!isValidPeriodicRangeIndex(index)) return;
    setRangeMenuOpen(false);
    setRangeMenuPosition(null);
    changeRange(index);
  };

  const renderRangeSelector = () => (
    <div className="relative shrink-0">
      <button
        ref={moreButtonRef}
        type="button"
        onPointerDown={handleMorePointerDown}
        onPointerUp={handleMorePointerUp}
        onPointerCancel={handleMorePointerUp}
        onPointerLeave={handleMorePointerUp}
        onClick={handleMoreClick}
        onContextMenu={handleMoreContextMenu}
        aria-label="Open element range menu; long press for atomic mass format"
        title="Choose element range • Long press for atomic mass format"
        aria-expanded={rangeMenuOpen || massMenuOpen}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-secondary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          rangeMenuOpen || massMenuOpen ? 'border-primary bg-primary/10 text-primary' : ''
        }`}
      >
        <MoreVertical size={19} />
      </button>

      {rangeMenuOpen && rangeMenuPosition && typeof document !== 'undefined' && createPortal(
        <PeriodicRangeMenu
          selectedRangeIndex={activeRangeIndex ?? lastSelectedRangeIndexRef.current}
          onSelectRange={handleRangeChange}
          onClose={() => {
            setRangeMenuOpen(false);
            setRangeMenuPosition(null);
          }}
          menuPosition={rangeMenuPosition}
        />,
        document.body,
      )}

      {massMenuOpen && (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 border border-border bg-popover p-2 shadow-xl backdrop-blur-md" role="dialog" aria-label="Atomic mass format">
          <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Atomic Mass</p>
          {(['exact', 'round'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setMassMode(mode);
                setMassMenuOpen(false);
                longPressTriggeredRef.current = false;
              }}
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
  );

  const selected = selectedElement !== null && Number.isInteger(selectedElement)
    ? ELEMENTS[selectedElement - 1]
    : undefined;

  if (selected) {
    const backToPreviousPage = onBack ?? (() => onSelectElement(null));
    return (
      <ElementDetails
        element={selected}
        massMode={massMode}
        onBack={backToPreviousPage}
        onClose={backToPreviousPage}
      />
    );
  }

  if (activeRangeIndex !== null) {
    const activeRange = PERIODIC_GROUPS[activeRangeIndex];
    return (
      <div className="periodic-range-page w-full min-w-0 pb-4" data-periodic-range-page="true">
        <div className="app-topbar-page relative flex min-w-0 items-center justify-between gap-1.5" data-app-topbar>
          <button
            type="button"
            onClick={() => {
              if (onBack) onBack();
              else changeRange(null);
            }}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="min-w-0 flex-1 truncate px-1 text-center font-display text-sm font-bold text-foreground sm:text-base">
            Elements {activeRange.from}–{activeRange.to}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {onOpenPractice && (
              <button
                type="button"
                onClick={onOpenPractice}
                className="inline-flex h-7 items-center gap-1 rounded-full gradient-primary px-2 text-[10px] font-semibold text-primary-foreground"
              >
                <Dumbbell size={12} />
                Practice
              </button>
            )}
            <ThemeToggle compact />
            <DesktopModeToggle compact />
            {renderRangeSelector()}
          </div>
        </div>
        <SwipeContainer
          itemCount={PERIODIC_GROUPS.length}
          currentIndex={activeRangeIndex}
          onIndexChange={changeRange}
          ignoreSwipeSelector="button, a, input, select, textarea, [data-periodic-table-scroll='true']"
          renderItem={(index) => (
            <PeriodicRangeView
              rangeIndex={index}
              onSelectElement={onSelectElement}
              onChangeRange={changeRange}
              massMode={massMode}
              initialScrollLeft={tableScrollLeftRef.current}
              onScrollLeftChange={(scrollLeft) => { tableScrollLeftRef.current = scrollLeft; }}
            />
          )}
        />
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><Atom size={19} /></div>
          <div>
            <h2 className="font-display text-lg font-black text-foreground">Periodic Table</h2>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {`18 groups • 7 periods • 118 elements • ${massMode === 'exact' ? 'Exact mass' : 'Round mass'}`}
            </p>
          </div>
        </div>

        {renderRangeSelector()}
      </div>

      {activeRangeIndex === null && (
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

      <p className="mt-3 text-center text-[11px] font-semibold text-muted-foreground">Tap any element to view its complete information.</p>
    </div>
  );
};

export default PeriodicTableLearning;
