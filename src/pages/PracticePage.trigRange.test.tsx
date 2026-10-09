import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PracticePage from '@/pages/PracticePage';

describe('Quiz Arena trigonometry angle-range control', () => {
  it('defaults to Standard Mode and switches the setup selection to Pro Mode', () => {
    render(<PracticePage />);

    fireEvent.click(screen.getByRole('button', { name: /Trigonometry/ }));

    expect(screen.getByText('Trigonometry Quiz – Angle Range')).toBeInTheDocument();
    const rangeGroup = screen.getByRole('group', { name: 'Trigonometry quiz angle range' });
    const standardButton = within(rangeGroup).getByRole('button', { name: /Standard Mode.*0°–90°/ });
    const proButton = within(rangeGroup).getByRole('button', { name: /Pro Mode.*0°–360°/ });

    expect(standardButton).toHaveAttribute('aria-pressed', 'true');
    expect(proButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(proButton);

    expect(standardButton).toHaveAttribute('aria-pressed', 'false');
    expect(proButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(standardButton);

    expect(standardButton).toHaveAttribute('aria-pressed', 'true');
    expect(proButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps function selection independent from the selected angle range', () => {
    render(<PracticePage />);
    fireEvent.click(screen.getByRole('button', { name: /Trigonometry/ }));

    const rangeGroup = screen.getByRole('group', { name: 'Trigonometry quiz angle range' });
    fireEvent.click(within(rangeGroup).getByRole('button', { name: /Pro Mode.*0°–360°/ }));

    const sinButton = screen.getByRole('button', { name: 'sin θ' });
    const cosButton = screen.getByRole('button', { name: 'cos θ' });
    fireEvent.click(sinButton);
    fireEvent.click(cosButton);

    expect(sinButton).toHaveAttribute('aria-pressed', 'true');
    expect(cosButton).toHaveAttribute('aria-pressed', 'true');
    expect(within(rangeGroup).getByRole('button', { name: /Pro Mode.*0°–360°/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
