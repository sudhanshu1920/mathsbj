import { act, fireEvent, render, screen, within } from '@testing-library/react';
import PeriodicTableLearning from './PeriodicTableLearning';
import { getPeriodicRangeIndexFromDepth, getPeriodicSwipeDirection } from '@/lib/periodicRangeNavigation';

describe('PeriodicTableLearning', () => {
  it('opens the range grid from the three-dot menu and selects the requested range', () => {
    const onSelectElement = vi.fn();
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={onSelectElement} />);

    const moreButton = screen.getByRole('button', { name: /open element range menu/i });
    expect(moreButton).toHaveClass('h-10', 'w-10', 'rounded-xl');
    expect(moreButton.querySelector('svg')).toBeInTheDocument();
    fireEvent.click(moreButton);

    expect(screen.getByRole('dialog', { name: 'Element ranges' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /21–30 10 elements/i }));

    expect(screen.getByRole('heading', { name: 'Elements 21–30' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Elements 21–30 table' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Elements 21–30' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Periodic Table elements 1 to 10')).not.toBeInTheDocument();
  });

  it('renders the selected range in a four-column table with the shared element data', () => {
    const onSelectElement = vi.fn();
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={onSelectElement} />);

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /21–30 10 elements/i }));

    const table = screen.getByRole('table', { name: 'Elements 21–30' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Atomic No.',
      'Element',
      'Symbol',
      'Atomic Mass',
    ]);
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(table.querySelectorAll('col')).toHaveLength(4);
    expect(table.querySelectorAll('col')[0]).toHaveStyle({ width: '5.25rem' });
    expect(table.querySelectorAll('col')[2]).toHaveStyle({ width: '4.5rem' });
    const tableRegion = screen.getByRole('region', { name: 'Elements 21–30 table' });
    expect(tableRegion).not.toHaveClass('rounded-2xl', 'shadow-sm', 'border');
    expect(tableRegion).not.toHaveClass('max-h-[min(64dvh,38rem)]');
    expect(within(table).getByRole('row', { name: /21.*Scandium.*Sc.*44\.956/ })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /30.*Zinc.*Zn.*65\.38/ })).toBeInTheDocument();

    fireEvent.click(within(table).getByRole('button', { name: /Scandium, atomic number 21/i }));
    expect(onSelectElement).toHaveBeenCalledWith(21);
  });

  it('parses only valid Periodic Table range pages from navigation history', () => {
    expect(getPeriodicRangeIndexFromDepth('learn-periodic-table-range-0')).toBe(0);
    expect(getPeriodicRangeIndexFromDepth('learn-periodic-table-range-11')).toBe(11);
    expect(getPeriodicRangeIndexFromDepth('learn-periodic-table-range-12')).toBeNull();
    expect(getPeriodicRangeIndexFromDepth('learn-periodic-table-range--1')).toBeNull();
    expect(getPeriodicRangeIndexFromDepth('learn-periodic-table')).toBeNull();
    expect(getPeriodicRangeIndexFromDepth(null)).toBeNull();
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

    fireEvent.click(screen.getByRole('button', { name: /Next element range/i }));
    expect(screen.getByRole('table', { name: 'Elements 11–20' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Previous element range/i }));
    expect(screen.getByRole('table', { name: 'Elements 1–10' })).toBeInTheDocument();
  });

  it('restores the previously selected range when returning from its dedicated page', () => {
    const onSelectElement = vi.fn();
    const onSelectRange = vi.fn();
    const baseProps = { selectedElement: null, onSelectElement, onSelectRange };
    const { rerender } = render(<PeriodicTableLearning {...baseProps} selectedRangeIndex={null} />);

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /21–30 10 elements/i }));
    expect(onSelectRange).toHaveBeenCalledWith(2);

    rerender(<PeriodicTableLearning {...baseProps} selectedRangeIndex={2} />);
    expect(screen.getByRole('table', { name: 'Elements 21–30' })).toBeInTheDocument();

    rerender(<PeriodicTableLearning {...baseProps} selectedRangeIndex={null} />);
    expect(screen.getByRole('dialog', { name: 'Element ranges' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /21–30 10 elements/i })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /31–40 10 elements/i }));
    expect(onSelectRange).toHaveBeenLastCalledWith(3);
  });

  it('does not navigate beyond the first or last dedicated range page', () => {
    const onSelectElement = vi.fn();
    const onSelectRange = vi.fn();
    const baseProps = { selectedElement: null, onSelectElement, onSelectRange };
    const { rerender } = render(<PeriodicTableLearning {...baseProps} selectedRangeIndex={0} />);

    expect(screen.getByRole('button', { name: /Previous element range/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Next element range/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /Previous element range/i }));
    expect(onSelectRange).not.toHaveBeenCalled();

    rerender(<PeriodicTableLearning {...baseProps} selectedRangeIndex={11} />);
    expect(screen.getByRole('button', { name: /Next element range/i })).toBeDisabled();
    const finalTable = screen.getByRole('table', { name: 'Elements 111–118' });
    expect(within(finalTable).getAllByRole('row')).toHaveLength(9);
    expect(within(finalTable).getByRole('row', { name: /111.*Roentgenium.*Rg.*\[282\]/ })).toBeInTheDocument();
    expect(within(finalTable).getByRole('row', { name: /118.*Oganesson.*Og.*\[294\]/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Next element range/i }));
    expect(onSelectRange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Previous element range/i }));
    expect(onSelectRange).toHaveBeenCalledWith(10);
  });

  it('keeps Practice and the unchanged three-dot selector aligned on the dedicated page', () => {
    const onOpenPractice = vi.fn();
    const onSelectRange = vi.fn();
    render(
      <PeriodicTableLearning
        selectedElement={null}
        selectedRangeIndex={0}
        onSelectRange={onSelectRange}
        onSelectElement={vi.fn()}
        onOpenPractice={onOpenPractice}
      />,
    );

    const pageHeader = screen.getByRole('heading', { name: 'Elements 1–10' }).closest('[data-app-topbar]');
    expect(pageHeader).toBeInTheDocument();
    const header = pageHeader as HTMLElement;
    const practice = within(header).getByRole('button', { name: /practice/i });
    const rangeButton = within(header).getByRole('button', { name: /open element range menu/i });
    expect(practice).toBeInTheDocument();
    expect(rangeButton).toHaveClass('h-10', 'w-10', 'rounded-xl');
    expect(header.contains(practice)).toBe(true);
    expect(header.contains(rangeButton)).toBe(true);

    fireEvent.click(practice);
    expect(onOpenPractice).toHaveBeenCalledTimes(1);

    fireEvent.click(rangeButton);
    expect(screen.getByRole('dialog', { name: 'Element ranges' })).toBeInTheDocument();
  });

  it('uses Cube Roots touch swipe navigation and isolates vertical/table scrolling', () => {
    const onSelectElement = vi.fn();
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={onSelectElement} />);

    const dispatchTouch = (target: Element, type: 'touchstart' | 'touchmove' | 'touchend', x: number, y: number) => {
      const point = { identifier: 1, target, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y };
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        touches: { value: type === 'touchend' ? [] : [point] },
        targetTouches: { value: type === 'touchend' ? [] : [point] },
        changedTouches: { value: [point] },
      });
      target.dispatchEvent(event);
    };

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /1–10 10 elements/i }));

    const rangePage = screen.getByRole('region', { name: 'Periodic Table elements 1 to 10' });
    act(() => {
      dispatchTouch(rangePage, 'touchstart', 220, 140);
      dispatchTouch(rangePage, 'touchmove', 130, 144);
      dispatchTouch(rangePage, 'touchend', 130, 144);
    });
    expect(screen.getByRole('table', { name: 'Elements 11–20' })).toBeInTheDocument();

    const nextRangePage = screen.getByRole('region', { name: 'Periodic Table elements 11 to 20' });
    act(() => {
      dispatchTouch(nextRangePage, 'touchstart', 220, 140);
      dispatchTouch(nextRangePage, 'touchmove', 214, 220);
      dispatchTouch(nextRangePage, 'touchend', 214, 220);
    });
    expect(screen.getByRole('table', { name: 'Elements 11–20' })).toBeInTheDocument();

    const scrollRegion = screen.getByRole('region', { name: 'Elements 11–20 table' });
    act(() => {
      dispatchTouch(scrollRegion, 'touchstart', 220, 140);
      dispatchTouch(scrollRegion, 'touchmove', 110, 143);
      dispatchTouch(scrollRegion, 'touchend', 110, 143);
    });
    expect(screen.getByRole('table', { name: 'Elements 11–20' })).toBeInTheDocument();
  });

  it('shows the selected element on its detail page and does not attach range swipes there', () => {
    const onSelectElement = vi.fn();
    const onSelectRange = vi.fn();
    const onBack = vi.fn();
    const props = {
      selectedElement: null as number | null,
      selectedRangeIndex: 2,
      onSelectElement,
      onSelectRange,
      onBack,
    };
    const { rerender } = render(<PeriodicTableLearning {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Scandium, atomic number 21/i }));
    expect(onSelectElement).toHaveBeenCalledWith(21);

    rerender(<PeriodicTableLearning {...props} selectedElement={21} />);
    expect(screen.getAllByRole('heading', { name: 'Scandium' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('44.956').length).toBeGreaterThan(0);
    expect(screen.getByText('Electron Configuration')).toBeInTheDocument();

    const details = screen.getByLabelText('Scandium element details');
    fireEvent.pointerDown(details, { pointerType: 'touch', button: 0, clientX: 230, clientY: 120, isPrimary: true });
    fireEvent.pointerUp(details, { pointerType: 'touch', button: 0, clientX: 100, clientY: 123, isPrimary: true });
    expect(onSelectRange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Back to previous Periodic Table page/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
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