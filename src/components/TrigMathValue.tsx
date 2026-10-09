import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Convert the small, trusted notation vocabulary in trigData into real LaTeX. */
export function trigValueToLatex(input: string): string {
  const normalized = input.trim().replace(/\s+/g, '').replace(/−/g, '-');
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;

  const toLatexAtom = (atom: string) =>
    atom
      .replace(/√(\d+)/g, '\\sqrt{$1}')
      .replace(/π/g, '\\pi');

  const slash = unsigned.indexOf('/');
  if (slash >= 0) {
    const numerator = unsigned.slice(0, slash);
    const denominator = unsigned.slice(slash + 1);
    return `${negative ? '-' : ''}\\frac{${toLatexAtom(numerator)}}{${toLatexAtom(denominator)}}`;
  }

  return `${negative ? '-' : ''}${toLatexAtom(unsigned)}`;
}

interface TrigMathValueProps {
  value: string;
}

/** Render exact trigonometric values and radians with KaTeX's real fraction layout. */
const TrigMathValue = ({ value }: TrigMathValueProps) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.replaceChildren();
    katex.render(trigValueToLatex(value), containerRef.current, {
      displayMode: false,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  }, [value]);

  return (
    <span
      ref={containerRef}
      className="trig-math-value inline-flex min-h-[1.4em] items-center justify-center align-middle"
      aria-label={value}
    />
  );
};

export default TrigMathValue;
