import { m as motion } from 'framer-motion';
import katex from 'katex';
import { useEffect, useRef } from 'react';
import { BASIC_TRIG_FUNCTIONS, SOH_CAH_TOA, RECIPROCAL_TRIG_FUNCTIONS, BASIC_TRIG_SUMMARY, BASIC_TRIG_EXAMPLE } from '@/lib/basicTrigonometricFunctions';
import 'katex/dist/katex.min.css';

const KaTeXBlock = ({ latex }: { latex: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    katex.render(latex, ref.current, {
      displayMode: true,
      throwOnError: false,
      strict: false,
    });
  }, [latex]);

  return <div ref={ref} className="katex-formula" />;
};

interface RightTriangleDiagramProps {
  oppositeLabel?: string;
  adjacentLabel?: string;
  hypotenuseLabel?: string;
  compact?: boolean;
}

const RightTriangleDiagram = ({
  oppositeLabel = 'Opposite',
  adjacentLabel = 'Adjacent',
  hypotenuseLabel = 'Hypotenuse',
  compact = false,
}: RightTriangleDiagramProps) => {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-background/70 px-2 py-3">
      <svg
        viewBox="0 0 420 285"
        width="100%"
        height="auto"
        role="img"
        aria-label="Right-angled triangle showing opposite, adjacent and hypotenuse relative to theta"
        className={compact ? 'mx-auto max-w-[280px]' : 'mx-auto max-w-[420px]'}
      >
        <line x1="95" y1="230" x2="95" y2="70" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" />
        <line x1="95" y1="230" x2="335" y2="230" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" />
        <line x1="95" y1="70" x2="335" y2="230" stroke="hsl(var(--foreground))" strokeWidth="5" strokeLinecap="round" />

        <polyline points="95,205 120,205 120,230" fill="none" stroke="hsl(var(--accent))" strokeWidth="4" />
        <path d="M 145 230 A 50 50 0 0 1 130 199" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" />
        <text x="137" y="215" fill="hsl(var(--primary))" fontSize="23" fontWeight="800">θ</text>

        <text x="214" y="127" fill="hsl(var(--foreground))" fontSize="18" fontWeight="800" textAnchor="middle" transform="rotate(34 214 127)">
          {hypotenuseLabel}
        </text>
        <text x="65" y="155" fill="hsl(var(--primary))" fontSize="17" fontWeight="800" textAnchor="middle" transform="rotate(-90 65 155)">
          {oppositeLabel}
        </text>
        <text x="215" y="257" fill="hsl(var(--primary))" fontSize="17" fontWeight="800" textAnchor="middle">
          {adjacentLabel}
        </text>
      </svg>
    </div>
  );
};

const FormulaCard = ({ title, memory, latex }: { title: string; memory: string; latex: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-2xl border border-border bg-card px-4 py-4 sm:px-5"
  >
    <div className="mb-2 flex items-center justify-between gap-3">
      <h3 className="font-display text-base font-black text-primary sm:text-lg">{title}</h3>
      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-primary">
        {memory}
      </span>
    </div>
    <div className="overflow-hidden rounded-xl bg-secondary/45 px-2 py-3 sm:px-3">
      <KaTeXBlock latex={latex} />
    </div>
  </motion.div>
);

const BasicTrigonometricFunctionsLearning = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pb-6"
    >
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="font-display text-lg font-black text-foreground">The six basic trigonometric functions are:</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BASIC_TRIG_FUNCTIONS.map((item) => (
            <div key={item.name} className="rounded-xl border border-border bg-secondary/35 px-3 py-2.5">
              <p className="font-display text-sm font-extrabold text-foreground">{item.name}</p>
              <p className="mt-0.5 text-xs font-semibold text-primary">{item.symbol}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          These ratios are defined using the sides of a <span className="font-bold text-foreground">right-angled triangle</span> with respect to a chosen angle <span className="font-bold text-primary">θ</span>.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <div className="mb-2">
          <p className="font-display text-sm font-black uppercase tracking-wider text-primary">Right-Triangle Reference</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">The side names are relative to θ.</p>
        </div>
        <RightTriangleDiagram />
      </section>

      <section>
        <div className="mb-3">
          <h3 className="font-display text-lg font-black text-foreground">Six Basic Trigonometric Formulas</h3>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">Use the same triangle-side definitions shown above.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {BASIC_TRIG_FUNCTIONS.map((item) => (
            <FormulaCard key={item.name} title={item.title} memory={item.memory} latex={item.latex} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="font-display text-lg font-black text-foreground">SOH – CAH – TOA</h3>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">A quick memory aid for the three primary ratios.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {SOH_CAH_TOA.map((item) => (
            <div key={item.key} className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="font-display text-xl font-black text-primary">{item.key}</div>
              <p className="mt-1 text-sm font-bold text-foreground">{item.formula}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.meaning}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="font-display text-lg font-black text-foreground">Reciprocal Relationships</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {RECIPROCAL_TRIG_FUNCTIONS.map((item) => (
            <div key={item.symbol} className="rounded-xl border border-border bg-secondary/30 px-3 py-3">
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{item.description}</p>
              <div className="mt-2 overflow-hidden">
                <KaTeXBlock latex={item.latex} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-secondary px-3 py-1.5 text-foreground">csc = reciprocal of sin</span>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-foreground">sec = reciprocal of cos</span>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-foreground">cot = reciprocal of tan</span>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="font-display text-lg font-black text-foreground">Example: 3–4–5 Right Triangle</h3>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          With respect to the shown θ: Opposite = 3, Adjacent = 4, Hypotenuse = 5.
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <RightTriangleDiagram oppositeLabel="3 (Opposite)" adjacentLabel="4 (Adjacent)" hypotenuseLabel="5 (Hypotenuse)" compact />
          <div className="grid gap-2 sm:grid-cols-2">
            {BASIC_TRIG_EXAMPLE.map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-secondary/30 px-3 py-3">
                <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{item.label}</div>
                <div className="mt-1 overflow-hidden"><KaTeXBlock latex={item.latex} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="font-display text-lg font-black text-foreground">Formula Summary</h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-primary/10">
                <th className="w-[23%] border-b border-border px-2 py-2.5 text-left font-display font-extrabold text-primary sm:px-3">Function</th>
                <th className="w-[47%] border-b border-border px-2 py-2.5 text-left font-display font-extrabold text-primary sm:px-3">Formula</th>
                <th className="w-[30%] border-b border-border px-2 py-2.5 text-left font-display font-extrabold text-primary sm:px-3">Memory</th>
              </tr>
            </thead>
            <tbody>
              {BASIC_TRIG_SUMMARY.map((row) => (
                <tr key={row.function}>
                  <td className="border-b border-border px-2 py-2.5 align-top font-bold text-foreground sm:px-3">{row.function}</td>
                  <td className="border-b border-border px-2 py-2.5 align-top font-semibold leading-5 text-foreground break-words sm:px-3">{row.formula}</td>
                  <td className="border-b border-border px-2 py-2.5 align-top font-semibold leading-5 text-muted-foreground break-words sm:px-3">{row.memory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </motion.div>
  );
};

export default BasicTrigonometricFunctionsLearning;
