import { fireEvent, render, screen, within } from '@testing-library/react';
import PeriodicTableLearning from './PeriodicTableLearning';
import { getPeriodicSwipeDirection } from '@/lib/periodicRangeNavigation';

describe('PeriodicTableLearning', () => {
  it('opens the range grid from the three-dot menu and selects the requested range', () => {
    const onSelectElement = vi.fn();
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={onSelectElement} />);

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));

    expect(screen.getByRole('dialog', { name: 'Element ranges' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /21–30 10 elements/i }));

    expect(screen.getByRole('heading', { name: 'Elements 21–30' })).toBeInTheDocument();
    expect(screen.getByLabelText('Periodic Table elements 21 to 30')).toBeInTheDocument();
    expect(screen.queryByLabelText('Periodic Table elements 1 to 10')).not.toBeInTheDocument();
  });

  it('renders the selected range in a four-column table with the shared element data', () => {
    const onSelectElement = vi.fn();
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={onSelectElement} />);

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /21–30 10 elements/i }));

    const table = screen.getByRole('table', { name: 'Elements 21–30' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Atomic Number',
      'Element',
      'Symbol',
      'Atomic Mass',
    ]);
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(within(table).getByRole('row', { name: /21.*Scandium.*Sc.*44\.956/ })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /30.*Zinc.*Zn.*65\.38/ })).toBeInTheDocument();

    fireEvent.click(within(table).getByRole('button', { name: /Scandium, atomic number 21/i }));
    expect(onSelectElement).toHaveBeenCalledWith(21);
  });

  it('uses the required horizontal swipe direction and ignores vertical gestures', () => {
    expect(getPeriodicSwipeDirection(-140, 5)).toBe('next');
    expect(getPeriodicSwipeDirection(140, 5)).toBe('previous');
    expect(getPeriodicSwipeDirection(-60, 80)).toBeNull();
    expect(getPeriodicSwipeDirection(-55, 0)).toBeNull();
  });

  it('moves between ranges with the accessible next/previous controls', () => {
    const onSelectElement = vi.fn();
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={onSelectElement} />);

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /1–10 10 elements/i }));

    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));
    expect(screen.getByRole('heading', { name: 'Elements 11–20' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /← Prev/i }));
    expect(screen.getByRole('heading', { name: 'Elements 1–10' })).toBeInTheDocument();
  });

  it('keeps the range menu synchronized with the active range', () => {
    const onSelectElement = vi.fn();
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={onSelectElement} />);

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /21–30 10 elements/i }));

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    expect(screen.getByRole('button', { name: /21–30 10 elements/i })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /close element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    expect(screen.getByRole('button', { name: /31–40 10 elements/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not navigate beyond the first or last range', () => {
    const onSelectElement = vi.fn();
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={onSelectElement} />);

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /1–10 10 elements/i }));

    expect(screen.getByRole('button', { name: /← Prev/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));
    expect(screen.getByRole('heading', { name: 'Elements 11–20' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /← Prev/i }));
    expect(screen.getByRole('heading', { name: 'Elements 1–10' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /111–118 8 elements/i }));

    expect(screen.getByRole('button', { name: /Next →/i })).toBeDisabled();
    const finalTable = screen.getByRole('table', { name: 'Elements 111–118' });
    expect(within(finalTable).getAllByRole('row')).toHaveLength(9);
    expect(within(finalTable).getByRole('row', { name: /111.*Roentgenium.*Rg.*\[282\]/ })).toBeInTheDocument();
    expect(within(finalTable).getByRole('row', { name: /118.*Oganesson.*Og.*\[294\]/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /← Prev/i }));
    expect(screen.getByRole('heading', { name: 'Elements 101–110' })).toBeInTheDocument();
  });

  it('preserves element selection and the full-table two-axis scroll surface', () => {
    const onSelectElement = vi.fn();
    const { container } = render(<PeriodicTableLearning selectedElement={null} onSelectElement={onSelectElement} />);

    fireEvent.click(screen.getByRole('button', { name: /Hydrogen, atomic number 1/i }));
    expect(onSelectElement).toHaveBeenCalledWith(1);

    const scrollSurface = container.querySelector('.periodic-table-scroll');
    expect(scrollSurface).toHaveClass('overflow-x-auto', 'overflow-y-auto');
    expect(scrollSurface).toHaveAttribute('data-swipe-ignore-back', 'true');

    const tableContent = container.querySelector('.periodic-table-content');
    expect(tableContent).toHaveStyle({ minWidth: '1488px', width: '1488px', maxWidth: 'none' });
    const firstRow = container.querySelector('.periodic-table-row');
    expect(firstRow).toHaveStyle({ minWidth: '1488px', width: '1488px', maxWidth: 'none' });
  });
});