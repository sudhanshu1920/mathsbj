import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PracticePage, { generateQuestions } from '@/pages/PracticePage';
import { TRIG_ANGLES, type TrigFunction } from '@/lib/trigData';

describe('Learning Table of Angles practice generator range', () => {
  const makeQuestions = (trigProMode: boolean, trigFunctions: TrigFunction[]) =>
    generateQuestions({
      topics: [{
        id: 'trig',
        label: 'Trigonometry',
        range: { from: 0, to: 360, trigFunctions, trigProMode },
      }],
      count: trigFunctions.length * (trigProMode ? TRIG_ANGLES.length : 5),
      infinite: false,
      mode: 'input',
      timerEnabled: false,
      timerSeconds: 9999,
      sequential: false,
      repetitionEnabled: false,
      repetitionByTopic: {},
    });

  it('enforces Standard 0°–90° and Pro 0°–360° inside generated question pools', () => {
    const standard = makeQuestions(false, ['sin']);
    expect(standard).toHaveLength(5);
    expect(standard.every((question) => question.trigFunctionId === 'sin')).toBe(true);
    expect(standard.every((question) => question.trigAngle !== undefined && question.trigAngle <= 90)).toBe(true);

    const pro = makeQuestions(true, ['sin']);
    expect(pro).toHaveLength(TRIG_ANGLES.length);
    expect(pro.every((question) => question.trigFunctionId === 'sin')).toBe(true);
    expect(pro.some((question) => question.trigAngle !== undefined && question.trigAngle > 90)).toBe(true);
    expect(pro.map((question) => question.trigAngle).sort((a, b) => Number(a) - Number(b)))
      .toEqual([...TRIG_ANGLES]);
  });

  it('keeps an individual function isolated and supports multiple selected functions', () => {
    const single = makeQuestions(true, ['cos']);
    expect(single.every((question) => question.trigFunctionId === 'cos')).toBe(true);
    const combined = makeQuestions(false, ['sin', 'cos']);
    expect(combined).toHaveLength(10);
    expect(new Set(combined.map((question) => question.trigFunctionId))).toEqual(new Set(['sin', 'cos']));
    expect(combined.every((question) => question.trigAngle !== undefined && question.trigAngle <= 90)).toBe(true);
  });
});

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

    // All six functions are selected by default. Keep sin/cos selected and
    // deselect the other four while Pro Mode is active.
    const sinButton = screen.getByRole('button', { name: 'sin θ' });
    const cosButton = screen.getByRole('button', { name: 'cos θ' });
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    for (const fn of ['tan', 'cot', 'sec', 'cosec']) {
      fireEvent.click(screen.getByRole('button', { name: `${fn} θ` }));
    }

    expect(sinButton).toHaveAttribute('aria-pressed', 'true');
    expect(cosButton).toHaveAttribute('aria-pressed', 'true');
    for (const fn of ['tan', 'cot', 'sec', 'cosec']) {
      expect(screen.getByRole('button', { name: `${fn} θ` })).toHaveAttribute('aria-pressed', 'false');
    }
    expect(within(rangeGroup).getByRole('button', { name: /Pro Mode.*0°–360°/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
