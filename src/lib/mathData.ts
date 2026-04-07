// All math data generated locally - fully offline

export const getTable = (num: number, max = 10): { expression: string; answer: number }[] => {
  return Array.from({ length: max }, (_, i) => ({
    expression: `${num} × ${i + 1}`,
    answer: num * (i + 1),
  }));
};

export const getSquares = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => {
    const n = from + i;
    return { expression: `${n}²`, answer: n * n };
  });

export const getSquareRoots = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => {
    const n = from + i;
    const root = Math.sqrt(n);
    const isPerfect = Number.isInteger(root);
    return {
      expression: `√${n}`,
      answer: isPerfect ? root : parseFloat(root.toFixed(1)),
      approximate: !isPerfect,
    };
  });

export const getCubes = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => {
    const n = from + i;
    return { expression: `${n}³`, answer: n * n * n };
  });

export const getCubeRoots = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => {
    const n = from + i;
    const root = Math.cbrt(n);
    const isPerfect = Math.abs(root - Math.round(root)) < 1e-9;
    return {
      expression: `∛${n}`,
      answer: isPerfect ? Math.round(root) : parseFloat(root.toFixed(1)),
      approximate: !isPerfect,
    };
  });

export const getPowers = (base: number, maxExp = 10) =>
  Array.from({ length: maxExp }, (_, i) => ({
    expression: `${base}`,
    exponent: i + 1,
    answer: Math.pow(base, i + 1),
  }));

export interface PercentageRow {
  fraction: string;
  decimal: string;
  mixed: string;
}

export const getPercentages = (): PercentageRow[] => {
  const rows: PercentageRow[] = [];
  for (let d = 2; d <= 50; d++) {
    const val = (1 / d) * 100;
    const decimal = val % 1 === 0 ? `${val}%` : `${val.toFixed(2)}%`;

    // Mixed fraction percentage
    const whole = Math.floor(val);
    const numerator = 100 - whole * d;
    let mixed: string;
    if (numerator === 0) {
      mixed = `${whole}%`;
    } else {
      // simplify fraction
      const g = gcd(numerator, d);
      mixed = `${whole > 0 ? whole + ' ' : ''}${numerator / g}/${d / g}%`;
    }

    rows.push({
      fraction: `1/${d}`,
      decimal,
      mixed,
    });
  }
  return rows;
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export const RANGE_GROUPS = Array.from({ length: 20 }, (_, i) => ({
  label: `${i * 10 + 1}–${(i + 1) * 10}`,
  from: i * 10 + 1,
  to: (i + 1) * 10,
}));

// For squares/cubes we extend to 200
export const getExtendedRangeGroups = () => {
  const groups = [];
  for (let i = 0; i < 20; i++) {
    groups.push({
      label: `${i * 10 + 1}–${(i + 1) * 10}`,
      from: i * 10 + 1,
      to: (i + 1) * 10,
    });
  }
  return groups;
};
