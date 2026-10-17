import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Atom, Check, Circle, Dumbbell, MoreVertical, X } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import SwipeContainer from '@/components/SwipeContainer';
import ThemeToggle from '@/components/ThemeToggle';
import DesktopModeToggle from '@/components/DesktopModeToggle';
import type { ChemElement, PeriodicMassMode, PeriodicQuestionType } from '@/lib/periodicTable';
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
  onSelectRange?: (index: number | null, source?: 'picker' | 'swipe') => void;
  /** Mirrors the route-aware popup state so browser/native Back can dismiss it. */
  isRangeMenuOpen?: boolean;
  onRangeMenuOpenChange?: (open: boolean, reason?: 'dismiss' | 'select') => void;
  onBack?: () => void;
  /** Directly returns from a range page to the main Periodic Table view. */
  onBackToTable?: () => void;
  initialPracticeQuestionTypes?: PeriodicQuestionType[];
  onOpenPractice?: (selection: { from: number; to: number; questionTypes: PeriodicQuestionType[]; massMode: PeriodicMassMode }) => void;
}

type AtomicMassMode = PeriodicMassMode;

type PopupPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

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
  menuPosition: PopupPosition;
}) => (
  <>
    <div
      className="periodic-range-backdrop fixed inset-0 z-[90]"
      aria-hidden="true"
      onClick={onClose}
    />
    <div
      className="periodic-range-menu fixed z-[100] max-h-[min(70dvh,34rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-border/75 bg-popover shadow-xl"
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


const PeriodicMassMenu = ({
  massMode,
  menuPosition,
  onSelectMode,
  onClose,
}: {
  massMode: AtomicMassMode;
  menuPosition: PopupPosition;
  onSelectMode: (mode: AtomicMassMode) => void;
  onClose: () => void;
}) => (
  <>
    <div
      className="periodic-mass-backdrop fixed inset-0 z-[90]"
      aria-hidden="true"
      onClick={onClose}
    />
    <div
      className="periodic-mass-menu fixed z-[100] max-h-[min(45dvh,14rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border/75 bg-popover p-3 shadow-xl"
      style={{
        position: 'fixed',
        top: menuPosition.top,
        left: menuPosition.left,
        width: menuPosition.width,
        maxHeight: menuPosition.maxHeight,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Atomic mass format"
    >
      <div className="mb-2 border-b border-border/60 px-1 pb-2">
        <p className="font-display text-sm font-black text-foreground">Atomic Mass</p>
        <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">Choose display format</p>
      </div>
      <div className="flex flex-col gap-1">
        {(['exact', 'round'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onSelectMode(mode)}
            className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-bold text-foreground transition-colors hover:border-border/70 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-pressed={massMode === mode}
          >
            <span className="flex-1 whitespace-nowrap">
              {mode === 'exact' ? 'Exact Figure' : 'Round Figure'}
            </span>
            {massMode === mode && <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  </>
);

const PeriodicRangeView = ({
  rangeIndex,
  onSelectElement,
  massMode,
  initialScrollLeft,
  onScrollLeftChange,
}: {
  rangeIndex: number;
  onSelectElement: (number: number) => void;
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
  return (
    <section
      data-periodic-range-index={rangeIndex}
      className="periodic-range-page w-full min-w-0 pb-4"
      aria-label={`Periodic Table elements ${group.from} to ${group.to}`}
    >
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
            className="periodic-range-table mx-auto w-max min-w-0 table-fixed"
          >
            <colgroup>
              <col className="periodic-col-number" />
              <col className="periodic-col-element" />
              <col className="periodic-col-symbol" />
              <col className="periodic-col-mass" />
            </colgroup>
          <thead className="border-b border-border/70 bg-background text-foreground">
            <tr>
              <th scope="col" className="periodic-range-header-cell periodic-range-column-heading periodic-tint-number px-1 py-2 text-center font-black uppercase leading-tight tracking-normal sm:px-4 sm:py-3.5 sm:tracking-wide">ATOMIC NO.</th>
              <th scope="col" className="periodic-range-header-cell periodic-range-column-heading periodic-tint-element px-1 py-2 text-left font-black uppercase leading-tight tracking-normal sm:px-4 sm:py-3.5 sm:tracking-wide">ELEMENT</th>
              <th scope="col" className="periodic-range-header-cell periodic-range-column-heading periodic-tint-symbol px-1 py-2 text-center font-black uppercase leading-tight tracking-normal sm:px-4 sm:py-3.5 sm:tracking-wide">SYMBOL</th>
              <th scope="col" className="periodic-range-header-cell periodic-range-column-heading periodic-range-mass periodic-tint-mass whitespace-nowrap px-1 py-2 text-center font-black uppercase leading-tight tracking-normal sm:px-4 sm:py-3.5 sm:tracking-wide">ATOMIC MASS</th>
            </tr>
          </thead>
          <tbody>
            {elements.map((el) => (
              <tr key={el.number} className="periodic-range-data-row">
                <td className="periodic-range-cell periodic-range-row-cell periodic-tint-number px-1 py-1.5 text-center font-semibold tabular-nums text-muted-foreground sm:px-4 sm:py-3">{el.number}</td>
                <td className="periodic-range-cell periodic-range-row-cell periodic-tint-element px-1 py-1.5 sm:px-4 sm:py-3">
                  <button
                    type="button"
                    onClick={() => onSelectElement(el.number)}
                    aria-label={`${el.name}, atomic number ${el.number}`}
                    data-periodic-element-select="true"
                    className="periodic-range-element-name block min-h-10 w-full whitespace-normal break-words rounded-md py-1 text-left font-semibold leading-snug text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {el.name}
                  </button>
                </td>
                <td className="periodic-range-cell periodic-range-row-cell periodic-tint-symbol px-1 py-1.5 text-center sm:px-4 sm:py-3">
                  <button
                    type="button"
                    onClick={() => onSelectElement(el.number)}
                    aria-label={`Open ${el.name} details`}
                    data-periodic-element-select="true"
                    className="periodic-range-symbol inline-flex min-h-9 min-w-9 items-center justify-center rounded-md px-1 font-display font-black tabular-nums text-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {el.symbol}
                  </button>
                </td>
                <td className="periodic-range-cell periodic-range-row-cell periodic-range-mass periodic-tint-mass whitespace-nowrap px-1 py-1.5 text-center font-semibold tabular-nums text-foreground sm:px-4 sm:py-3">{formatMass(el, massMode)}</td>
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
  initialPracticeQuestionTypes,
  selectedRangeIndex,
  onSelectRange,
  isRangeMenuOpen,
  onRangeMenuOpenChange,
  onBack,
  onBackToTable,
  onOpenPractice,
}: PeriodicTableLearningProps) => {
  const morePressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const morePressGenerationRef = useRef(0);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  // A completed long-press may produce a delayed contextmenu and synthetic click.
  const longPressTriggeredRef = useRef(false);
  const suppressNextMoreClickRef = useRef(false);
  const ignoreLateMoreContextMenuRef = useRef(false);
  const [rangeMenuPosition, setRangeMenuPosition] = useState<PopupPosition | null>(null);
  const [massMenuPosition, setMassMenuPosition] = useState<PopupPosition | null>(null);
  const [internalSelectedRangeIndex, setInternalSelectedRangeIndex] = useState<number | null>(null);
  const hasControlledRange = selectedRangeIndex !== undefined;
  const requestedRangeIndex = hasControlledRange ? selectedRangeIndex : internalSelectedRangeIndex;
  const activeRangeIndex = requestedRangeIndex !== null && isValidPeriodicRangeIndex(requestedRangeIndex)
    ? requestedRangeIndex
    : null;
  const lastSelectedRangeIndexRef = useRef<number | null>(activeRangeIndex);
  const tableScrollLeftRef = useRef(0);
  const [massMode, setMassMode] = useState<AtomicMassMode>('exact');
  const [practicePopupOpen, setPracticePopupOpen] = useState(false);
  const [practiceQuestionTypes, setPracticeQuestionTypes] = useState<PeriodicQuestionType[]>(() => [...new Set<PeriodicQuestionType>(initialPracticeQuestionTypes ?? [])]);
  // One discriminated state makes the two popup surfaces mutually exclusive.
  const [activePopup, setActivePopup] = useState<'ranges' | 'mass' | null>(null);
  const rangeMenuOpen = activePopup === 'ranges';
  const massMenuOpen = activePopup === 'mass';

  // The parent route owns this overlay's Back entry. When popstate changes the
  // route back to its parent, close the local portal without restoring stale UI.
  useEffect(() => {
    if (isRangeMenuOpen === undefined) return;
    if (isRangeMenuOpen) {
      setActivePopup('ranges');
      return;
    }
    setActivePopup((current) => current === 'ranges' ? null : current);
    setRangeMenuPosition(null);
  }, [isRangeMenuOpen]);

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

  useLayoutEffect(() => {
    if (!massMenuOpen) return;

    const updateMassMenuPosition = () => {
      const anchor = moreButtonRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const gutter = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(240, Math.max(0, viewportWidth - gutter * 2));
      const desiredHeight = Math.max(80, Math.min(180, viewportHeight - gutter * 2));
      const belowSpace = viewportHeight - rect.bottom - gutter - 8;
      const aboveSpace = rect.top - gutter - 8;
      const openAbove = belowSpace < desiredHeight && aboveSpace > belowSpace;
      const top = Math.max(
        gutter,
        openAbove
          ? rect.top - desiredHeight - 8
          : Math.min(rect.bottom + 8, viewportHeight - desiredHeight - gutter),
      );
      const maxHeight = Math.max(80, Math.min(desiredHeight, viewportHeight - top - gutter));
      const left = Math.max(gutter, Math.min(rect.right - width, viewportWidth - width - gutter));

      setMassMenuPosition({ top, left, width, maxHeight });
    };

    updateMassMenuPosition();
    window.addEventListener('resize', updateMassMenuPosition);
    window.addEventListener('scroll', updateMassMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMassMenuPosition);
      window.removeEventListener('scroll', updateMassMenuPosition, true);
    };
  }, [massMenuOpen]);

  useEffect(() => {
    if (activePopup === null) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (activePopup === 'ranges') {
        setActivePopup(null);
        setRangeMenuPosition(null);
        onRangeMenuOpenChange?.(false, 'dismiss');
      } else {
        setActivePopup(null);
        setMassMenuPosition(null);
      }
      moreButtonRef.current?.focus();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [activePopup, onRangeMenuOpenChange]);

  useEffect(() => {
    if (!practicePopupOpen) return;
    const handlePracticeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPracticePopupOpen(false);
    };
    document.addEventListener('keydown', handlePracticeEscape);
    return () => document.removeEventListener('keydown', handlePracticeEscape);
  }, [practicePopupOpen]);

  const togglePracticeQuestionType = (type: PeriodicQuestionType) => {
    setPracticeQuestionTypes((previous) => previous.includes(type)
      ? previous.filter((item) => item !== type)
      : [...previous, type]);
  };

  const clearMorePressTimer = () => {
    morePressGenerationRef.current += 1;
    if (morePressTimerRef.current) {
      clearTimeout(morePressTimerRef.current);
      morePressTimerRef.current = null;
    }
  };

  const openMassMenuFromGesture = () => {
    // A long-press and its follow-up contextmenu are one gesture, not two opens.
    if (ignoreLateMoreContextMenuRef.current) return;
    clearMorePressTimer();
    longPressTriggeredRef.current = true;
    suppressNextMoreClickRef.current = true;
    ignoreLateMoreContextMenuRef.current = true;
    setRangeMenuPosition(null);
    if (!massMenuOpen) setMassMenuPosition(null);
    setActivePopup('mass');
  };

  const handleMorePointerDown = (event: { button?: number }) => {
    // Some synthetic/older touch PointerEvents omit button metadata; treat that as
    // the primary gesture, while still ignoring an explicit secondary click.
    if (event.button !== undefined && event.button !== 0) return;
    clearMorePressTimer();
    longPressTriggeredRef.current = false;
    suppressNextMoreClickRef.current = false;
    ignoreLateMoreContextMenuRef.current = false;
    const pressGeneration = morePressGenerationRef.current;
    morePressTimerRef.current = setTimeout(() => {
      if (morePressGenerationRef.current !== pressGeneration) return;
      morePressTimerRef.current = null;
      openMassMenuFromGesture();
    }, 550);
  };

  const handleMorePointerUp = () => {
    clearMorePressTimer();
  };

  const handleMorePointerCancel = () => {
    clearMorePressTimer();
    if (!longPressTriggeredRef.current) {
      suppressNextMoreClickRef.current = false;
      ignoreLateMoreContextMenuRef.current = false;
    }
  };

  const handleMoreContextMenu = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    clearMorePressTimer();
    // Some browsers deliver contextmenu after the timer or even after click.
    // Ignore it until a new pointer-down starts a distinct gesture.
    if (ignoreLateMoreContextMenuRef.current) return;
    openMassMenuFromGesture();
  };

  useEffect(() => () => {
    morePressGenerationRef.current += 1;
    if (morePressTimerRef.current) {
      clearTimeout(morePressTimerRef.current);
      morePressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (activeRangeIndex !== null) {
      lastSelectedRangeIndexRef.current = activeRangeIndex;
    }
  }, [activeRangeIndex]);

  const handleRangePageBack = () => {
    setActivePopup(null);
    setRangeMenuPosition(null);
    setMassMenuPosition(null);
    if (onBackToTable) onBackToTable();
    else changeRange(null);
  };

  const changeRange = (index: number | null, source: 'picker' | 'swipe' = 'picker') => {
    if (index !== null && !isValidPeriodicRangeIndex(index)) return;
    if (index !== null && index !== activeRangeIndex) tableScrollLeftRef.current = 0;
    if (index !== null) lastSelectedRangeIndexRef.current = index;
    if (hasControlledRange) {
      onSelectRange?.(index, source);
    } else {
      setInternalSelectedRangeIndex(index);
      onSelectRange?.(index, source);
    }
  };

  const navigateRange = (direction: 'previous' | 'next') => {
    if (activeRangeIndex === null) return;
    changeRange(getAdjacentPeriodicRangeIndex(activeRangeIndex, direction), 'swipe');
  };

  const handleRangeMenuVisibilityChange = (open: boolean, reason: 'dismiss' | 'select' = 'dismiss') => {
    if (open) {
      setMassMenuPosition(null);
      setRangeMenuPosition(null);
      setActivePopup('ranges');
      onRangeMenuOpenChange?.(true);
      return;
    }
    setActivePopup((current) => current === 'ranges' ? null : current);
    setRangeMenuPosition(null);
    onRangeMenuOpenChange?.(false, reason);
  };

  const handleMoreClick = () => {
    if (suppressNextMoreClickRef.current) {
      suppressNextMoreClickRef.current = false;
      return;
    }
    // Do not clear longPressTriggeredRef here: a delayed contextmenu may still
    // arrive after this click. The next pointer-down resets it for a new gesture.
    if (longPressTriggeredRef.current) return;

    if (rangeMenuOpen) {
      handleRangeMenuVisibilityChange(false, 'dismiss');
      setMassMenuPosition(null);
      return;
    }
    handleRangeMenuVisibilityChange(true);
  };

  const handleRangeChange = (index: number) => {
    if (!isValidPeriodicRangeIndex(index)) return;
    handleRangeMenuVisibilityChange(false, 'select');
    setMassMenuPosition(null);
    changeRange(index, 'picker');
  };

  const renderRangeSelector = () => (
    <div className="relative shrink-0">
      <button
        ref={moreButtonRef}
        type="button"
        onPointerDown={handleMorePointerDown}
        onPointerUp={handleMorePointerUp}
        onPointerCancel={handleMorePointerCancel}
        onPointerLeave={handleMorePointerUp}
        onClick={handleMoreClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            longPressTriggeredRef.current = false;
            suppressNextMoreClickRef.current = false;
          }
        }}
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
          onClose={() => handleRangeMenuVisibilityChange(false, 'dismiss')}
          menuPosition={rangeMenuPosition}
        />,
        document.body,
      )}

      {massMenuOpen && massMenuPosition && typeof document !== 'undefined' && createPortal(
        <PeriodicMassMenu
          massMode={massMode}
          menuPosition={massMenuPosition}
          onSelectMode={(mode) => {
            setMassMode(mode);
            setActivePopup(null);
            setMassMenuPosition(null);
            longPressTriggeredRef.current = false;
            suppressNextMoreClickRef.current = false;
          }}
          onClose={() => {
            setActivePopup(null);
            setMassMenuPosition(null);
          }}
        />,
        document.body,
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
            onClick={handleRangePageBack}
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
                onClick={() => setPracticePopupOpen(true)}
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

        {practicePopupOpen && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPracticePopupOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="periodic-practice-title"
              aria-describedby="periodic-practice-description"
              className="max-h-[min(82dvh,34rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-border/80 bg-popover p-4 text-popover-foreground shadow-2xl sm:p-5"
            >
              <div className="mb-4">
                <h3 id="periodic-practice-title" className="font-display text-lg font-black text-foreground">Choose What to Practice</h3>
                <p id="periodic-practice-description" className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Select one or more properties for elements {activeRange.from}–{activeRange.to}.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {([
                  ['atomic-number', 'Atomic No.'],
                  ['name', 'Element'],
                  ['symbol', 'Symbol'],
                  ['mass', 'Atomic Mass'],
                ] as [PeriodicQuestionType, string][]).map(([type, label]) => {
                  const checked = practiceQuestionTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => togglePracticeQuestionType(type)}
                      className={'flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' + (checked ? 'border-primary bg-primary/10 text-foreground' : 'border-border/75 bg-background/70 text-foreground hover:border-primary/50 hover:bg-secondary/70')}
                    >
                      <span className={'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ' + (checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50 bg-background')}>
                        {checked && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                      </span>
                      <span className="flex-1">{label}</span>
                    </button>
                  );
                })}
              </div>
              {practiceQuestionTypes.length === 0 && (
                <p role="status" className="mt-3 text-xs font-medium text-muted-foreground">Select at least one property to continue.</p>
              )}
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPracticePopupOpen(false)}
                  className="min-h-10 flex-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={practiceQuestionTypes.length === 0}
                  onClick={() => {
                    if (practiceQuestionTypes.length === 0 || !onOpenPractice) return;
                    onOpenPractice({
                      from: activeRange.from,
                      to: activeRange.to,
                      questionTypes: [...practiceQuestionTypes],
                      massMode,
                    });
                    setPracticePopupOpen(false);
                  }}
                  className="min-h-10 flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Continue
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
        <SwipeContainer
          edgeBackEnabled
          itemCount={PERIODIC_GROUPS.length}
          currentIndex={activeRangeIndex}
          onIndexChange={(nextIndex) => {
            if (activeRangeIndex === null || nextIndex === activeRangeIndex) return;
            navigateRange(nextIndex > activeRangeIndex ? 'next' : 'previous');
          }}
          ignoreSwipeSelector="button:not([data-periodic-element-select='true']), a, input, select, textarea, [role='dialog'], [data-app-topbar]"
          renderItem={(index) => (
            <PeriodicRangeView
              rangeIndex={index}
              onSelectElement={onSelectElement}
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
