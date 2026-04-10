export interface FormulaCategory {
  id: string;
  title: string;
  symbol: string;
  formulas: FormulaItem[];
}

export interface FormulaItem {
  /** HTML string for rendering math expressions */
  html: string;
}

const powersFormulas: FormulaItem[] = [
  { html: '<i>a</i><sup><i>m</i></sup><i>b</i><sup><i>m</i></sup> = (<i>ab</i>)<sup><i>m</i></sup>' },
  { html: '<i>a</i><sup><i>m</i></sup><i>a</i><sup><i>n</i></sup> = <i>a</i><sup><i>m</i>+<i>n</i></sup>' },
  { html: '(<i>a</i>/<i>b</i>)<sup><i>m</i></sup> = <i>a</i><sup><i>m</i></sup> / <i>b</i><sup><i>m</i></sup>' },
  { html: '<i>a</i><sup><i>m</i></sup> / <i>a</i><sup><i>n</i></sup> = <i>a</i><sup><i>m</i>−<i>n</i></sup>' },
  { html: '(<i>a</i><sup><i>m</i></sup>)<sup><i>n</i></sup> = <i>a</i><sup><i>mn</i></sup>' },
  { html: '<i>a</i><sup>−<i>m</i></sup> = 1 / <i>a</i><sup><i>m</i></sup>' },
  { html: '<i>a</i><sup><i>m</i>/<i>n</i></sup> = <sup><i>n</i></sup>√(<i>a</i><sup><i>m</i></sup>)' },
  { html: '<i>a</i><sup>0</sup> = 1, <i>a</i> ≠ 0' },
  { html: '<i>a</i><sup>1</sup> = <i>a</i>' },
];

const productFormulas: FormulaItem[] = [
  { html: '(<i>a</i> − <i>b</i>)<sup>2</sup> = <i>a</i><sup>2</sup> − 2<i>ab</i> + <i>b</i><sup>2</sup>' },
  { html: '(<i>a</i> + <i>b</i>)<sup>2</sup> = <i>a</i><sup>2</sup> + 2<i>ab</i> + <i>b</i><sup>2</sup>' },
  { html: '(<i>a</i> + <i>b</i>)<sup>3</sup> = <i>a</i><sup>3</sup> + 3<i>a</i><sup>2</sup><i>b</i> + 3<i>ab</i><sup>2</sup> + <i>b</i><sup>3</sup>' },
  { html: '(<i>a</i> − <i>b</i>)<sup>3</sup> = <i>a</i><sup>3</sup> − 3<i>a</i><sup>2</sup><i>b</i> + 3<i>ab</i><sup>2</sup> − <i>b</i><sup>3</sup>' },
  { html: '(<i>a</i> + <i>b</i>)<sup>4</sup> = <i>a</i><sup>4</sup> + 4<i>a</i><sup>3</sup><i>b</i> + 6<i>a</i><sup>2</sup><i>b</i><sup>2</sup> + 4<i>ab</i><sup>3</sup> + <i>b</i><sup>4</sup>' },
  { html: '(<i>a</i> − <i>b</i>)<sup>4</sup> = <i>a</i><sup>4</sup> − 4<i>a</i><sup>3</sup><i>b</i> + 6<i>a</i><sup>2</sup><i>b</i><sup>2</sup> − 4<i>ab</i><sup>3</sup> + <i>b</i><sup>4</sup>' },
  { html: '(<i>a</i> + <i>b</i> + <i>c</i>)<sup>2</sup> = <i>a</i><sup>2</sup> + <i>b</i><sup>2</sup> + <i>c</i><sup>2</sup> + 2<i>ab</i> + 2<i>ac</i> + 2<i>bc</i>' },
  { html: '(<i>a</i> + <i>b</i> + <i>c</i> + …)<sup>2</sup> = <i>a</i><sup>2</sup> + <i>b</i><sup>2</sup> + <i>c</i><sup>2</sup> + … + 2(<i>ab</i> + <i>ac</i> + <i>bc</i> + …)' },
];

