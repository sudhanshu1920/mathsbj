export interface FormulaCategory {
  id: string;
  title: string;
  symbol: string;
  formulas: FormulaItem[];
}

export interface FormulaItem {
  /** LaTeX string for rendering with KaTeX */
  latex: string;
}

const powersFormulas: FormulaItem[] = [
  { latex: 'a^m \\cdot b^m = (ab)^m' },
  { latex: 'a^m \\cdot a^n = a^{m+n}' },
  { latex: '\\left(\\dfrac{a}{b}\\right)^m = \\dfrac{a^m}{b^m}' },
  { latex: '\\dfrac{a^m}{a^n} = a^{m-n}' },
  { latex: '\\left(a^m\\right)^n = a^{mn}' },
  { latex: 'a^{-m} = \\dfrac{1}{a^m}' },
  { latex: 'a^{\\frac{m}{n}} = \\sqrt[n]{a^m}' },
  { latex: 'a^0 = 1, \\quad a \\neq 0' },
  { latex: 'a^1 = a' },
];

const productFormulas: FormulaItem[] = [
  { latex: '(a - b)^2 = a^2 - 2ab + b^2' },
  { latex: '(a + b)^2 = a^2 + 2ab + b^2' },
  { latex: '(a + b)^3 = a^3 + 3a^2b + 3ab^2 + b^3' },
  { latex: '(a - b)^3 = a^3 - 3a^2b + 3ab^2 - b^3' },
  { latex: '(a + b)^4 = a^4 + 4a^3b + 6a^2b^2 + 4ab^3 + b^4' },
  { latex: '(a - b)^4 = a^4 - 4a^3b + 6a^2b^2 - 4ab^3 + b^4' },
  { latex: '(a + b + c)^2 = a^2 + b^2 + c^2 + 2ab + 2ac + 2bc' },
  { latex: '(a + b + c + \\cdots)^2 = a^2 + b^2 + c^2 + \\cdots + 2(ab + ac + bc + \\cdots)' },
];

const factoringFormulas: FormulaItem[] = [
  { latex: 'a^2 - b^2 = (a + b)(a - b)' },
  { latex: 'a^3 - b^3 = (a - b)(a^2 + ab + b^2)' },
  { latex: 'a^3 + b^3 = (a + b)(a^2 - ab + b^2)' },
  { latex: 'a^4 - b^4 = (a + b)(a - b)(a^2 + b^2)' },
  { latex: 'a^5 - b^5 = (a - b)(a^4 + a^3b + a^2b^2 + ab^3 + b^4)' },
  { latex: 'a^5 + b^5 = (a + b)(a^4 - a^3b + a^2b^2 - ab^3 + b^4)' },
];

const rootsFormulas: FormulaItem[] = [
  { latex: '\\sqrt[n]{a} \\cdot \\sqrt[m]{b} = \\sqrt[nm]{a^m \\cdot b^n}' },
  { latex: '\\sqrt[n]{ab} = \\sqrt[n]{a} \\cdot \\sqrt[n]{b}' },
  { latex: '\\sqrt[n]{\\dfrac{a}{b}} = \\dfrac{\\sqrt[n]{a}}{\\sqrt[n]{b}}' },
  { latex: '\\left(\\sqrt[n]{a}\\right)^n = a' },
  { latex: '\\sqrt[n]{a^m} = a^{\\frac{m}{n}}' },
  { latex: '\\left(\\sqrt[n]{a}\\right)^m = \\sqrt[n]{a^m}' },
  { latex: '\\sqrt[m]{\\sqrt[n]{a}} = \\sqrt[mn]{a}' },
  { latex: '\\dfrac{1}{\\sqrt[n]{a}} = \\dfrac{\\sqrt[n]{a^{n-1}}}{a}' },
];

const arithmeticSeries: FormulaItem[] = [
  { latex: 'a_1 = \\text{Initial term}' },
  { latex: 'a_n = n^{\\text{th}} \\text{ term}' },
  { latex: 'd = \\text{Difference between successive terms}' },
  { latex: 'n = \\text{Number of terms in the series}' },
  { latex: 'S_n = \\text{Sum of } n \\text{ terms}' },
  { latex: '\\bar{N} = \\text{Mean value}' },
  { latex: 'a_n = a_1 + (n - 1)d' },
  { latex: 'S_n = \\dfrac{n}{2}\\left[2a_1 + (n - 1)d\\right]' },
  { latex: 'S_n = \\dfrac{n(a_1 + a_n)}{2}' },
  { latex: '\\bar{N} = \\dfrac{S_n}{n}' },
  { latex: '\\bar{N} = \\dfrac{a_1 + a_n}{2}' },
];

