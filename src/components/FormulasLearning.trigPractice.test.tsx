import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FormulasLearning from '@/components/FormulasLearning';
import { FORMULA_SECTIONS } from '@/lib/formulaData';
import { TRIG_FUNCTIONS } from '@/lib/trigData';

const trigSectionIndex = FORMULA_SECTIONS.findIndex((section) =>
  section.categories.some((category) => category.id === 'trig-angles')
);
const trigCategoryIndex = FORMULA_SECTIONS[trigSectionIndex]?.categories.findIndex(
  (category) => category.id === 'trig-angles'
) ?? -1;

function renderTrigTable(onPracticeTrigFunctions = vi.fn()) {
  render(
    <FormulasLearning
      sectionIndex={trigSectionIndex}
      categoryIndex={trigCategoryIndex}
      onNavigate={vi.fn()}
      onPracticeTrigFunctions={onPracticeTrigFunctions}
    />
  );
  return onPracticeTrigFunctions;
}

const functionOption = (fn: string) => screen.getByRole('button', { name: new RegExp('^' + fn + ' θ$') });

describe('Table of Angles top-bar Practice menu', () => {
  it('opens beside the appearance controls and starts the selected function only', async () => {
    const onPractice = renderTrigTable();

    fireEvent.click(await screen.findByRole('button', { name: 'Practice' }));
    expect(screen.getByRole('dialog', { name: 'Choose trigonometric functions to practice' })).toBeInTheDocument();

    fireEvent.click(functionOption('sin'));
    expect(functionOption('sin')).toHaveAttribute('aria-pressed', 'true');
    expect(functionOption('cos')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Start Practice' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
    expect(onPractice).toHaveBeenCalledWith(['sin']);
  });

  it('supports multi-select and the Practice All Functions shortcut', async () => {
    const onPractice = renderTrigTable();

    fireEvent.click(await screen.findByRole('button', { name: 'Practice' }));
    fireEvent.click(functionOption('tan'));
    fireEvent.click(functionOption('cot'));
    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
    expect(onPractice).toHaveBeenCalledWith(['tan', 'cot']);

    fireEvent.click(await screen.findByRole('button', { name: 'Practice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Practice All Functions' }));
    expect(onPractice).toHaveBeenLastCalledWith([...TRIG_FUNCTIONS]);
  });

  it('disables Start Practice until a function is selected', async () => {
    renderTrigTable();

    fireEvent.click(await screen.findByRole('button', { name: 'Practice' }));
    expect(screen.getByRole('button', { name: 'Start Practice' })).toBeDisabled();
    expect(screen.getByText('Select at least one function.')).toBeInTheDocument();
  });
});
