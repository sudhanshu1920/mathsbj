import { m as motion } from 'framer-motion';
import katex from 'katex';
import { useEffect, useRef } from 'react';
import { BASIC_TRIG_EXAMPLE, BASIC_TRIG_FUNCTIONS, RECIPROCAL_TRIG_FUNCTIONS, SOH_CAH_TOA } from '@/lib/basicTrigonometricFunctions';
import 'katex/dist/katex.min.css';

const KaTeXBlock = ({ latex, className = '' }: { latex: string; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    katex.render(latex, ref.current, {
      displayMode: true,
      throwOnError: false,
      strict: false,
      output: 'html',
    });
  }, [latex]);

  return <div ref={ref} className={className} />;
};

const RightTriangleDiagram = () => (
  <div className="w-full overflow-hidden rounded-2xl border border-border/70 bg-background/55 p-2 sm:p-4">
    <svg
      viewBox="0 0 420 300"
      width="100%"
      height="auto"
      role="img"
      aria-labelledby="basic-trig-diagram-title basic-trig-diagram-desc"
      className="mx-auto block w-full max-w-[420px]"
      preserveAspectRatio="xMidYMid meet"
    >
      <title id="basic-trig-diagram-title">Right triangle for trigonometric ratios</title>
      <desc id="basic-trig-diagram-desc">
        A right triangle with theta at the lower-right angle. The vertical side is Opposite, the bottom side is Adjacent, and the sloping side opposite the 90 degree angle is Hypotenuse.
      </desc>

      <line
        x1="88"
        y1="238"
        x2="88"
        y2="68"
        stroke="hsl(var(--primary))"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1="88"
        y1="238"
        x2="334"
        y2="238"
        stroke="hsl(var(--primary))"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1="88"
        y1="68"
        x2="334"
        y2="238"
        stroke="hsl(var(--foreground))"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <polyline
        points="88,213 113,213 113,238"
        fill="none"
        stroke="hsl(var(--accent))"
        strokeWidth="3.5"
      />

      <path
        d="M 334 238 A 42 42 0 0 0 299 209"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="3"
      />
      <text
        x="302"
        y="214"
        fill="hsl(var(--primary))"
        fontSize="22"
        fontWeight="700"
        textAnchor="middle"
      >
        θ
      </text>

      <text
        x="48"
        y="154"
        fill="hsl(var(--primary))"
        fontSize="16"
        fontWeight="700"
        textAnchor="middle"
        transform="rotate(-90 48 154)"
      >
        Opposite
      </text>

      <text
        x="211"
        y="266"
        fill="hsl(var(--primary))"
        fontSize="16"
        fontWeight="700"
        textAnchor="middle"
      >
        Adjacent
      </text>

      <text
        x="222"
        y="134"
        fill="hsl(var(--foreground))"
        fontSize="15"
        fontWeight="700"
        textAnchor="middle"
        transform="rotate(35 222 134)"
        paintOrder="stroke"
        stroke="hsl(var(--background))"
        strokeWidth="7"
        strokeLinejoin="round"
      >
        Hypotenuse
      </text>

      <text
        x="126"
        y="228"
        fill="hsl(var(--accent))"
        fontSize="12"
        fontWeight="800"
      >
        90°
      </text>
    </svg>
  </div>
);

const FormulaRow = ({ item }: { item: (typeof BASIC_TRIG_FUNCTIONS)[number] }) => (
  <div className="grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-2 rounded-xl border border-border/70 bg-background/35 px-3 py-2.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:px-4">
    <div className="font-display text-base font-black text-primary sm:text-lg">
      {item.symbol}
    </div>
    <div className="min-w-0 overflow-x-auto py-1">
      <KaTeXBlock latex={item.latex} className="min-w-max text-[1.05rem] sm:text-[1.15rem]" />
    </div>
  </div>
);

const BasicTrigonometricFunctionsLearning = () => {
  const primaryRatios = BASIC_TRIG_FUNCTIONS.slice(0, 3);
  const reciprocalRatios = BASIC_TRIG_FUNCTIONS.slice(3);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pb-6 sm:space-y-5"
    >
      <section className="glass-panel rounded-2xl p-4 sm:p-5">
        <h1 className="sr-only">Basic Trigonometric Functions</h1>
        <RightTriangleDiagram />
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-black text-foreground sm:text-lg">Trigonometric Ratios</h2>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">SOH · CAH · TOA</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {primaryRatios.map((item) => (
            <FormulaRow key={item.name} item={item} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
        <h2 className="font-display text-base font-black text-foreground sm:text-lg">Reciprocal Ratios</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {reciprocalRatios.map((item) => (
            <FormulaRow key={item.name} item={item} />
          ))}
        </div>

        <div className="mt-4 border-t border-border/60 pt-4">
          <h3 className="font-display text-sm font-black text-foreground">Reciprocal relationships</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {RECIPROCAL_TRIG_FUNCTIONS.map((item) => (
              <div key={item.symbol} className="min-w-0 overflow-x-auto rounded-xl bg-secondary/35 px-2 py-2.5">
                <KaTeXBlock latex={item.latex} className="min-w-max text-[1rem] sm:text-[1.05rem]" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
        <h2 className="font-display text-base font-black text-foreground sm:text-lg">SOH – CAH – TOA</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {SOH_CAH_TOA.map((item) => {
            const ratio = primaryRatios.find((entry) => entry.name === item.function);
            if (!ratio) return null;

            return (
              <div key={item.key} className="flex items-center gap-3 rounded-xl border border-primary/15 bg-card/55 px-3 py-2.5">
                <span className="font-display text-sm font-black text-primary">{item.key}</span>
                <div className="min-w-0 flex-1 overflow-x-auto">
                  <KaTeXBlock latex={ratio.latex} className="min-w-max text-[0.95rem]" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
        <h2 className="font-display text-base font-black text-foreground sm:text-lg">3–4–5 Example</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {BASIC_TRIG_EXAMPLE.map((item) => (
            <div key={item.label} className="min-w-0 overflow-x-auto rounded-xl border border-border/70 bg-background/35 px-3 py-2.5">
              <KaTeXBlock latex={item.latex} className="min-w-max text-[1.05rem] sm:text-[1.1rem]" />
            </div>
          ))}
        </div>
      </section>
    </motion.article>
  );
};

export default BasicTrigonometricFunctionsLearning;