const geometricSeries: FormulaItem[] = [
  { latex: 'a_1 = \\text{Initial term}' },
  { latex: 'a_n = n^{\\text{th}} \\text{ term}' },
  { latex: 'r = \\text{Common ratio}' },
  { latex: 'n = \\text{Number of terms in the series}' },
  { latex: 'S_n = \\text{Sum of } n \\text{ terms}' },
  { latex: 'a_n = a \\cdot r^{n-1}' },
  { latex: 'S_n = \\dfrac{a_1(r^n - 1)}{r - 1}' },
  { latex: 'S_{\\infty} = \\dfrac{a_1}{1 - r}, \\quad |r| < 1' },
];

const finiteSeries: FormulaItem[] = [
  { latex: '1 + 2 + 3 + \\cdots + n = \\dfrac{n(n + 1)}{2}' },
  { latex: '2 + 4 + 6 + \\cdots + 2n = n(n + 1)' },
  { latex: '1 + 3 + 5 + \\cdots + (2n - 1) = n^2' },
  { latex: '1^2 + 2^2 + 3^2 + \\cdots + n^2 = \\dfrac{n(n + 1)(2n + 1)}{6}' },
  { latex: '1^2 + 3^2 + 5^2 + \\cdots + (2n - 1)^2 = \\dfrac{n(4n^2 - 1)}{3}' },
  { latex: '1^3 + 2^3 + 3^3 + \\cdots + n^3 = \\left[\\dfrac{n(n + 1)}{2}\\right]^2' },
  { latex: '1^3 + 3^3 + 5^3 + \\cdots + (2n - 1)^3 = n^2(2n^2 - 1)' },
  { latex: '1 + \\dfrac{1}{2} + \\dfrac{1}{4} + \\cdots + \\dfrac{1}{2^n} + \\cdots = 2' },
  { latex: '1 + \\dfrac{1}{1!} + \\dfrac{1}{2!} + \\cdots + \\dfrac{1}{(n-1)!} + \\cdots = e' },
];

const binomialSeries: FormulaItem[] = [
  { latex: '\\dfrac{1}{1 + x} = 1 - x + x^2 - x^3 + \\cdots, \\quad |x| < 1' },
  { latex: '\\dfrac{1}{1 - x} = 1 + x + x^2 + x^3 + \\cdots, \\quad |x| < 1' },
  { latex: '\\dfrac{1}{(1 + x)^2} = 1 - 2x + 3x^2 - 4x^3 + \\cdots, \\quad |x| < 1' },
  { latex: '\\dfrac{1}{(1 - x)^2} = 1 + 2x + 3x^2 + 4x^3 + \\cdots, \\quad |x| < 1' },
  { latex: '\\sqrt{1 + x} = 1 + \\dfrac{x}{2} - \\dfrac{x^2}{2 \\cdot 4} + \\dfrac{1 \\cdot 3 \\cdot x^3}{2 \\cdot 4 \\cdot 6} - \\cdots, \\quad |x| \\leq 1' },
  { latex: '\\sqrt{1 - x} = 1 - \\dfrac{x}{2} - \\dfrac{x^2}{2 \\cdot 4} - \\dfrac{1 \\cdot 3 \\cdot x^3}{2 \\cdot 4 \\cdot 6} - \\cdots, \\quad |x| \\leq 1' },
  { latex: '\\dfrac{1}{\\sqrt{1 + x}} = 1 - \\dfrac{x}{2} + \\dfrac{1 \\cdot 3 \\cdot x^2}{2 \\cdot 4} - \\cdots, \\quad |x| \\leq 1' },
  { latex: '\\dfrac{1}{\\sqrt{1 - x}} = 1 + \\dfrac{x}{2} + \\dfrac{1 \\cdot 3 \\cdot x^2}{2 \\cdot 4} + \\cdots, \\quad |x| \\leq 1' },
];

export const FORMULA_CATEGORIES: FormulaCategory[] = [
  { id: 'powers', title: 'Powers Formulas', symbol: 'aⁿ', formulas: powersFormulas },
  { id: 'product', title: 'Product Formulas', symbol: '(a+b)²', formulas: productFormulas },
  { id: 'factoring', title: 'Factoring Formulas', symbol: 'a²−b²', formulas: factoringFormulas },
  { id: 'roots', title: 'Roots Formulas', symbol: '√', formulas: rootsFormulas },
  { id: 'arithmetic', title: 'Arithmetic Series', symbol: 'Σ', formulas: arithmeticSeries },
  { id: 'geometric', title: 'Geometric Series', symbol: '∞', formulas: geometricSeries },
  { id: 'finite', title: 'Finite Series', symbol: 'n²', formulas: finiteSeries },
  { id: 'binomial', title: 'Binomial Series', symbol: '(1+x)', formulas: binomialSeries },
];
