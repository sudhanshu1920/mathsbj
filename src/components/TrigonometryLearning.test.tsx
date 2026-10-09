import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TrigonometryLearning from '@/components/TrigonometryLearning';
import { TRIG_ANGLES, TRIG_FUNCTIONS } from '@/lib/trigData';

describe('transposed Table of Angles', () => {
  it('places each supported angle horizontally and each function vertically', () => {
    render(<TrigonometryLearning />);

    expect(screen.getByRole('table', { name: /trigonometric ratios for standard angles/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Function' })).toBeInTheDocument();

    for (const angle of TRIG_ANGLES) {
      expect(screen.getByRole('columnheader', { name: `${angle} degrees` })).toBeInTheDocument();
    }

    for (const fn of TRIG_FUNCTIONS) {
      expect(screen.getByRole('rowheader', { name: `${fn} θ` })).toBeInTheDocument();
    }

    // Two header rows followed by one row for each of the six functions.
    expect(screen.getAllByRole('row')).toHaveLength(TRIG_FUNCTIONS.length + 2);
  });

  it('keeps values attached to the correct function/angle cell', () => {
    render(<TrigonometryLearning />);

    expect(screen.getByRole('cell', { name: 'sin at 30 degrees: 1/2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'cos at 30 degrees: √3/2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'tan at 90 degrees: Undefined' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'cot at 0 degrees: Undefined' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'sec at 90 degrees: Undefined' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'cosec at 30 degrees: 2' })).toBeInTheDocument();
  });
});
