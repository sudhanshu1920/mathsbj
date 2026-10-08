export interface FormulaItem {
  /** LaTeX string for rendering with KaTeX */
  latex: string;
  /** Optional SVG diagram key for geometry */
  diagram?: string;
  /** Whether this is a variable definition line */
  isVariable?: boolean;
  /** Section label (e.g. "Variables", "Formulas") */
  sectionLabel?: string;
}

export interface FormulaCategory {
  id: string;
  title: string;
  symbol: string;
  formulas: FormulaItem[];
}

export interface FormulaSection {
  id: string;
  title: string;
  symbol: string;
  categories: FormulaCategory[];
}

// ─── ALGEBRA ───

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

// ─── GEOMETRY 2D ───

const squareFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Side length}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'd = \\text{Diagonal}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = a^2', sectionLabel: 'Formulas', diagram: 'square' },
  { latex: 'P = 4a' },
  { latex: 'd = a\\sqrt{2}' },
];

const rectangleFormulas: FormulaItem[] = [
  { latex: 'l = \\text{Length}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'b = \\text{Breadth}', isVariable: true },
  { latex: 'd = \\text{Diagonal}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = l \\times b', sectionLabel: 'Formulas', diagram: 'rectangle' },
  { latex: 'P = 2(l + b)' },
  { latex: 'd = \\sqrt{l^2 + b^2}' },
];

const triangleFormulas: FormulaItem[] = [
  { latex: 'a, b, c = \\text{Sides}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 's = \\text{Semi-perimeter}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = \\dfrac{1}{2} \\times b \\times h', sectionLabel: 'Formulas', diagram: 'triangle' },
  { latex: 'P = a + b + c' },
  { latex: 's = \\dfrac{a + b + c}{2} \\quad \\text{(semi-perimeter)}' },
  { latex: 'A = \\sqrt{s(s-a)(s-b)(s-c)} \\quad \\text{(Heron\'s)}' },
];

const equilateralTriFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Side length}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'h = \\dfrac{a\\sqrt{3}}{2}', sectionLabel: 'Formulas', diagram: 'equilateral-triangle' },
  { latex: 'A = \\dfrac{a^2\\sqrt{3}}{4}' },
  { latex: 'P = 3a' },
];

const isoscelesTriFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Base}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'b = \\text{Equal sides}', isVariable: true },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'h = \\sqrt{b^2 - \\dfrac{a^2}{4}}', sectionLabel: 'Formulas', diagram: 'isosceles-triangle' },
  { latex: 'A = \\dfrac{a \\times h}{2}' },
  { latex: 'P = a + 2b' },
];

const scaleneTriFormulas: FormulaItem[] = [
  { latex: 'a, b, c = \\text{Sides}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 's = \\text{Semi-perimeter}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 's = \\dfrac{a + b + c}{2}', sectionLabel: 'Formulas', diagram: 'scalene-triangle' },
  { latex: 'A = \\sqrt{s(s-a)(s-b)(s-c)}' },
  { latex: 'P = a + b + c' },
];

const rightTriFormulas: FormulaItem[] = [
  { latex: 'a, b = \\text{Legs}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'c = \\text{Hypotenuse}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'c = \\sqrt{a^2 + b^2}', sectionLabel: 'Formulas', diagram: 'right-triangle' },
  { latex: 'A = \\dfrac{1}{2}ab' },
  { latex: 'P = a + b + c' },
];

const circleFormulas: FormulaItem[] = [
  { latex: 'r = \\text{Radius}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'd = \\text{Diameter}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'C = \\text{Circumference}', isVariable: true },
  { latex: 'A = \\pi r^2', sectionLabel: 'Formulas', diagram: 'circle' },
  { latex: 'C = 2\\pi r = \\pi d' },
  { latex: 'd = 2r' },
];

const semicircleFormulas: FormulaItem[] = [
  { latex: 'r = \\text{Radius}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = \\dfrac{\\pi r^2}{2}', sectionLabel: 'Formulas', diagram: 'semicircle' },
  { latex: 'P = \\pi r + 2r' },
];

