import { m as motion } from 'framer-motion';
import { MOTION } from '@/lib/motion';
import { ArrowLeft, Crown, Dumbbell } from 'lucide-react';
import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import ThemeToggle from '@/components/ThemeToggle';
import DesktopModeToggle from '@/components/DesktopModeToggle';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import SwipeBack from '@/components/SwipeBack';
import SwipeContainer from '@/components/SwipeContainer';
import ShapeDiagram from '@/components/ShapeDiagram';
const TrigonometryLearning = lazy(() => import('@/components/TrigonometryLearning'));
const BasicTrigonometricFunctionsLearning = lazy(() => import('@/components/BasicTrigonometricFunctionsLearning'));
import { FORMULA_SECTIONS, type FormulaItem } from '@/lib/formulaData';
import { TRIG_FUNCTIONS, type TrigFunction } from '@/lib/trigData';

const KaTeXBlock = ({ latex }: { latex: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      katex.render(latex, ref.current, {
        displayMode: true,
        throwOnError: false,
        strict: false,
      });
    }
  }, [latex]);

  return <div ref={ref} className="katex-formula" />;
};

/** A single shape group extracted from formula data */
interface ShapeGroup {
  label: string;
  diagram?: string;
  variables: FormulaItem[];
  formulas: FormulaItem[];
}

/** Split formulas into shape groups by sectionLabel */
function extractShapeGroups(formulas: FormulaItem[]): ShapeGroup[] {
  const rawGroups: { label: string; items: FormulaItem[] }[] = [];
  let current: { label: string; items: FormulaItem[] } | null = null;

  for (const f of formulas) {
    if (f.sectionLabel && (!current || f.sectionLabel !== current.label)) {
      current = { label: f.sectionLabel, items: [] };
      rawGroups.push(current);
    }
    if (!current) {
      current = { label: '', items: [] };
      rawGroups.push(current);
    }
    current.items.push(f);
  }

  // Merge consecutive variable + formula groups into shape groups
  const shapes: ShapeGroup[] = [];
  let pendingVars: FormulaItem[] = [];
  let pendingLabel = '';
  let pendingDiagram: string | undefined;

  for (const group of rawGroups) {
    const isVarGroup = group.label === 'Variables' || group.items.every((f) => f.isVariable);
    const isFormulaGroup = group.label === 'Formulas' || group.items.every((f) => !f.isVariable);

    if (isVarGroup && !isFormulaGroup) {
      pendingVars = group.items;
      pendingLabel = group.label && group.label !== 'Variables' ? group.label : pendingLabel;
      pendingDiagram = group.items.find((f) => f.diagram)?.diagram;
      continue;
    }

    // This is a shape-titled group or a formula group
    const diagram = group.items.find((f) => f.diagram)?.diagram || pendingDiagram;
    const variables = [...pendingVars, ...group.items.filter((f) => f.isVariable)];
    const fItems = group.items.filter((f) => !f.isVariable);
    const label = group.label && group.label !== 'Formulas' && group.label !== 'Variables'
      ? group.label
      : pendingLabel;

    shapes.push({ label, diagram, variables, formulas: fItems });
    pendingVars = [];
    pendingLabel = '';
    pendingDiagram = undefined;
  }

  // If only pending vars remain
  if (pendingVars.length > 0) {
    shapes.push({ label: pendingLabel, diagram: pendingDiagram, variables: pendingVars, formulas: [] });
  }

  return shapes;
}