const factoringFormulas: FormulaItem[] = [
  { html: '<i>a</i><sup>2</sup> − <i>b</i><sup>2</sup> = (<i>a</i> + <i>b</i>)(<i>a</i> − <i>b</i>)' },
  { html: '<i>a</i><sup>3</sup> − <i>b</i><sup>3</sup> = (<i>a</i> − <i>b</i>)(<i>a</i><sup>2</sup> + <i>ab</i> + <i>b</i><sup>2</sup>)' },
  { html: '<i>a</i><sup>3</sup> + <i>b</i><sup>3</sup> = (<i>a</i> + <i>b</i>)(<i>a</i><sup>2</sup> − <i>ab</i> + <i>b</i><sup>2</sup>)' },
  { html: '<i>a</i><sup>4</sup> − <i>b</i><sup>4</sup> = (<i>a</i><sup>2</sup> − <i>b</i><sup>2</sup>)(<i>a</i><sup>2</sup> + <i>b</i><sup>2</sup>) = (<i>a</i> + <i>b</i>)(<i>a</i> − <i>b</i>)(<i>a</i><sup>2</sup> + <i>b</i><sup>2</sup>)' },
  { html: '<i>a</i><sup>5</sup> − <i>b</i><sup>5</sup> = (<i>a</i> − <i>b</i>)(<i>a</i><sup>4</sup> + <i>a</i><sup>3</sup><i>b</i> + <i>a</i><sup>2</sup><i>b</i><sup>2</sup> + <i>ab</i><sup>3</sup> + <i>b</i><sup>4</sup>)' },
  { html: '<i>a</i><sup>5</sup> + <i>b</i><sup>5</sup> = (<i>a</i> + <i>b</i>)(<i>a</i><sup>4</sup> − <i>a</i><sup>3</sup><i>b</i> + <i>a</i><sup>2</sup><i>b</i><sup>2</sup> − <i>ab</i><sup>3</sup> + <i>b</i><sup>4</sup>)' },
];

const rootsFormulas: FormulaItem[] = [
  { html: '<sup><i>n</i></sup>√<i>a</i> · <sup><i>m</i></sup>√<i>b</i> = <sup><i>nm</i></sup>√(<i>a</i><sup><i>m</i></sup><i>b</i><sup><i>n</i></sup>)' },
  { html: '<sup><i>n</i></sup>√(<i>ab</i>) = <sup><i>n</i></sup>√<i>a</i> · <sup><i>n</i></sup>√<i>b</i>' },
  { html: '<sup><i>n</i></sup>√(<i>a</i>/<i>b</i>) = <sup><i>n</i></sup>√<i>a</i> / <sup><i>n</i></sup>√<i>b</i>' },
  { html: '(<sup><i>n</i></sup>√<i>a</i>)<sup><i>n</i></sup> = <i>a</i>' },
  { html: '<sup><i>n</i></sup>√(<i>a</i><sup><i>m</i></sup>) = <i>a</i><sup><i>m</i>/<i>n</i></sup>' },
  { html: '(<sup><i>n</i></sup>√<i>a</i>)<sup><i>m</i></sup> = <sup><i>n</i></sup>√(<i>a</i><sup><i>m</i></sup>)' },
  { html: '<sup><i>m</i></sup>√(<sup><i>n</i></sup>√<i>a</i>) = <sup><i>mn</i></sup>√<i>a</i>' },
  { html: '1 / <sup><i>n</i></sup>√<i>a</i> = <sup><i>n</i></sup>√(<i>a</i><sup><i>n</i>−1</sup>) / <i>a</i>' },
];

const arithmeticSeries: FormulaItem[] = [
  { html: '<i>a</i><sub>1</sub> = Initial term' },
  { html: '<i>a<sub>n</sub></i> = N<sup>th</sup> term' },
  { html: '<i>d</i> = Difference between successive terms' },
  { html: '<i>n</i> = Number of terms in the series' },
  { html: '<i>S<sub>n</sub></i> = Sum of <i>n</i> terms' },
  { html: '<span style="text-decoration:overline"><i>N</i></span> = Mean value' },
  { html: '<i>a<sub>n</sub></i> = <i>a</i><sub>1</sub> + (<i>n</i> − 1)<i>d</i>' },
  { html: '<i>S<sub>n</sub></i> = (<i>n</i>/2)[2<i>a</i><sub>1</sub> + (<i>n</i> − 1)<i>d</i>]' },
  { html: '<i>S<sub>n</sub></i> = <i>n</i>(<i>a</i><sub>1</sub> + <i>a<sub>n</sub></i>) / 2' },
  { html: '<span style="text-decoration:overline"><i>N</i></span> = <i>S<sub>n</sub></i> / <i>n</i>' },
  { html: '<span style="text-decoration:overline"><i>N</i></span> = (<i>a</i><sub>1</sub> + <i>a<sub>n</sub></i>) / 2' },
];

