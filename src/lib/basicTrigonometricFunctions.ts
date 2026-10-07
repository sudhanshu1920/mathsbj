// Production APK build requested after adding the Basic Trigonometric Functions lesson.

export interface BasicTrigFunction {
  name: string;
  title: string;
  symbol: string;
  memory: string;
  latex: string;
}

export const BASIC_TRIG_FUNCTIONS: BasicTrigFunction[] = [
  { name: 'sin', title: 'Sine (sin)', symbol: 'sin θ', memory: 'SOH', latex: '\\sin\\theta = \\dfrac{\\text{Opposite}}{\\text{Hypotenuse}}' },
  { name: 'cos', title: 'Cosine (cos)', symbol: 'cos θ', memory: 'CAH', latex: '\\cos\\theta = \\dfrac{\\text{Adjacent}}{\\text{Hypotenuse}}' },
  { name: 'tan', title: 'Tangent (tan)', symbol: 'tan θ', memory: 'TOA', latex: '\\tan\\theta = \\dfrac{\\text{Opposite}}{\\text{Adjacent}}' },
  { name: 'csc', title: 'Cosecant (csc)', symbol: 'csc θ', memory: '1 / sin θ', latex: '\\csc\\theta = \\dfrac{\\text{Hypotenuse}}{\\text{Opposite}}' },
  { name: 'sec', title: 'Secant (sec)', symbol: 'sec θ', memory: '1 / cos θ', latex: '\\sec\\theta = \\dfrac{\\text{Hypotenuse}}{\\text{Adjacent}}' },
  { name: 'cot', title: 'Cotangent (cot)', symbol: 'cot θ', memory: '1 / tan θ', latex: '\\cot\\theta = \\dfrac{\\text{Adjacent}}{\\text{Opposite}}' },
];

export const SOH_CAH_TOA = [
  { key: 'SOH', formula: 'Sine = Opposite / Hypotenuse', meaning: 'Sine = Opposite / Hypotenuse' },
  { key: 'CAH', formula: 'Cosine = Adjacent / Hypotenuse', meaning: 'Cosine = Adjacent / Hypotenuse' },
  { key: 'TOA', formula: 'Tangent = Opposite / Adjacent', meaning: 'Tangent = Opposite / Adjacent' },
] as const;

export const RECIPROCAL_TRIG_FUNCTIONS = [
  { symbol: 'csc', description: 'csc = reciprocal of sin', latex: '\\csc\\theta = \\dfrac{1}{\\sin\\theta}' },
  { symbol: 'sec', description: 'sec = reciprocal of cos', latex: '\\sec\\theta = \\dfrac{1}{\\cos\\theta}' },
  { symbol: 'cot', description: 'cot = reciprocal of tan', latex: '\\cot\\theta = \\dfrac{1}{\\tan\\theta}' },
] as const;

export const BASIC_TRIG_SUMMARY = [
  { function: 'sin θ', formula: 'Opposite / Hypotenuse', memory: 'SOH' },
  { function: 'cos θ', formula: 'Adjacent / Hypotenuse', memory: 'CAH' },
  { function: 'tan θ', formula: 'Opposite / Adjacent', memory: 'TOA' },
  { function: 'csc θ', formula: 'Hypotenuse / Opposite', memory: 'Reciprocal of sin' },
  { function: 'sec θ', formula: 'Hypotenuse / Adjacent', memory: 'Reciprocal of cos' },
  { function: 'cot θ', formula: 'Adjacent / Opposite', memory: 'Reciprocal of tan' },
] as const;

export const BASIC_TRIG_EXAMPLE = [
  { label: 'sin θ', latex: '\\sin\\theta = \\dfrac{3}{5}' },
  { label: 'cos θ', latex: '\\cos\\theta = \\dfrac{4}{5}' },
  { label: 'tan θ', latex: '\\tan\\theta = \\dfrac{3}{4}' },
  { label: 'csc θ', latex: '\\csc\\theta = \\dfrac{5}{3}' },
  { label: 'sec θ', latex: '\\sec\\theta = \\dfrac{5}{4}' },
  { label: 'cot θ', latex: '\\cot\\theta = \\dfrac{4}{3}' },
] as const;
