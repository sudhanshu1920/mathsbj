import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PracticePage from '@/pages/PracticePage';
import { TRIG_FUNCTIONS } from '@/lib/trigData';

afterEach(() => cleanup());

describe('Quiz Arena trigonometric function selection', () => {
  it('lets the user select individual functions and requires at least one', () => {
    render(<PracticePage />);

    fireEvent.click(screen.getByRole('button', { name: /Trigonometry/ }));
    expect(screen.getByText('Select Trigonometric Functions')).toBeInTheDocument();

    for (const fn of TRIG_FUNCTIONS) {
      expect(screen.getByRole('button', { name: new RegExp(`${fn} θ`) })).toHaveAttribute('aria-pressed', 'true');
    }

    for (const fn of TRIG_FUNCTIONS) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`${fn} θ`) }));
    }

    expect(screen.getByText('Select at least one trigonometric function.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'sin θ', exact: true }));
    expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /sin θ/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'cos θ', exact: true })).toHaveAttribute('aria-pressed', 'false');
  });

  it('provides a Select All control for multi-function quiz setup', () => {
    render(<PracticePage />);
    fireEvent.click(screen.getByRole('button', { name: /Trigonometry/ }));

    fireEvent.click(screen.getByRole('button', { name: /cos θ/ }));
    expect(screen.getByRole('button', { name: /cos θ/ })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    for (const fn of TRIG_FUNCTIONS) {
      expect(screen.getByRole('button', { name: new RegExp(`${fn} θ`) })).toHaveAttribute('aria-pressed', 'true');
    }
  });
});
