import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PracticePage from '@/pages/PracticePage';

function openCustomPercentageRange() {
  const rendered = render(<PracticePage />);

  // Percentage-only fixture avoids the default Tables topic consuming the
  // finite question-count selection before Percentage questions are reached.
  fireEvent.click(screen.getByRole('button', { name: /Tables/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Percentage$/ }));

  const percentageAccordion = screen.getAllByRole('button').find((button) =>
    button.hasAttribute('aria-expanded') && button.textContent?.includes('Percentage'),
  );
  if (!percentageAccordion) throw new Error('Percentage range panel did not render.');
  fireEvent.click(percentageAccordion);
  fireEvent.click(screen.getByRole('button', { name: /^Custom$/ }));

  return rendered;
}

describe('Quiz Arena Percentage Custom range startup', () => {
  it('persists the displayed defaults, accepts a valid edit, and launches the quiz', () => {
    const { container } = openCustomPercentageRange();

    expect(screen.getByLabelText('Percentage custom start numerator')).toHaveValue(1);
    expect(screen.getByLabelText('Percentage custom start denominator')).toHaveValue(2);
    expect(screen.getByLabelText('Percentage custom end numerator')).toHaveValue(5);
    expect(screen.getByLabelText('Percentage custom end denominator')).toHaveValue(2);

    // Users should not have to touch every field just to make its displayed
    // default become part of the canonical Percentage config.
    fireEvent.change(screen.getByLabelText('Percentage custom end numerator'), {
      target: { value: '7' },
    });
    expect(screen.getByRole('button', { name: /Start Quiz/ })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /Start Quiz/ }));
    expect(container.querySelector('.mcq-options-grid')).toBeInTheDocument();
    expect(screen.getByText('1/10')).toBeInTheDocument();
  });

  it('treats a genuinely empty input as invalid instead of coercing it to zero', () => {
    openCustomPercentageRange();

    fireEvent.change(screen.getByLabelText('Percentage custom start numerator'), {
      target: { value: '' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/whole-number fractions/i);
    expect(screen.getByRole('button', { name: /Start Quiz/ })).toBeDisabled();
  });

  it('preserves a valid custom range across Preset → Custom switching', () => {
    openCustomPercentageRange();

    fireEvent.change(screen.getByLabelText('Percentage custom end numerator'), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Preset$/ }));
    fireEvent.click(screen.getByRole('button', { name: /1\/1/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Custom$/ }));

    expect(screen.getByLabelText('Percentage custom end numerator')).toHaveValue(8);
    expect(screen.getByLabelText('Percentage custom start denominator')).toHaveValue(2);
    expect(screen.getByRole('button', { name: /Start Quiz/ })).toBeEnabled();
  });
});
