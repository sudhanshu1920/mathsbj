import { m as motion } from 'framer-motion';
import { MOTION } from '@/lib/motion';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import ThemeToggle from '@/components/ThemeToggle';
import DesktopModeToggle from '@/components/DesktopModeToggle';
import SwipeBack from '@/components/SwipeBack';
import SwipeContainer from '@/components/SwipeContainer';
import ShapeDiagram from '@/components/ShapeDiagram';
const TrigonometryLearning = lazy(() => import('@/components/TrigonometryLearning'));
const BasicTrigonometricFunctionsLearning = lazy(() => import('@/components/BasicTrigonometricFunctionsLearning'));
import { FORMULA_SECTIONS, type FormulaItem } from '@/lib/formulaData';

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
}

const FormulasLearning = ({ sectionIndex, categoryIndex, onNavigate }: FormulasLearningProps) => {
  const [shapeIndex, setShapeIndex] = useState(0);
  const [shapeListMode, setShapeListMode] = useState(true);

  // Reset shape index + list mode when category changes
  useEffect(() => {
    setShapeIndex(0);
    setShapeListMode(true);
  }, [categoryIndex]);

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
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => onNavigate(sectionIndex, null)} className="p-2 -ml-2 text-primary">
                <ArrowLeft size={20} />
              </button>
              <h2 className="font-display font-bold text-lg text-foreground">
                {category.title}
              </h2>
              <div className="flex items-center gap-2"><ThemeToggle /><DesktopModeToggle /></div>
            </div>
            <Suspense fallback={<div className="h-40" />}><TrigonometryLearning /></Suspense>
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
