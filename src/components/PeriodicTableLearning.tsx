import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Atom, Layers3, MoreVertical, X } from 'lucide-react';
import { m as motion } from 'framer-motion';
import type { ChemElement } from '@/lib/periodicTable';
import { CATEGORY_LABEL, ELEMENTS, formatMass } from '@/lib/periodicTable';

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
    .map((el) => [`${el.ypos}-${el.xpos}`, el] as const)
);

const F_ELEMENT_BY_POSITION = new Map(
  ELEMENTS
    .filter((el) => el.ypos >= 9)
    .map((el) => [`${el.ypos}-${el.xpos}`, el] as const)
);

const findMainElement = (period: number, group: number) =>
  MAIN_ELEMENT_BY_POSITION.get(`${period}-${group}`);

const ElementCell = ({ el, compact = false, onClick }: { el: ChemElement; compact?: boolean; onClick: () => void }) => (
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
    <span className="absolute right-1.5 top-1 text-[9px] font-semibold text-muted-foreground">{formatMass(el)}</span>
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
    <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-card/70 px-3 py-3">
      {visibleCategories.map((category) => (
        <div key={category} className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${CATEGORY_DOTS[category]}`} />
          {CATEGORY_LABEL[category]}
        </div>
      ))}
    </div>
  );
};

const ColumnElementRow = ({ el, onClick }: { el: ChemElement; onClick: () => void }) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.99 }}
    onClick={onClick}
    aria-label={`${el.name}, atomic number ${el.number}, symbol ${el.symbol}, atomic mass ${formatMass(el)}`}
    className="grid w-full grid-cols-[56px_minmax(0,1fr)_64px_88px] items-center gap-2 rounded-xl border border-border bg-card/70 px-3 py-3 text-left transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:grid-cols-[72px_minmax(0,1fr)_80px_110px]"
  >
    <span className="text-sm font-black tabular-nums text-primary">{el.number}</span>
    <span className="min-w-0 truncate text-sm font-bold text-foreground">{el.name}</span>
    <span className="text-center font-display text-base font-black text-foreground">{el.symbol}</span>
    <span className="text-right text-sm font-bold tabular-nums text-muted-foreground">{formatMass(el)}</span>
  </motion.button>
);

const PeriodicColumnView = ({ onSelectElement }: { onSelectElement: (number: number) => void }) => {
  const groups = useMemo(() => {
    const result: Array<{ from: number; to: number; elements: ChemElement[] }> = [];
    for (let from = 1; from <= ELEMENTS.length; from += 10) {
      const to = Math.min(from + 9, ELEMENTS.length);
      result.push({ from, to, elements: ELEMENTS.slice(from - 1, to) });
    }
    return result;
  }, []);

  return (
    <div className="space-y-4">
      {groups.map(({ from, to, elements }) => (
        <section key={`${from}-${to}`} className="overflow-hidden rounded-2xl border border-border bg-card/60">
          <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-3 py-2.5">
            <h3 className="font-display text-sm font-black uppercase tracking-wide text-foreground">
              Elements {from}–{to}
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {elements.length} elements
            </span>
          </div>

          <div className="space-y-1.5 p-2">
            <div className="grid grid-cols-[56px_minmax(0,1fr)_64px_88px] gap-2 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground sm:grid-cols-[72px_minmax(0,1fr)_80px_110px]">
              <span>Atomic No.</span>
              <span>Name</span>
              <span className="text-center">Symbol</span>
              <span className="text-right">Atomic Mass</span>
            </div>

            {elements.map((el) => (
              <ColumnElementRow key={el.number} el={el} onClick={() => onSelectElement(el.number)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

const ElementDetails = ({ element, onBack, onClose }: { element: ChemElement; onBack: () => void; onClose: () => void }) => {
  const facts = useMemo(() => [
    ['Atomic Number', String(element.number)],
    ['Symbol', element.symbol],
    ['Element Name', element.name],
    ['Atomic Mass', formatMass(element)],
    ['Group', element.group === null ? '— (f-block)' : String(element.group)],
    ['Period', String(element.period)],
    ['Block', `${element.block}-block`],
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
            <div className={`flex min-h-[190px] flex-col items-center justify-center rounded-2xl border-2 ${CATEGORY_STYLES[element.category]}`}>
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
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [columnView, setColumnView] = useState(false);
  const selected = selectedElement ? ELEMENTS[selectedElement - 1] : undefined;

  return (
    <div className="pb-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><Layers3 size={19} /></div>
          <div>
            <h2 className="font-display text-lg font-black text-foreground">Periodic Table</h2>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {columnView ? 'Column view • 118 elements' : '18 groups • 7 periods • 118 elements'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setColumnView((value) => !value)}
          aria-label={columnView ? 'Show periodic table grid' : 'Show periodic table column view'}
          title={columnView ? 'Show periodic table grid' : 'Show elements in columns'}
          aria-pressed={columnView}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-secondary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <MoreVertical size={19} />
        </button>

      </div>

      {columnView ? (
        <div className="max-h-[70dvh] overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card/60 p-2 sm:p-3" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          <PeriodicColumnView onSelectElement={(number) => onSelectElement(number)} />
        </div>
      ) : (
        <div
          ref={tableScrollRef}
          data-swipe-ignore-back="true"
          className="periodic-table-scroll w-full max-h-[70dvh] min-h-0 overflow-auto overscroll-contain rounded-3xl border border-border bg-card/60 p-2 sm:p-3"
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
                  if (el) return <ElementCell key={`${period}-${group}`} el={el} onClick={() => onSelectElement(el.number)} />;
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
                  return el ? <ElementCell key={group} el={el} compact onClick={() => onSelectElement(el.number)} /> : <div key={group} className="aspect-square h-[72px] min-w-[72px]" />;
                })}
              </div>
            ))}
          </div>
        </div>
        </div>
      )}

      {columnView ? (
        <p className="mb-3 text-center text-[11px] font-semibold text-muted-foreground">
          Tap any element row to view its complete information.
        </p>
      ) : (
        <p className="mb-3 text-center text-[11px] font-semibold text-muted-foreground">← Swipe horizontally → to explore all 18 groups</p>
      )
      <Legend />
      <p className="mt-3 text-center text-[11px] font-semibold text-muted-foreground">Swipe left/right to explore all 18 groups. Tap any element to view its complete local information.</p>
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