/** Standardized shape card: Title → Diagram → Definitions → Formulas */
const ShapeCard = ({ shape }: { shape: ShapeGroup }) => {
  const [showDefs, setShowDefs] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden"
    >
      {/* Diagram */}
      {shape.diagram && (
        <div className="flex justify-center pt-6 pb-2 bg-background">
          <ShapeDiagram type={shape.diagram} className="w-36 h-36" />
        </div>
      )}

      <div className="px-5 pb-5 pt-3 space-y-4">
        {/* Definitions / Variables */}
        {shape.variables.length > 0 && (
          <div>
            <button
              onClick={() => setShowDefs(!showDefs)}
              className="flex items-center gap-2 mb-2 w-full"
            >
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Definitions
              </span>
              <span className="text-xs text-muted-foreground">{showDefs ? '▾' : '▸'}</span>
            </button>
            {showDefs && (
              <div className="space-y-1 pl-1">
                {shape.variables.map((v, i) => (
                  <div key={i} className="text-sm">
                    <KaTeXBlock latex={v.latex} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Formulas */}
        {shape.formulas.length > 0 && (
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
              Formulas
            </span>
            <div className="space-y-2">
              {shape.formulas.map((f, i) => (
                <div key={i} className="overflow-x-auto">
                  <KaTeXBlock latex={f.latex} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

interface FormulasLearningProps {
  sectionIndex: number | null;
  categoryIndex: number | null;
  onNavigate: (section: number | null, category: number | null) => void;
  onPracticeTrigFunctions?: (functions: TrigFunction[]) => void;
}

const FormulasLearning = ({ sectionIndex, categoryIndex, onNavigate, onPracticeTrigFunctions }: FormulasLearningProps) => {
  const [shapeIndex, setShapeIndex] = useState(0);
  const [shapeListMode, setShapeListMode] = useState(true);
  const [showTrigPracticeMenu, setShowTrigPracticeMenu] = useState(false);
  const [selectedTrigFunctions, setSelectedTrigFunctions] = useState<TrigFunction[]>([]);
  // This is a temporary Table of Angles view choice, independent of the
  // separate Pro Mode setting used by multiplication tables.
  const [trigProMode, setTrigProMode] = useState(false);

  // Reset shape index + list mode when category changes
  useEffect(() => {
    setShapeIndex(0);
    setShapeListMode(true);
    setShowTrigPracticeMenu(false);
    setSelectedTrigFunctions([]);
    setTrigProMode(false);
  }, [sectionIndex, categoryIndex]);


  const startTrigPractice = (functions: TrigFunction[]) => {
    if (!functions.length || !onPracticeTrigFunctions) return;
    const selectedFunctions = [...functions];
    setSelectedTrigFunctions([]);
    setShowTrigPracticeMenu(false);
    onPracticeTrigFunctions(selectedFunctions);
  };

  // Level 3: Formula detail view
  if (sectionIndex !== null && categoryIndex !== null) {
    const section = FORMULA_SECTIONS[sectionIndex];
    const category = section?.categories[categoryIndex];
    if (!section || !category) return null;

    // Special case: Trigonometry → Basic Trigonometric Functions renders the
    // dedicated educational lesson inside the existing Formula hierarchy.
    if (category.id === 'trig-basic-functions') {
      return (
        <SwipeBack onBack={() => onNavigate(sectionIndex, null)}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => onNavigate(sectionIndex, null)} className="p-2 -ml-2 text-primary" aria-label="Back">
                <ArrowLeft size={20} />
              </button>
              <h2 className="min-w-0 text-center font-display font-bold text-lg text-foreground truncate">
                {category.title}
              </h2>
              <div className="flex items-center gap-2"><ThemeToggle /><DesktopModeToggle /></div>
            </div>
            <Suspense fallback={<div className="h-40" />}>
              <BasicTrigonometricFunctionsLearning />
            </Suspense>
          </div>
        </SwipeBack>
      );
    }

    // Special case: Trigonometry → Table of Angles renders the trig table component
    if (category.id === 'trig-angles') {
      return (
        <SwipeBack onBack={() => onNavigate(sectionIndex, null)}>
          <div>
            <div className="app-topbar-page mb-4 flex items-center justify-between gap-2" data-app-topbar>
              <button
                type="button"
                onClick={() => onNavigate(sectionIndex, null)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary"
                aria-label="Back"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="min-w-0 flex-1 truncate text-center font-display text-sm font-bold text-foreground sm:text-base">
                {category.title}
              </h2>
              <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => setTrigProMode((active) => !active)}
                  aria-label="Pro Mode"
                  aria-pressed={trigProMode}
                  title={trigProMode ? 'Pro Mode active: show angles from 0° to 360°' : 'Pro Mode inactive: show angles from 0° to 90°'}
                  className={
                    'motion-press inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-full border px-2 text-[11px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
                    (trigProMode
                      ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]'
                      : 'border-border bg-secondary text-secondary-foreground hover:border-primary/50')
                  }
                >
                  <Crown size={12} aria-hidden="true" />
                  <span>Pro</span>
                </button>
                <ThemeToggle compact />
                <DesktopModeToggle compact />
                {onPracticeTrigFunctions && (
                  <Popover
                    open={showTrigPracticeMenu}
                    onOpenChange={(open) => {
                      setShowTrigPracticeMenu(open);
                      if (!open) setSelectedTrigFunctions([]);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full gradient-primary px-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3"
                        aria-label="Practice"
                        aria-haspopup="dialog"
                        aria-expanded={showTrigPracticeMenu}
                        aria-controls="trig-practice-menu"
                        title="Practice trigonometric functions"
                      >
                        <Dumbbell size={14} aria-hidden="true" />
                        <span className="hidden sm:inline">Practice</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      id="trig-practice-menu"
                      role="dialog"
                      aria-label="Choose trigonometric functions to practice"
                      align="end"
                      side="bottom"
                      sideOffset={8}
                      collisionPadding={8}
                      data-swipe-ignore-app-section="true"
                      className="w-[min(19rem,calc(100vw-1rem))] max-h-[min(72dvh,calc(100dvh-5rem))] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-xl backdrop-blur-xl sm:p-4"
                    >
                      <div className="mb-3">
                        <p className="text-sm font-bold text-foreground">Practice Table of Angles</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Select one or more functions, then start a practice session.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {TRIG_FUNCTIONS.map((fn) => {
                          const selected = selectedTrigFunctions.includes(fn);
                          return (
                            <button
                              key={fn}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setSelectedTrigFunctions((previous) =>
                                selected ? previous.filter((item) => item !== fn) : [...previous, fn]
                              )}
                              className={
                                'min-h-10 rounded-xl border px-3 py-2 text-left text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
                                (selected
                                  ? 'gradient-primary border-primary text-primary-foreground'
                                  : 'border-border bg-secondary text-secondary-foreground hover:border-primary/50')
                              }
                            >
                              <span className="mr-2" aria-hidden="true">{selected ? '✓' : '○'}</span>
                              {fn} θ
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 min-h-4 text-[11px] text-muted-foreground" aria-live="polite">
                        {selectedTrigFunctions.length === 0
                          ? 'Select at least one function.'
                          : selectedTrigFunctions.length === TRIG_FUNCTIONS.length
                            ? 'All six functions selected.'
                            : selectedTrigFunctions.map((fn) => fn + ' θ').join(' + ')}
                      </p>
                      <button
                        type="button"
                        disabled={selectedTrigFunctions.length === 0}
                        onClick={() => startTrigPractice(selectedTrigFunctions)}
                        className="mt-2 min-h-10 w-full rounded-xl gradient-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Start Practice
                      </button>
                      <button
                        type="button"
                        onClick={() => startTrigPractice([...TRIG_FUNCTIONS])}
                        className="mt-2 min-h-10 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground transition-colors hover:border-primary/50"
                      >
                        Practice All Functions
                      </button>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
            <Suspense fallback={<div className="h-40" />}><TrigonometryLearning showFullRange={trigProMode} /></Suspense>
          </div>
        </SwipeBack>
      );
    }

    // Check if this category has shape groups (geometry style)
    const shapeGroups = extractShapeGroups(category.formulas);
    const hasShapeGroups = shapeGroups.length > 1 || (shapeGroups.length === 1 && shapeGroups[0].diagram);

    if (hasShapeGroups) {
      const isGeometry = section.id === 'geometry';

      // Geometry: show shape list first, then detail on click
      if (isGeometry && shapeListMode) {
        return (
          <SwipeBack onBack={() => onNavigate(sectionIndex, null)}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => onNavigate(sectionIndex, null)} className="p-2 -ml-2 text-primary">
                  <ArrowLeft size={20} />
                </button>
                <h2 className="font-display font-bold text-lg text-foreground">
                  {category.title}
                </h2>
                <div className="flex items-center gap-2"><ThemeToggle /><DesktopModeToggle /></div>
              </div>
              <div className="flex flex-col gap-3">
                {shapeGroups.map((shape, i) => {
                  const name = shape.label?.replace(/^[◼▬△●◆▶⬡⬠⬟⬢◗⌔⌓▱⏢⬧] ?/, '') || `Shape ${i + 1}`;
                  return (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * MOTION.stagger.standard, duration: MOTION.duration.slow, ease: MOTION.ease.enter }}
                      whileTap={{ scale: MOTION.scale.press }}
                      onClick={() => {
                        setShapeIndex(i);
                        setShapeListMode(false);
                      }}
                      className="flex items-center gap-4 w-full glass-lite border border-border rounded-2xl px-4 py-3 hover:border-primary transition-colors"
                    >
                      <span className="w-14 h-14 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                        {shape.diagram ? (
                          <ShapeDiagram type={shape.diagram} className="w-10 h-10" />
                        ) : (
                          <span className="font-bold text-lg">{i + 1}</span>
                        )}
                      </span>
                      <span className="font-display font-semibold text-foreground text-base flex-1 text-left">
                        {name}
                      </span>
                      <span className="text-muted-foreground">›</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </SwipeBack>
        );
      }

      // Geometry-style: one shape per swipeable page
      const items = shapeGroups.map((shape, i) => (
        <div key={i} className="space-y-3">
          {/* Shape title */}
          {shape.label && (
            <h3 className="font-display font-bold text-base text-center text-foreground">
              {shape.label.replace(/^[◼▬△●◆▶⬡⬠⬟⬢] ?/, '')}
            </h3>
          )}
          <ShapeCard shape={shape} />
        </div>
      ));

      // Pagination indicator
      const currentShape = shapeGroups[shapeIndex] || shapeGroups[0];
      const displayTitle = currentShape?.label?.replace(/^[◼▬△●◆▶⬡⬠⬟⬢] ?/, '') || category.title;

      return (
        <SwipeBack onBack={() => isGeometry ? setShapeListMode(true) : onNavigate(sectionIndex, null)}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => isGeometry ? setShapeListMode(true) : onNavigate(sectionIndex, null)} className="p-2 -ml-2 text-primary">
                <ArrowLeft size={20} />
              </button>
              <div className="text-center">
                <h2 className="font-display font-bold text-lg text-foreground">
                  {category.title}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {shapeIndex + 1} / {shapeGroups.length}
                </span>
              </div>
              <div className="flex items-center gap-2"><ThemeToggle /><DesktopModeToggle /></div>
            </div>

            <SwipeContainer
              items={items}
              currentIndex={shapeIndex}
              onIndexChange={setShapeIndex}
            />

            {/* Dot indicators */}
            {shapeGroups.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-4">
                {shapeGroups.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setShapeIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === shapeIndex ? 'bg-primary w-4' : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </SwipeBack>
      );
    }

    // Non-geometry: swipe between categories (algebra, series)
    const items = section.categories.map((cat) => (
      <div key={cat.id} className="space-y-3">
        {cat.formulas.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * MOTION.stagger.micro, duration: MOTION.duration.standard, ease: MOTION.ease.enter }}
            className="glass-lite border border-border rounded-xl px-4 py-3 overflow-x-auto"
          >
            <KaTeXBlock latex={f.latex} />
          </motion.div>
        ))}
      </div>
    ));

    return (
      <SwipeBack onBack={() => onNavigate(sectionIndex, null)}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => onNavigate(sectionIndex, null)} className="p-2 -ml-2 text-primary">
              <ArrowLeft size={20} />
            </button>
            <h2 className="font-display font-bold text-lg text-foreground">
              {category.title}
            </h2>
            <div className="flex items-center gap-2"><ThemeToggle /><DesktopModeToggle /></div>
          </div>
          <SwipeContainer
            items={items}
            currentIndex={categoryIndex}
            onIndexChange={(i) => onNavigate(sectionIndex, i)}
          />
        </div>
      </SwipeBack>
    );
  }

  // Level 2: Categories within a section
  if (sectionIndex !== null) {
    const section = FORMULA_SECTIONS[sectionIndex];
    if (!section) return null;

    return (
      <SwipeBack onBack={() => onNavigate(null, null)}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => onNavigate(null, null)} className="p-2 -ml-2 text-primary">
              <ArrowLeft size={20} />
            </button>
            <h2 className="font-display font-bold text-lg text-foreground">
              {section.title}
            </h2>
            <div className="flex items-center gap-2"><ThemeToggle /><DesktopModeToggle /></div>
          </div>
          <div className="flex flex-col gap-3">
            {section.categories.map((cat, i) => (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * MOTION.stagger.standard, duration: MOTION.duration.slow, ease: MOTION.ease.enter }}
                whileTap={{ scale: MOTION.scale.press }}
                onClick={() => onNavigate(sectionIndex, i)}
                className="flex items-center gap-4 w-full glass-lite border border-border rounded-2xl px-5 py-4 hover:border-primary transition-colors"
              >
                <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {cat.symbol}
                </span>
                <span className="font-display font-semibold text-foreground text-base flex-1 text-left">
                  {cat.title}
                </span>
                <span className="text-muted-foreground">›</span>
              </motion.button>
            ))}
          </div>
        </div>
      </SwipeBack>
    );
  }

  // Level 1: Main sections
  return (
    <div className="flex flex-col gap-3">
      {FORMULA_SECTIONS.map((sec, i) => (
        <motion.button
          key={sec.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * MOTION.stagger.standard, duration: MOTION.duration.slow, ease: MOTION.ease.enter }}
          whileTap={{ scale: MOTION.scale.press }}
          onClick={() => onNavigate(i, null)}
          className="flex items-center gap-4 w-full glass-lite border border-border rounded-2xl px-5 py-4 hover:border-primary transition-colors"
        >
          <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
            {sec.symbol}
          </span>
          <span className="font-display font-semibold text-foreground text-base flex-1 text-left">
            {sec.title}
          </span>
          <span className="text-muted-foreground text-xs">{sec.categories.length} topics</span>
          <span className="text-muted-foreground">›</span>
        </motion.button>
      ))}
    </div>
  );
};

export default FormulasLearning;