const sectorFormulas: FormulaItem[] = [
  { latex: 'r = \\text{Radius}', isVariable: true, sectionLabel: 'Variables' },
  { latex: '\\theta = \\text{Angle (degrees)}', isVariable: true },
  { latex: 'l = \\text{Arc length}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = \\dfrac{\\theta}{360} \\times \\pi r^2', sectionLabel: 'Formulas', diagram: 'sector' },
  { latex: 'l = \\dfrac{\\theta}{360} \\times 2\\pi r \\quad \\text{(arc length)}' },
  { latex: 'P = 2r + l' },
];

const segmentFormulas: FormulaItem[] = [
  { latex: 'r = \\text{Radius}', isVariable: true, sectionLabel: 'Variables' },
  { latex: '\\theta = \\text{Central angle}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'A = \\dfrac{r^2}{2}(\\theta - \\sin\\theta) \\quad \\text{(radians)}', sectionLabel: 'Formulas', diagram: 'segment' },
  { latex: 'A = \\dfrac{\\pi r^2 \\theta}{360} - \\dfrac{r^2 \\sin\\theta}{2} \\quad \\text{(degrees)}' },
];

const parallelogramFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Side}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'b = \\text{Base}', isVariable: true },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = b \\times h', sectionLabel: 'Formulas', diagram: 'parallelogram' },
  { latex: 'P = 2(a + b)' },
];

const rhombusFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Side}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'd_1, d_2 = \\text{Diagonals}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = \\dfrac{d_1 \\times d_2}{2}', sectionLabel: 'Formulas', diagram: 'rhombus' },
  { latex: 'P = 4a' },
  { latex: 'a = \\dfrac{1}{2}\\sqrt{d_1^2 + d_2^2}' },
];

const trapeziumFormulas: FormulaItem[] = [
  { latex: 'a, b = \\text{Parallel sides}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = \\dfrac{1}{2}(a + b) \\times h', sectionLabel: 'Formulas', diagram: 'trapezium' },
  { latex: 'P = a + b + c + d' },
];

const kiteFormulas: FormulaItem[] = [
  { latex: 'a, b = \\text{Pairs of sides}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'd_1, d_2 = \\text{Diagonals}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = \\dfrac{d_1 \\times d_2}{2}', sectionLabel: 'Formulas', diagram: 'kite' },
  { latex: 'P = 2(a + b)' },
];

const ellipseFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Semi-major axis}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'b = \\text{Semi-minor axis}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter (approx.)}', isVariable: true },
  { latex: 'A = \\pi ab', sectionLabel: 'Formulas', diagram: 'ellipse' },
  { latex: 'P \\approx \\pi\\left[3(a+b) - \\sqrt{(3a+b)(a+3b)}\\right]' },
];

const polygonFormulas: FormulaItem[] = [
  { latex: 'n = \\text{Number of sides}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'a = \\text{Side length}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: '\\text{Interior angle sum} = (n-2) \\times 180°', sectionLabel: 'Formulas', diagram: 'polygon' },
  { latex: '\\text{Each interior angle} = \\dfrac{(n-2) \\times 180°}{n}' },
  { latex: '\\text{Each exterior angle} = \\dfrac{360°}{n}' },
  { latex: 'A = \\dfrac{1}{2} \\times P \\times \\text{apothem}' },
];

const pentagonFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Side length}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = \\dfrac{a^2\\sqrt{25 + 10\\sqrt{5}}}{4}', sectionLabel: 'Formulas', diagram: 'pentagon' },
  { latex: 'P = 5a' },
  { latex: '\\text{Interior angle} = 108°' },
];

const hexagonFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Side length}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = \\dfrac{3\\sqrt{3}}{2} a^2', sectionLabel: 'Formulas', diagram: 'hexagon' },
  { latex: 'P = 6a' },
  { latex: '\\text{Interior angle} = 120°' },
];

const heptagonFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Side length}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = \\dfrac{7a^2}{4}\\cot\\left(\\dfrac{\\pi}{7}\\right)', sectionLabel: 'Formulas', diagram: 'heptagon' },
  { latex: 'P = 7a' },
  { latex: '\\text{Interior angle} \\approx 128.57°' },
];

const octagonFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Side length}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'A = \\text{Area}', isVariable: true },
  { latex: 'P = \\text{Perimeter}', isVariable: true },
  { latex: 'A = 2(1 + \\sqrt{2})a^2', sectionLabel: 'Formulas', diagram: 'octagon' },
  { latex: 'P = 8a' },
  { latex: '\\text{Interior angle} = 135°' },
];

// ─── GEOMETRY 3D ───

const cubeFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Side length}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'd = \\text{Space diagonal}', isVariable: true },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'SA = \\text{Surface Area}', isVariable: true },
  { latex: 'LSA = \\text{Lateral Surface Area}', isVariable: true },
  { latex: 'V = a^3', sectionLabel: 'Formulas', diagram: 'cube' },
  { latex: 'SA = 6a^2' },
  { latex: 'LSA = 4a^2' },
  { latex: 'd = a\\sqrt{3}' },
];

const cuboidFormulas: FormulaItem[] = [
  { latex: 'l = \\text{Length}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'b = \\text{Width}', isVariable: true },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'd = \\text{Space diagonal}', isVariable: true },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'SA = \\text{Surface Area}', isVariable: true },
  { latex: 'LSA = \\text{Lateral Surface Area}', isVariable: true },
  { latex: 'V = l \\times b \\times h', sectionLabel: 'Formulas', diagram: 'cuboid' },
  { latex: 'SA = 2(lb + bh + lh)' },
  { latex: 'LSA = 2h(l + b)' },
  { latex: 'd = \\sqrt{l^2 + b^2 + h^2}' },
];

const cylinderFormulas: FormulaItem[] = [
  { latex: 'r = \\text{Radius}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'CSA = \\text{Curved Surface Area}', isVariable: true },
  { latex: 'TSA = \\text{Total Surface Area}', isVariable: true },
  { latex: 'V = \\pi r^2 h', sectionLabel: 'Formulas', diagram: 'cylinder' },
  { latex: 'CSA = 2\\pi r h' },
  { latex: 'TSA = 2\\pi r(r + h)' },
];

const coneFormulas: FormulaItem[] = [
  { latex: 'r = \\text{Radius}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'l = \\text{Slant height}', isVariable: true },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'CSA = \\text{Curved Surface Area}', isVariable: true },
  { latex: 'TSA = \\text{Total Surface Area}', isVariable: true },
  { latex: 'V = \\dfrac{1}{3}\\pi r^2 h', sectionLabel: 'Formulas', diagram: 'cone' },
  { latex: 'l = \\sqrt{r^2 + h^2}' },
  { latex: 'CSA = \\pi r l' },
  { latex: 'TSA = \\pi r(r + l)' },
];

const sphereFormulas: FormulaItem[] = [
  { latex: 'r = \\text{Radius}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'SA = \\text{Surface Area}', isVariable: true },
  { latex: 'V = \\dfrac{4}{3}\\pi r^3', sectionLabel: 'Formulas', diagram: 'sphere' },
  { latex: 'SA = 4\\pi r^2' },
];

const hemisphereFormulas: FormulaItem[] = [
  { latex: 'r = \\text{Radius}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'CSA = \\text{Curved Surface Area}', isVariable: true },
  { latex: 'TSA = \\text{Total Surface Area}', isVariable: true },
  { latex: 'V = \\dfrac{2}{3}\\pi r^3', sectionLabel: 'Formulas', diagram: 'hemisphere' },
  { latex: 'CSA = 2\\pi r^2' },
  { latex: 'TSA = 3\\pi r^2' },
];

const prismFormulas: FormulaItem[] = [
  { latex: 'B = \\text{Base area}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'P = \\text{Base perimeter}', isVariable: true },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'LSA = \\text{Lateral Surface Area}', isVariable: true },
  { latex: 'SA = \\text{Surface Area}', isVariable: true },
  { latex: 'V = B \\times h', sectionLabel: 'Formulas', diagram: 'prism' },
  { latex: 'LSA = P \\times h' },
  { latex: 'SA = 2B + P \\times h' },
];

const triangularPrismFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Triangle base}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'b = \\text{Triangle height}', isVariable: true },
  { latex: 'c_1 = \\text{Triangle side 1}', isVariable: true },
  { latex: 'c_2 = \\text{Triangle side 2}', isVariable: true },
  { latex: 'h = \\text{Prism length}', isVariable: true },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'SA = \\text{Surface Area}', isVariable: true },
  { latex: 'LSA = \\text{Lateral Surface Area}', isVariable: true },
  { latex: 'V = \\dfrac{1}{2}abh', sectionLabel: 'Formulas', diagram: 'triangular-prism' },
  { latex: 'LSA = (a + c_1 + c_2) \\times h' },
  { latex: 'SA = ab + (a + c_1 + c_2) \\times h' },
];

const rectPrismFormulas: FormulaItem[] = [
  { latex: 'l = \\text{Length}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'b = \\text{Width}', isVariable: true },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'SA = \\text{Surface Area}', isVariable: true },
  { latex: 'LSA = \\text{Lateral Surface Area}', isVariable: true },
  { latex: 'V = l \\times b \\times h', sectionLabel: 'Formulas', diagram: 'cuboid' },
  { latex: 'SA = 2(lb + bh + lh)' },
  { latex: 'LSA = 2h(l + b)' },
];

const pyramidFormulas: FormulaItem[] = [
  { latex: 'B = \\text{Base area}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'P = \\text{Base perimeter}', isVariable: true },
  { latex: 'l = \\text{Slant height}', isVariable: true },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'LSA = \\text{Lateral Surface Area}', isVariable: true },
  { latex: 'SA = \\text{Surface Area}', isVariable: true },
  { latex: 'V = \\dfrac{1}{3} B \\times h', sectionLabel: 'Formulas', diagram: 'pyramid' },
  { latex: 'LSA = \\dfrac{1}{2} P \\times l' },
  { latex: 'SA = B + \\dfrac{1}{2} P \\times l' },
];

const squarePyramidFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Base side}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'l = \\text{Slant height}', isVariable: true },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'LSA = \\text{Lateral Surface Area}', isVariable: true },
  { latex: 'SA = \\text{Surface Area}', isVariable: true },
  { latex: 'V = \\dfrac{1}{3} a^2 h', sectionLabel: 'Formulas', diagram: 'square-pyramid' },
  { latex: 'l = \\sqrt{h^2 + \\dfrac{a^2}{4}}' },
  { latex: 'LSA = 2al' },
  { latex: 'SA = a^2 + 2al' },
];

