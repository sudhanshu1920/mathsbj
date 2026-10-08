// Shared math helpers for root questions and answer precision.

export const ROOT_DECIMAL_PLACES = 2;

export interface RootAnswer {
  exact: number;
  answer: number;
  display: string;
  approximate: boolean;
  precision: number;
}

export function roundRoot(value: number, decimals = ROOT_DECIMAL_PLACES): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatRootAnswer(value: number, decimals = ROOT_DECIMAL_PLACES): string {
  const rounded = roundRoot(value, decimals);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
}

export function buildRootAnswer(exact: number): RootAnswer {
  const approximate = !Number.isInteger(exact);
  const precision = approximate ? ROOT_DECIMAL_PLACES : 0;
  return {
    exact,
    answer: roundRoot(exact),
    display: formatRootAnswer(exact),
    approximate,
    precision,
  };
}

export function getSquareRootAnswer(value: number): RootAnswer {
  return buildRootAnswer(Math.sqrt(value));
}

export function getCubeRootAnswer(value: number): RootAnswer {
  return buildRootAnswer(Math.cbrt(value));
}

export function isRootAnswerCorrect(
  input: number,
  expected: number,
  decimals = ROOT_DECIMAL_PLACES,
): boolean {
  if (!Number.isFinite(input) || !Number.isFinite(expected)) return false;

  if (decimals === 0) {
    return Math.abs(input - expected) < 1e-9;
  }

  return roundRoot(input, decimals) === roundRoot(expected, decimals);
}
