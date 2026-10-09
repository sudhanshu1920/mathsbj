import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TrigonometryLearning from '@/components/TrigonometryLearning';
import { TRIG_FUNCTIONS } from '@/lib/trigData';

describe('Table of Angles practice controls', () => {
  it('keeps the reference table and exposes six individual practice actions', () => {
    const onPracticeFunctions = vi.fn();
    render(<TrigonometryLearning onPracticeFunctions={onPracticeFunctions} />);

    expect(screen.getByRole('table', { name: /exact values of sine, cosine/i })).toBeInTheDocument();
    for (const fn of TRIG_FUNCTIONS) {
      expect(screen.getByRole('button', { name: `Practice ${fn} θ` })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Practice cos θ' }));
    expect(onPracticeFunctions).toHaveBeenCalledWith(['cos']);
  });

  it('starts combined practice with every supported function', () => {
    const onPracticeFunctions = vi.fn();
    render(<TrigonometryLearning onPracticeFunctions={onPracticeFunctions} />);

    fireEvent.click(screen.getByRole('button', { name: 'Practice All Functions' }));
    expect(onPracticeFunctions).toHaveBeenCalledWith([...TRIG_FUNCTIONS]);
  });

  it('keeps the table usable without requiring practice-navigation props', () => {
    render(<TrigonometryLearning />);

    expect(screen.getByRole('table', { name: /exact values of sine, cosine/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Practice All Functions' })).not.toBeInTheDocument();
  });
});
