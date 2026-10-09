import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TrigonometryLearning from '@/components/TrigonometryLearning';
import {
  NOT_DEFINED,
  TRIG_ANGLES,
  TRIG_FUNCTIONS,
  trigValue,
} from '@/lib/trigData';

describe('transposed Table of Angles', () => {
  it('uses the 0°–90° range by default, with angles horizontally and functions vertically', () => {
    render(<TrigonometryLearning />);

    expect(screen.getByRole('table', { name: /trigonometric ratios for standard angles/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Function' })).toBeInTheDocument();

    for (const angle of TRIG_ANGLES.filter((angle) => angle <= 90)) {
      expect(screen.getByRole('columnheader', { name: `${angle} degrees` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('columnheader', { name: '120 degrees' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '360 degrees' })).not.toBeInTheDocument();

    for (const fn of TRIG_FUNCTIONS) {
      expect(screen.getByRole('rowheader', { name: `${fn} θ` })).toBeInTheDocument();
    }

    expect(screen.getAllByRole('row')).toHaveLength(TRIG_FUNCTIONS.length + 2);
    expect(screen.getAllByRole('cell')).toHaveLength(TRIG_FUNCTIONS.length * 5);
  });

  it('renders all supported angles and a stable cell mapping in Pro Mode', () => {
    render(<TrigonometryLearning showFullRange />);

    for (const angle of TRIG_ANGLES) {
      expect(screen.getByRole('columnheader', { name: `${angle} degrees` })).toBeInTheDocument();
    }

    expect(screen.getAllByRole('row')).toHaveLength(TRIG_FUNCTIONS.length + 2);
    expect(screen.getAllByRole('cell')).toHaveLength(TRIG_FUNCTIONS.length * TRIG_ANGLES.length);
    expect(screen.getByRole('cell', { name: 'sin at 120 degrees: √3/2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'cos at 120 degrees: -1/2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'tan at 120 degrees: -√3' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'sin at 180 degrees: 0' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'cos at 180 degrees: -1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'tan at 270 degrees: Undefined' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'sin at 270 degrees: -1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'cos at 270 degrees: 0' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'cos at 360 degrees: 1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'cosec at 360 degrees: Undefined' })).toBeInTheDocument();
  });

  it('keeps first-quadrant values and undefined points attached to the correct cells', () => {
    render(<TrigonometryLearning />);

    expect(screen.getByRole('cell', { name: 'sin at 30 degrees: 1/2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'cos at 30 degrees: √3/2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'tan at 90 degrees: Undefined' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'cot at 0 degrees: Undefined' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'sec at 90 degrees: Undefined' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'cosec at 30 degrees: 2' })).toBeInTheDocument();
  });

  it('retains correct signs across quadrants and undefined denominator points in the shared dataset', () => {
    expect(trigValue('sin', 120)).toBe('√3/2');
    expect(trigValue('cos', 120)).toBe('-1/2');
    expect(trigValue('tan', 120)).toBe('-√3');
    expect(trigValue('sin', 210)).toBe('-1/2');
    expect(trigValue('tan', 210)).toBe('1/√3');
    expect(trigValue('cos', 240)).toBe('-1/2');
    expect(trigValue('sec', 240)).toBe('-2');
    expect(trigValue('sin', 270)).toBe('-1');
    expect(trigValue('tan', 270)).toBe(NOT_DEFINED);
    expect(trigValue('cot', 180)).toBe(NOT_DEFINED);
    expect(trigValue('cosec', 360)).toBe(NOT_DEFINED);
  });
});