const triangularPyramidFormulas: FormulaItem[] = [
  { latex: 'a = \\text{Base side}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'SA = \\text{Surface Area}', isVariable: true },
  { latex: 'V = \\dfrac{a^2 h\\sqrt{2}}{12} \\quad \\text{(regular)}', sectionLabel: 'Formulas', diagram: 'triangular-pyramid' },
  { latex: 'SA = \\sqrt{3}\\, a^2 \\quad \\text{(regular tetrahedron)}' },
];

const frustumConeFormulas: FormulaItem[] = [
  { latex: 'R = \\text{Base radius}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'r = \\text{Top radius}', isVariable: true },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'l = \\text{Slant height}', isVariable: true },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'CSA = \\text{Curved Surface Area}', isVariable: true },
  { latex: 'TSA = \\text{Total Surface Area}', isVariable: true },
  { latex: 'V = \\dfrac{\\pi h}{3}(R^2 + r^2 + Rr)', sectionLabel: 'Formulas', diagram: 'frustum' },
  { latex: 'l = \\sqrt{h^2 + (R - r)^2}' },
  { latex: 'CSA = \\pi(R + r)l' },
  { latex: 'TSA = \\pi\\left[R^2 + r^2 + (R + r)l\\right]' },
];

const frustumPyramidFormulas: FormulaItem[] = [
  { latex: 'A_1 = \\text{Base area}', isVariable: true, sectionLabel: 'Variables' },
  { latex: 'A_2 = \\text{Top area}', isVariable: true },
  { latex: 'h = \\text{Height}', isVariable: true },
  { latex: 'V = \\text{Volume}', isVariable: true },
  { latex: 'V = \\dfrac{h}{3}\\left(A_1 + A_2 + \\sqrt{A_1 A_2}\\right)', sectionLabel: 'Formulas', diagram: 'frustum-pyramid' },
];

// ─── SERIES ───

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

const basicTrigonometricFunctionsFormulas: FormulaItem[] = [
  { latex: '\\sin\\theta = \\dfrac{\\text{Opposite}}{\\text{Hypotenuse}}' },
  { latex: '\\cos\\theta = \\dfrac{\\text{Adjacent}}{\\text{Hypotenuse}}' },
  { latex: '\\tan\\theta = \\dfrac{\\text{Opposite}}{\\text{Adjacent}}' },
  { latex: '\\csc\\theta = \\dfrac{\\text{Hypotenuse}}{\\text{Opposite}}' },
  { latex: '\\sec\\theta = \\dfrac{\\text{Hypotenuse}}{\\text{Adjacent}}' },
  { latex: '\\cot\\theta = \\dfrac{\\text{Adjacent}}{\\text{Opposite}}' },
  { latex: '\\csc\\theta = \\dfrac{1}{\\sin\\theta}' },
  { latex: '\\sec\\theta = \\dfrac{1}{\\cos\\theta}' },
  { latex: '\\cot\\theta = \\dfrac{1}{\\tan\\theta}' },
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

// ─── SECTIONS ───

export const FORMULA_SECTIONS: FormulaSection[] = [
  {
    id: 'algebra',
    title: 'Algebra',
    symbol: 'x²',
    categories: [
      { id: 'powers', title: 'Powers Formulas', symbol: 'aⁿ', formulas: powersFormulas },
      { id: 'product', title: 'Product Formulas', symbol: '(a+b)²', formulas: productFormulas },
      { id: 'factoring', title: 'Factoring Formulas', symbol: 'a²−b²', formulas: factoringFormulas },
      { id: 'roots', title: 'Roots Formulas', symbol: '√', formulas: rootsFormulas },
    ],
  },
  {
    id: 'geometry',
    title: 'Geometry',
    symbol: '△',
    categories: [
      {
        id: '2d-basic',
        title: 'Basic Shapes',
        symbol: '□',
        formulas: [
          ...squareFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '◼ Square' : f.sectionLabel })),
          ...rectangleFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '▬ Rectangle' : f.sectionLabel })),
          ...triangleFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '△ Triangle' : f.sectionLabel })),
        ],
      },
      {
        id: '2d-triangles',
        title: 'Triangle Types',
        symbol: '△',
        formulas: [
          ...equilateralTriFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? 'Equilateral Triangle' : f.sectionLabel })),
          ...isoscelesTriFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? 'Isosceles Triangle' : f.sectionLabel })),
          ...scaleneTriFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? 'Scalene Triangle' : f.sectionLabel })),
          ...rightTriFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? 'Right-Angled Triangle' : f.sectionLabel })),
        ],
      },
      {
        id: '2d-circles',
        title: 'Circular Shapes',
        symbol: '◯',
        formulas: [
          ...circleFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '● Circle' : f.sectionLabel })),
          ...semicircleFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '◗ Semicircle' : f.sectionLabel })),
          ...sectorFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '⌔ Sector' : f.sectionLabel })),
          ...segmentFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '⌓ Segment' : f.sectionLabel })),
        ],
      },
      {
        id: '2d-quads',
        title: 'Quadrilaterals',
        symbol: '◇',
        formulas: [
          ...parallelogramFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '▱ Parallelogram' : f.sectionLabel })),
          ...rhombusFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '◆ Rhombus' : f.sectionLabel })),
          ...trapeziumFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '⏢ Trapezium' : f.sectionLabel })),
          ...kiteFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '⬧ Kite' : f.sectionLabel })),
        ],
      },
      {
        id: '2d-polygons',
        title: 'Polygons',
        symbol: '⬡',
        formulas: [
          ...polygonFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? 'General Polygon' : f.sectionLabel })),
          ...pentagonFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '⬠ Pentagon' : f.sectionLabel })),
          ...hexagonFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '⬡ Hexagon' : f.sectionLabel })),
          ...heptagonFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '⬡ Heptagon' : f.sectionLabel })),
          ...octagonFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '⯃ Octagon' : f.sectionLabel })),
        ],
      },
      {
        id: '3d-basic',
        title: 'Basic Solids',
        symbol: '⬜',
        formulas: [
          ...cubeFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '⬜ Cube' : f.sectionLabel })),
          ...cuboidFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '▭ Cuboid' : f.sectionLabel })),
        ],
      },
      {
        id: '3d-curved',
        title: 'Curved Solids',
        symbol: '⊙',
        formulas: [
          ...cylinderFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '⊙ Cylinder' : f.sectionLabel })),
          ...coneFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '▲ Cone' : f.sectionLabel })),
          ...sphereFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '● Sphere' : f.sectionLabel })),
          ...hemisphereFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? '◗ Hemisphere' : f.sectionLabel })),
        ],
      },
      {
        id: '3d-prism-pyramid',
        title: 'Prism & Pyramid',
        symbol: '⏢',
        formulas: [
          ...prismFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? 'Prism (General)' : f.sectionLabel })),
          ...triangularPrismFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? 'Triangular Prism' : f.sectionLabel })),
          ...rectPrismFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? 'Rectangular Prism' : f.sectionLabel })),
          ...pyramidFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? 'Pyramid (General)' : f.sectionLabel })),
          ...squarePyramidFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? 'Square Pyramid' : f.sectionLabel })),
          ...triangularPyramidFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? 'Triangular Pyramid' : f.sectionLabel })),
        ],
      },
      {
        id: '3d-advanced',
        title: 'Advanced Solids',
        symbol: '⏥',
        formulas: [
          ...frustumConeFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? 'Frustum of Cone' : f.sectionLabel })),
          ...frustumPyramidFormulas.map((f, i) => ({ ...f, sectionLabel: i === 0 ? 'Frustum of Pyramid' : f.sectionLabel })),
        ],
      },
    ],
  },
  {
    id: 'series',
    title: 'Series',
    symbol: 'Σ',
    categories: [
      { id: 'arithmetic', title: 'Arithmetic Series', symbol: 'Σ', formulas: arithmeticSeries },
      { id: 'geometric', title: 'Geometric Series', symbol: '∞', formulas: geometricSeries },
      { id: 'binomial', title: 'Binomial Series', symbol: '(1+x)', formulas: binomialSeries },
      { id: 'finite', title: 'Finite Series', symbol: 'n²', formulas: finiteSeries },
    ],
  },
  {
    id: 'trigonometry',
    title: 'Trigonometry',
    symbol: 'sin',
    categories: [
      { id: 'trig-basic-functions', title: 'Basic Trigonometric Functions', symbol: 'sin', formulas: basicTrigonometricFunctionsFormulas },
      // Special category — rendered by FormulasLearning as the TrigonometryLearning table
      { id: 'trig-angles', title: 'Table of Angles', symbol: 'θ', formulas: [] },
    ],
  },
];

// Flat list for backward compat
export const FORMULA_CATEGORIES: FormulaCategory[] = FORMULA_SECTIONS.flatMap(s => s.categories);
