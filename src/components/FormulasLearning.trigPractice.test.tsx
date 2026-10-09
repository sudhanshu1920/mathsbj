import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

describe('Table of Angles top-bar controls', () => {
  it('places Pro Mode immediately before appearance and switches between standard/full angle ranges', async () => {
    renderTrigTable();

    const proButton = screen.getByRole('button', { name: 'Pro Mode' });
    const appearanceButton = screen.getByRole('button', { name: /Switch to (light|dark) mode/ });
    expect(proButton).toHaveAttribute('aria-pressed', 'false');
    expect(proButton.compareDocumentPosition(appearanceButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await screen.findByRole('columnheader', { name: '90 degrees' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '120 degrees' })).not.toBeInTheDocument();

    const appearanceLabelBefore = appearanceButton.getAttribute('aria-label');
    fireEvent.click(proButton);

    expect(proButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('columnheader', { name: '120 degrees' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '360 degrees' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'cos at 120 degrees: -1/2' })).toBeInTheDocument();
    expect(appearanceButton).toHaveAttribute('aria-label', appearanceLabelBefore);

    fireEvent.click(proButton);
    expect(proButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('columnheader', { name: '120 degrees' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '360 degrees' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '90 degrees' })).toBeInTheDocument();
  });

  it('opens the Practice panel in the overlay portal, above and outside the table scroll region', async () => {
    renderTrigTable();

    fireEvent.click(await screen.findByRole('button', { name: 'Practice' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose trigonometric functions to practice' });
    const tableScrollRegion = await screen.findByRole('region', { name: 'Table of standard trigonometric ratios' });

    expect(document.body.contains(dialog)).toBe(true);
    expect(tableScrollRegion.contains(dialog)).toBe(false);
    expect(dialog.closest('[data-radix-popper-content-wrapper]')).not.toBeNull();
    expect(dialog).toHaveAttribute('data-swipe-ignore-app-section', 'true');
  });

  it('starts only the selected function and closes the panel', async () => {
    const onPractice = renderTrigTable();

    fireEvent.click(await screen.findByRole('button', { name: 'Practice' }));
    fireEvent.click(functionOption('sin'));
    expect(functionOption('sin')).toHaveAttribute('aria-pressed', 'true');
    expect(functionOption('cos')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Start Practice' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
    expect(onPractice).toHaveBeenCalledWith(['sin'], false);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Choose trigonometric functions to practice' })).not.toBeInTheDocument());
  });

  it('supports selecting multiple functions and Practice All Functions', async () => {
    const onPractice = renderTrigTable();

    fireEvent.click(await screen.findByRole('button', { name: 'Practice' }));
    fireEvent.click(functionOption('tan'));
    fireEvent.click(functionOption('cot'));
    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
    expect(onPractice).toHaveBeenCalledWith(['tan', 'cot'], false);

    fireEvent.click(await screen.findByRole('button', { name: 'Practice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Practice All Functions' }));
    expect(onPractice).toHaveBeenLastCalledWith([...TRIG_FUNCTIONS], false);
    expect(screen.queryByRole('dialog', { name: 'Choose trigonometric functions to practice' })).not.toBeInTheDocument();
  });

  it('synchronizes the popup angle range with the table and passes it into the practice callback', async () => {
    const onPractice = renderTrigTable();
    const practiceButton = await screen.findByRole('button', { name: 'Practice' });

    fireEvent.click(practiceButton);
    const rangeGroup = screen.getByRole('group', { name: 'Practice angle range' });
    const proRange = within(rangeGroup).getByRole('button', { name: 'Pro 360°' });
    fireEvent.click(proRange);

    expect(proRange).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Pro Mode' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('columnheader', { name: '120 degrees' })).toBeInTheDocument();

    fireEvent.click(functionOption('sin'));
    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
    expect(onPractice).toHaveBeenLastCalledWith(['sin'], true);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Choose trigonometric functions to practice' })).not.toBeInTheDocument());

    fireEvent.click(practiceButton);
    const standardRange = within(screen.getByRole('group', { name: 'Practice angle range' }))
      .getByRole('button', { name: 'Standard 90°' });
    fireEvent.click(standardRange);
    expect(standardRange).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Pro Mode' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('columnheader', { name: '120 degrees' })).not.toBeInTheDocument();

    fireEvent.click(functionOption('cos'));
    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
    expect(onPractice).toHaveBeenLastCalledWith(['cos'], false);
  });

  it('disables Start Practice until a function is selected and clears selections when dismissed', async () => {
    renderTrigTable();

    const practiceButton = await screen.findByRole('button', { name: 'Practice' });
    fireEvent.click(practiceButton);
    expect(screen.getByRole('button', { name: 'Start Practice' })).toBeDisabled();
    expect(screen.getByText('Select at least one function.')).toBeInTheDocument();

    fireEvent.click(functionOption('sin'));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Choose trigonometric functions to practice' })).not.toBeInTheDocument());
    fireEvent.click(practiceButton);
    expect(functionOption('sin')).toHaveAttribute('aria-pressed', 'false');
  });
});