const geometricSeries: FormulaItem[] = [
  { html: '<i>a</i><sub>1</sub> = Initial term' },
  { html: '<i>a<sub>n</sub></i> = N<sup>th</sup> term' },
  { html: '<i>r</i> = Common ratio' },
  { html: '<i>n</i> = Number of terms in the series' },
  { html: '<i>S<sub>n</sub></i> = Sum of <i>n</i> terms' },
  { html: '<i>a<sub>n</sub></i> = <i>a</i> · <i>r</i><sup><i>n</i>−1</sup>' },
  { html: '<i>S<sub>n</sub></i> = <i>a</i><sub>1</sub>(<i>r<sup>n</sup></i> − 1) / (<i>r</i> − 1)' },
  { html: '<i>S</i><sub>∞</sub> = <i>a</i><sub>1</sub> / (1 − <i>r</i>),  |<i>r</i>| &lt; 1' },
];

const finiteSeries: FormulaItem[] = [
  { html: '1 + 2 + 3 + … + <i>n</i> = <i>n</i>(<i>n</i> + 1) / 2' },
  { html: '2 + 4 + 6 + … + 2<i>n</i> = <i>n</i>(<i>n</i> + 1)' },
  { html: '1 + 3 + 5 + … + (2<i>n</i> − 1) = <i>n</i><sup>2</sup>' },
  { html: '1<sup>2</sup> + 2<sup>2</sup> + 3<sup>2</sup> + … + <i>n</i><sup>2</sup> = <i>n</i>(<i>n</i> + 1)(2<i>n</i> + 1) / 6' },
  { html: '1<sup>2</sup> + 3<sup>2</sup> + 5<sup>2</sup> + … + (2<i>n</i> − 1)<sup>2</sup> = <i>n</i>(4<i>n</i><sup>2</sup> − 1) / 3' },
  { html: '1<sup>3</sup> + 2<sup>3</sup> + 3<sup>3</sup> + … + <i>n</i><sup>3</sup> = [<i>n</i>(<i>n</i> + 1) / 2]<sup>2</sup>' },
  { html: '1<sup>3</sup> + 3<sup>3</sup> + 5<sup>3</sup> + … + (2<i>n</i> − 1)<sup>3</sup> = <i>n</i><sup>2</sup>(2<i>n</i><sup>2</sup> − 1)' },
  { html: '1 + 1/2 + 1/4 + … + 1/2<sup><i>n</i></sup> + … = 2' },
  { html: '1 + 1/1! + 1/2! + … + 1/(<i>n</i> − 1)! + … = <i>e</i>' },
];

const binomialSeries: FormulaItem[] = [
  { html: '1/(1 + <i>x</i>) = 1 − <i>x</i> + <i>x</i><sup>2</sup> − <i>x</i><sup>3</sup> + …,  |<i>x</i>| &lt; 1' },
  { html: '1/(1 − <i>x</i>) = 1 + <i>x</i> + <i>x</i><sup>2</sup> + <i>x</i><sup>3</sup> + …,  |<i>x</i>| &lt; 1' },
  { html: '1/(1 + <i>x</i>)<sup>2</sup> = 1 − 2<i>x</i> + 3<i>x</i><sup>2</sup> − 4<i>x</i><sup>3</sup> + …,  |<i>x</i>| &lt; 1' },
  { html: '1/(1 − <i>x</i>)<sup>2</sup> = 1 + 2<i>x</i> + 3<i>x</i><sup>2</sup> + 4<i>x</i><sup>3</sup> + …,  |<i>x</i>| &lt; 1' },
  { html: '√(1 + <i>x</i>) = 1 + <i>x</i>/2 − <i>x</i><sup>2</sup>/(2·4) + (1·3<i>x</i><sup>3</sup>)/(2·4·6) − …,  |<i>x</i>| ≤ 1' },
  { html: '√(1 − <i>x</i>) = 1 − <i>x</i>/2 − <i>x</i><sup>2</sup>/(2·4) − (1·3<i>x</i><sup>3</sup>)/(2·4·6) − …,  |<i>x</i>| ≤ 1' },
  { html: '1/√(1 + <i>x</i>) = 1 − <i>x</i>/2 + (1·3<i>x</i><sup>2</sup>)/(2·4) − …,  |<i>x</i>| ≤ 1' },
  { html: '1/√(1 − <i>x</i>) = 1 + <i>x</i>/2 + (1·3<i>x</i><sup>2</sup>)/(2·4) + …,  |<i>x</i>| ≤ 1' },
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
