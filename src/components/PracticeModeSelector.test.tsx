import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PracticeModeSelector from '@/components/PracticeModeSelector';

describe('Learning Practice question order selector', () => {
  it('defaults to Mix and passes the selected Sequence order to the session launcher', () => {
    const onSelect = vi.fn();
    const onQuestionOrderChange = vi.fn();

    render(
      <PracticeModeSelector
        onSelect={onSelect}
        onQuestionOrderChange={onQuestionOrderChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Mix' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Sequence' }));
    expect(onQuestionOrderChange).toHaveBeenCalledWith('sequence');
    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));

    expect(onSelect).toHaveBeenCalledWith({
      mode: 'mcq',
      timerEnabled: false,
      timerSeconds: 10,
      infinite: false,
      questionOrder: 'sequence',
    });
  });

  it('restores a previously selected order when the Learning selector is reopened', () => {
    const onSelect = vi.fn();
    render(
      <PracticeModeSelector
        onSelect={onSelect}
        initialSettings={{ questionOrder: 'sequence' }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Sequence' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Mix' })).toHaveAttribute('aria-pressed', 'false');
  });
});
