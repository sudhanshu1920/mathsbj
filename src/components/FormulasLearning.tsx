import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import ThemeToggle from '@/components/ThemeToggle';
import SwipeBack from '@/components/SwipeBack';
import SwipeContainer from '@/components/SwipeContainer';
import ShapeDiagram from '@/components/ShapeDiagram';
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

/** Renders a group of formulas for one shape/topic with diagram + variables + formulas */
const FormulaGroup = ({ formulas, startIndex }: { formulas: FormulaItem[]; startIndex: number }) => {
  // Find diagram from any formula in the group
  const diagram = formulas.find((f) => f.diagram)?.diagram;
  const variables = formulas.filter((f) => f.isVariable);
  const formulaItems = formulas.filter((f) => !f.isVariable);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: startIndex * 0.02 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      {/* Diagram */}
      {diagram && (
        <div className="flex justify-center pt-4 pb-2">
          <ShapeDiagram type={diagram} className="w-28 h-28" />
        </div>
      )}

      <div className="px-4 pb-4 pt-2 space-y-2">
        {/* Variables */}
        {variables.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Variables</span>
            {variables.map((v, i) => (
              <div key={i} className="text-sm">
                <KaTeXBlock latex={v.latex} />
              </div>
            ))}
          </div>
        )}

        {/* Formulas */}
        {formulaItems.length > 0 && (
          <div className="space-y-1">
            {variables.length > 0 && (
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Formulas</span>
            )}
            {formulaItems.map((f, i) => (
              <div key={i} className="overflow-x-auto">
                <KaTeXBlock latex={f.latex} />
              </div>
            ))}
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

/** Split formulas into groups by sectionLabel */
function groupFormulas(formulas: FormulaItem[]): { label: string; items: FormulaItem[] }[] {
  const groups: { label: string; items: FormulaItem[] }[] = [];
  let current: { label: string; items: FormulaItem[] } | null = null;

  for (const f of formulas) {
    if (f.sectionLabel && (!current || f.sectionLabel !== current.label)) {
      current = { label: f.sectionLabel, items: [] };
      groups.push(current);
    }
    if (!current) {
      current = { label: '', items: [] };
      groups.push(current);
    }
    current.items.push(f);
  }

  return groups;
}

const FormulasLearning = ({ sectionIndex, categoryIndex, onNavigate }: FormulasLearningProps) => {
  // Level 3: Formula list with swipe between categories in a section
  if (sectionIndex !== null && categoryIndex !== null) {
    const section = FORMULA_SECTIONS[sectionIndex];
    const category = section?.categories[categoryIndex];
    if (!section || !category) return null;

    const items = section.categories.map((cat) => {
      const groups = groupFormulas(cat.formulas);
      const hasGroups = groups.some((g) => g.label);

      return (
        <div key={cat.id} className="space-y-4">
          {hasGroups
            ? groups.map((group, gi) => (
                <div key={gi}>
                  {group.label && (
                    <h3 className="font-display font-bold text-sm text-primary mb-2">{group.label}</h3>
                  )}
                  <FormulaGroup formulas={group.items} startIndex={gi} />
                </div>
              ))
            : cat.formulas.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card border border-border rounded-xl px-4 py-3 overflow-x-auto"
                >
                  {f.diagram && <ShapeDiagram type={f.diagram} className="mb-2" />}
                  <KaTeXBlock latex={f.latex} />
                </motion.div>
              ))}
        </div>
      );
    });

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
            <ThemeToggle />
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
            <ThemeToggle />
          </div>
          <div className="flex flex-col gap-3">
            {section.categories.map((cat, i) => (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onNavigate(sectionIndex, i)}
                className="flex items-center gap-4 w-full bg-card border border-border rounded-2xl px-5 py-4 hover:border-primary transition-colors"
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

  // Level 1: Main sections (Algebra, Geometry, Series)
  return (
    <div className="flex flex-col gap-3">
      {FORMULA_SECTIONS.map((sec, i) => (
        <motion.button
          key={sec.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04, duration: 0.3 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onNavigate(i, null)}
          className="flex items-center gap-4 w-full bg-card border border-border rounded-2xl px-5 py-4 hover:border-primary transition-colors"
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
