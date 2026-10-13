import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PracticePage from '@/pages/PracticePage';

function openDigitTopic() {
  const rendered = render(<PracticePage />);
  const topicSelector = screen.getByText('Select Topics').parentElement;
  if (!topicSelector) throw new Error('Topic selector did not render.');

  fireEvent.click(within(topicSelector).getByRole('button', { name: /Tables/ }));
  const digitTopicButton = within(topicSelector).getAllByRole('button').find((button) =>
    button.textContent?.includes('+/-'),
  );
  if (!digitTopicButton) throw new Error('Addition/Subtraction topic button did not render.');
  fireEvent.click(digitTopicButton);

  const digitAccordion = screen.getAllByRole('button').find((button) =>
    button.hasAttribute('aria-expanded') && button.textContent?.includes('+/-'),
  );
  if (!digitAccordion) throw new Error('Digit range panel did not render.');
  fireEvent.click(digitAccordion);

  return rendered;
}

describe('Quiz Arena +/- digit-count multi-selection', () => {
  it('selects multiple digits independently and starts with the active selections', () => {
    openDigitTopic();

    const number1 = screen.getByRole('group', { name: 'Number 1 digit counts' });
    const number2 = screen.getByRole('group', { name: 'Number 2 digit counts' });

    expect(within(number1).getByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(number1).getByRole('button', { name: '2D' }));
    fireEvent.click(within(number1).getByRole('button', { name: '1D' }));
    fireEvent.click(within(number1).getByRole('button', { name: '3D' }));

    expect(within(number1).getByRole('button', { name: '1D' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(number1).getByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(number1).getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');

    // Changes to Number 1 do not mutate Number 2's independent selection.
    expect(within(number2).getByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(number2).getByRole('button', { name: '1D' }));
    fireEvent.click(within(number2).getByRole('button', { name: '3D' }));
    expect(within(number2).getByRole('button', { name: '1D' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(number2).getByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(number2).getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');

    expect(number1.querySelectorAll('button')).toHaveLength(10);
    expect(number2.querySelectorAll('button')).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Start Quiz' }));
    expect(screen.getByText(/^\d+ [+−] \d+ = \?$/)).toBeInTheDocument();
  });

  it('requires at least one selected digit for each operand', () => {
    openDigitTopic();
    const number1 = screen.getByRole('group', { name: 'Number 1 digit counts' });
    fireEvent.click(within(number1).getByRole('button', { name: '2D' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/select at least one digit count/i);
    expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeDisabled();

    fireEvent.click(within(number1).getByRole('button', { name: '4D' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeEnabled();
  });
});
