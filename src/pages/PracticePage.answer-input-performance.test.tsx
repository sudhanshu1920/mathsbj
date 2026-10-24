import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnswerInputPanel } from '@/pages/PracticePage';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllTimers();
});

const numericQuestion = {
  text: '6 × 2 = ?',
  answer: 12,
  answerType: 'fraction' as const,
};

function pressDigit(digit: string) {
  fireEvent.click(screen.getByRole('button', { name: digit }));
}

describe('AnswerInputPanel responsiveness', () => {
  it('updates the local draft immediately while typing and deleting rapidly', () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn(() => true);
    const { container } = render(
      <AnswerInputPanel question={numericQuestion} feedback={null} onAnswer={onAnswer} />,
    );

    pressDigit('1');
    pressDigit('2');
    expect(container.querySelector('.truncate')?.textContent).toBe('12');

    const keypadButtons = screen.getAllByRole('button');
    fireEvent.click(keypadButtons[14]); // Backspace on the existing math keypad.
    expect(container.querySelector('.truncate')?.textContent).toBe('1');
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('cancels a stale auto-submit candidate when another digit is entered', () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn(() => true);
    render(
      <AnswerInputPanel question={numericQuestion} feedback={null} onAnswer={onAnswer} />,
    );

    pressDigit('1');
    act(() => {
      vi.advanceTimersByTime(100);
    });

    pressDigit('2');
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(onAnswer).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(12);
  });
});
