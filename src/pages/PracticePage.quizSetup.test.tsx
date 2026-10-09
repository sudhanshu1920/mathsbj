import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PracticePage from '@/pages/PracticePage';
import { TRIG_FUNCTIONS } from '@/lib/trigData';

afterEach(() => cleanup());

const functionButton = (fn: string) => screen.getByRole('button', { name: new RegExp('^' + fn + ' θ$') });

describe('Quiz Arena trigonometric function selection', () => {
  it('lets the user select individual functions and requires at least one', () => {
    render(<PracticePage />);

    fireEvent.click(screen.getByRole('button', { name: /Trigonometry/ }));
    expect(screen.getByText('Select Trigonometric Functions')).toBeInTheDocument();

    for (const fn of TRIG_FUNCTIONS) {
      expect(functionButton(fn)).toHaveAttribute('aria-pressed', 'true');
    }

    for (const fn of TRIG_FUNCTIONS) {
      fireEvent.click(functionButton(fn));
    }

    expect(screen.getByText('Select at least one trigonometric function.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeDisabled();

    fireEvent.click(functionButton('sin'));
    expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeEnabled();
    expect(functionButton('sin')).toHaveAttribute('aria-pressed', 'true');
    expect(functionButton('cos')).toHaveAttribute('aria-pressed', 'false');
  });

  it('provides a Select All control for multi-function quiz setup', () => {
    render(<PracticePage />);
    fireEvent.click(screen.getByRole('button', { name: /Trigonometry/ }));

    fireEvent.click(functionButton('cos'));
    expect(functionButton('cos')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    for (const fn of TRIG_FUNCTIONS) {
      expect(functionButton(fn)).toHaveAttribute('aria-pressed', 'true');
    }
  });
});
