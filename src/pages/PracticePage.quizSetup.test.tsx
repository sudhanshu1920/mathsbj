import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PracticePage from '@/pages/PracticePage';
import { TRIG_FUNCTIONS } from '@/lib/trigData';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const functionButton = (fn: string) => screen.getByRole('button', { name: new RegExp('^' + fn + ' θ$') });

describe('Quiz Arena question timer progress', () => {
  it('uses the active countdown deadline, retains overall quiz progress, and resets on the next question', () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <PracticePage
        initialTopic="tables"
        initialMode="mcq"
        initialExtras={{ timerEnabled: true, timerSeconds: 10, count: 10 }}
      />,
    );

    try {
      const timerBar = screen.getByRole('progressbar', { name: 'Question timer' });
      expect(timerBar).toHaveAttribute('aria-valuenow', '100');
      expect(screen.getByTestId('quiz-overall-progress')).toBeInTheDocument();
      expect(timerBar.querySelector('.question-timer-progress__fill')).toHaveStyle({
        transformOrigin: 'right center',
        animationDuration: '10s',
      });

      act(() => { vi.advanceTimersByTime(2_000); });
      expect(screen.getByText('8s')).toBeInTheDocument();
      expect(Number(timerBar.getAttribute('aria-valuenow'))).toBeCloseTo(80, 0);

      const firstOption = document.querySelector<HTMLButtonElement>('.mcq-options-grid button');
      expect(firstOption).not.toBeNull();
      if (!firstOption) throw new Error('The first MCQ option did not render.');
      fireEvent.click(firstOption);

      act(() => { vi.advanceTimersByTime(800); });
      expect(screen.getByText('2/10')).toBeInTheDocument();
      expect(screen.getByTestId('quiz-overall-progress')).toBeInTheDocument();
      expect(Number(screen.getByRole('progressbar', { name: 'Question timer' }).getAttribute('aria-valuenow')))
        .toBeGreaterThan(90);
    } finally {
      unmount();
    }
  });

  it('does not render a countdown bar when the timer mode is off', () => {
    render(
      <PracticePage
        initialTopic="tables"
        initialMode="mcq"
        initialExtras={{ timerEnabled: false, count: 10 }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start Quiz' }));

    expect(screen.queryByRole('progressbar', { name: 'Question timer' })).not.toBeInTheDocument();
    expect(screen.getByTestId('quiz-overall-progress')).toBeInTheDocument();
  });
});

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
