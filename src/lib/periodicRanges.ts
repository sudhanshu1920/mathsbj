import type { ChemElement } from '@/lib/periodicTable';
import { ELEMENTS } from '@/lib/periodicTable';

export const PERIODIC_RANGES = [
  { from: 1, to: 10, label: '1–10' },
  { from: 11, to: 20, label: '11–20' },
  { from: 21, to: 30, label: '21–30' },
  { from: 31, to: 40, label: '31–40' },
  { from: 41, to: 50, label: '41–50' },
  { from: 51, to: 60, label: '51–60' },
  { from: 61, to: 70, label: '61–70' },
  { from: 71, to: 80, label: '71–80' },
  { from: 81, to: 90, label: '81–90' },
  { from: 91, to: 100, label: '91–100' },
  { from: 101, to: 110, label: '101–110' },
  { from: 110, to: 118, label: '110–118' },
] as const;

export function movePeriodicRangeIndex(current: number | null, delta: number): number | null {
  if (current === null) return delta > 0 ? 1 : null;
  return Math.max(0, Math.min(PERIODIC_RANGES.length - 1, current + delta));
}

export function getPeriodicRangeElements(index: number): ChemElement[] {
  const range = PERIODIC_RANGES[index];
  if (!range) return [];
  return ELEMENTS.slice(range.from - 1, range.to);
}
