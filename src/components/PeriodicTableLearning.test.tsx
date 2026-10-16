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

  it('renders all twelve range choices in a responsive grid with equal-width card hooks', () => {
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));

    const dialog = screen.getByRole('dialog', { name: 'Element ranges' });
    expect(dialog).toHaveClass('periodic-range-menu');
    const rangeGrid = dialog.querySelector<HTMLElement>('[data-periodic-range-grid="true"]');
    expect(rangeGrid).not.toBeNull();
    expect(rangeGrid).toHaveClass('periodic-range-grid');

    const rangeButtons = within(rangeGrid as HTMLElement).getAllByRole('button');
    expect(rangeButtons).toHaveLength(12);
    expect(rangeButtons.map((button) => button.querySelector('span')?.textContent)).toEqual([
      '1–10',
      '11–20',
      '21–30',
      '31–40',
      '41–50',
      '51–60',
      '61–70',
      '71–80',
      '81–90',
      '91–100',
      '101–110',
      '111–118',
    ]);
    expect(rangeButtons.every((button) => button.classList.contains('periodic-range-card'))).toBe(true);
  });

  it('keeps the range picker as one opaque, fixed overlay and closes it on outside click', () => {
    const { container } = render(<PeriodicTableLearning selectedElement={null} onSelectElement={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));

    const dialog = screen.getByRole('dialog', { name: 'Element ranges' });
    expect(dialog).toHaveClass('periodic-range-menu', 'fixed', 'z-[100]', 'bg-popover');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.style.position).toBe('fixed');
    expect(container.querySelector('.periodic-range-menu')).toBeNull();
    expect(document.querySelectorAll('[role="dialog"][aria-label="Element ranges"]')).toHaveLength(1);

    const backdrop = document.querySelector('.periodic-range-backdrop');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as HTMLElement);
    expect(screen.queryByRole('dialog', { name: 'Element ranges' })).not.toBeInTheDocument();
  });

  it('does not let a long press also trigger the normal range-menu click', () => {
    vi.useFakeTimers();
    try {
      render(<PeriodicTableLearning selectedElement={null} onSelectElement={vi.fn()} />);
      const moreButton = screen.getByRole('button', { name: /open element range menu/i });

      fireEvent.pointerDown(moreButton, { button: 0, pointerId: 1, pointerType: 'touch' });
      act(() => { vi.advanceTimersByTime(550); });

      expect(screen.getByRole('dialog', { name: 'Atomic mass format' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Element ranges' })).not.toBeInTheDocument();

      fireEvent.pointerUp(moreButton, { button: 0, pointerId: 1, pointerType: 'touch' });
      fireEvent.click(moreButton);
      // Some mobile browsers dispatch contextmenu after the synthetic click.
      fireEvent.contextMenu(moreButton);

      expect(screen.getByRole('dialog', { name: 'Atomic mass format' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Element ranges' })).not.toBeInTheDocument();
      expect(document.querySelectorAll('[role="dialog"][aria-label="Element ranges"]')).toHaveLength(0);

      // Selecting a mass mode ends the old gesture; a deliberate keyboard-like
      // click must then open the range menu normally.
      fireEvent.click(screen.getByRole('button', { name: /^Exact/ }));
      expect(screen.queryByRole('dialog', { name: 'Atomic mass format' })).not.toBeInTheDocument();
      fireEvent.click(moreButton);
      expect(screen.getByRole('dialog', { name: 'Element ranges' })).toBeInTheDocument();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('cancels pending long-press work and never renders both popup types at once', () => {
    vi.useFakeTimers();
    try {
      render(<PeriodicTableLearning selectedElement={null} onSelectElement={vi.fn()} />);
      const moreButton = screen.getByRole('button', { name: /open element range menu/i });

      fireEvent.pointerDown(moreButton, { button: 0, pointerId: 7, pointerType: 'touch' });
      fireEvent.pointerCancel(moreButton, { button: 0, pointerId: 7, pointerType: 'touch' });
      act(() => { vi.advanceTimersByTime(600); });

      expect(screen.queryByRole('dialog', { name: 'Element ranges' })).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Atomic mass format' })).not.toBeInTheDocument();

      // A fresh short press remains a normal range-menu click after cancellation.
      fireEvent.pointerDown(moreButton, { button: 0, pointerId: 8, pointerType: 'touch' });
      fireEvent.pointerUp(moreButton, { button: 0, pointerId: 8, pointerType: 'touch' });
      fireEvent.click(moreButton);
      expect(screen.getByRole('dialog', { name: 'Element ranges' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Atomic mass format' })).not.toBeInTheDocument();

      fireEvent.click(document.querySelector('.periodic-range-backdrop') as HTMLElement);
      fireEvent.pointerDown(moreButton, { button: 0, pointerId: 9, pointerType: 'touch' });
      act(() => { vi.advanceTimersByTime(550); });
      expect(screen.getByRole('dialog', { name: 'Atomic mass format' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Element ranges' })).not.toBeInTheDocument();
      expect(document.querySelectorAll(
        '[role="dialog"][aria-label="Element ranges"], [role="dialog"][aria-label="Atomic mass format"]',
      )).toHaveLength(1);

      fireEvent.pointerUp(moreButton, { button: 0, pointerId: 9, pointerType: 'touch' });
      fireEvent.click(moreButton);
      fireEvent.contextMenu(moreButton);
      expect(screen.getAllByRole('dialog', { name: 'Atomic mass format' })).toHaveLength(1);
      expect(screen.queryByRole('dialog', { name: 'Element ranges' })).not.toBeInTheDocument();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('treats early contextmenu and the following click as one long-press gesture', () => {
    vi.useFakeTimers();
    try {
      render(<PeriodicTableLearning selectedElement={null} onSelectElement={vi.fn()} />);
      const moreButton = screen.getByRole('button', { name: /open element range menu/i });

      fireEvent.pointerDown(moreButton, { button: 0, pointerId: 2, pointerType: 'touch' });
      fireEvent.contextMenu(moreButton);
      act(() => { vi.advanceTimersByTime(700); });
      fireEvent.pointerUp(moreButton, { button: 0, pointerId: 2, pointerType: 'touch' });
      fireEvent.click(moreButton);
      fireEvent.contextMenu(moreButton);

      expect(screen.getByRole('dialog', { name: 'Atomic mass format' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Element ranges' })).not.toBeInTheDocument();
      expect(document.querySelectorAll('[role="dialog"][aria-label="Atomic mass format"]')).toHaveLength(1);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('opens the matching dedicated table from every range card', () => {
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={vi.fn()} />);

    const ranges: Array<[string, number]> = [
      ['1–10', 10],
      ['11–20', 10],
      ['21–30', 10],
      ['31–40', 10],
      ['41–50', 10],
      ['51–60', 10],
      ['61–70', 10],
      ['71–80', 10],
      ['81–90', 10],
      ['91–100', 10],
      ['101–110', 10],
      ['111–118', 8],
    ];

    for (const [label, count] of ranges) {
      fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
      fireEvent.click(screen.getByRole('button', { name: `${label} ${count} elements` }));
      expect(screen.getByRole('table', { name: `Elements ${label}` })).toBeInTheDocument();
    }
  });

  it('renders the selected range in a four-column table with the shared element data', () => {
    const onSelectElement = vi.fn();
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={onSelectElement} />);

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /21–30 10 elements/i }));

    const table = screen.getByRole('table', { name: 'Elements 21–30' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'ATOMIC NO.',
      'ELEMENT',
      'SYMBOL',
      'ATOMIC MASS',
    ]);
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(table.querySelectorAll('col')).toHaveLength(4);
    expect(table.querySelectorAll('col')[0]).toHaveStyle({ width: '18%' });
    expect(table.querySelectorAll('col')[1]).toHaveStyle({ width: '36%' });
    expect(table.querySelectorAll('col')[2]).toHaveStyle({ width: '25%' });
    expect(table.querySelectorAll('col')[3]).toHaveStyle({ width: '21%' });
    expect(table).toHaveClass('w-full', 'min-w-0', 'table-fixed');
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

  it('swipes through all twelve ranges and stops at both sequence boundaries', () => {
    const { container } = render(<PeriodicTableLearning selectedElement={null} onSelectElement={vi.fn()} />);
    const labels = ['1–10', '11–20', '21–30', '31–40', '41–50', '51–60', '61–70', '71–80', '81–90', '91–100', '101–110', '111–118'];
    const ranges = [
      [1, 10], [11, 20], [21, 30], [31, 40], [41, 50], [51, 60],
      [61, 70], [71, 80], [81, 90], [91, 100], [101, 110], [111, 118],
    ] as const;
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
    const swipe = (direction: 'next' | 'previous', currentIndex: number) => {
      // AnimatePresence may retain the outgoing range briefly; target the
      // currently active page explicitly instead of whichever node appears first.
      const page = container.querySelector(`[data-periodic-range-index="${currentIndex}"]`);
      expect(page).not.toBeNull();
      const startX = direction === 'next' ? 220 : 130;
      const endX = direction === 'next' ? 130 : 220;
      act(() => {
        dispatchTouch(page as Element, 'touchstart', startX, 140);
        dispatchTouch(page as Element, 'touchmove', endX, 144);
        dispatchTouch(page as Element, 'touchend', endX, 144);
      });
    };

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /1–10 10 elements/i }));
    expect(screen.getByRole('table', { name: 'Elements 1–10' })).toBeInTheDocument();

    for (let index = 1; index < ranges.length; index += 1) {
      swipe('next', index - 1);
      expect(screen.getByRole('table', { name: `Elements ${labels[index]}` })).toBeInTheDocument();
    }
    swipe('next', 11);
    expect(screen.getByRole('table', { name: 'Elements 111–118' })).toBeInTheDocument();

    for (let index = ranges.length - 2; index >= 0; index -= 1) {
      swipe('previous', index + 1);
      expect(screen.getByRole('table', { name: `Elements ${labels[index]}` })).toBeInTheDocument();
    }
    swipe('previous', 0);
    expect(screen.getByRole('table', { name: 'Elements 1–10' })).toBeInTheDocument();
  });

  it('removes the entire range-information row and its previous/next arrows', () => {
    render(<PeriodicTableLearning selectedElement={null} selectedRangeIndex={0} onSelectElement={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Elements 1–10' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Elements 1–10' })).toBeInTheDocument();
    expect(screen.queryByText('Atomic number range')).not.toBeInTheDocument();
    expect(screen.queryByText('Range 1 of 12')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Previous element range/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next element range/i })).not.toBeInTheDocument();
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

  it('preserves first/last range data without the removed arrow controls', () => {
    const baseProps = { selectedElement: null, onSelectElement: vi.fn() };
    const { rerender } = render(<PeriodicTableLearning {...baseProps} selectedRangeIndex={0} />);

    expect(screen.getByRole('table', { name: 'Elements 1–10' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Previous element range/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next element range/i })).not.toBeInTheDocument();

    rerender(<PeriodicTableLearning {...baseProps} selectedRangeIndex={11} />);
    const finalTable = screen.getByRole('table', { name: 'Elements 111–118' });
    expect(within(finalTable).getAllByRole('row')).toHaveLength(9);
    expect(within(finalTable).getByRole('row', { name: /111.*Roentgenium.*Rg.*\[282\]/ })).toBeInTheDocument();
    expect(within(finalTable).getByRole('row', { name: /118.*Oganesson.*Og.*\[294\]/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Previous element range/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next element range/i })).not.toBeInTheDocument();
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

  it('swipes from the table, preserves vertical scrolling, and keeps element selection working', () => {
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
      dispatchTouch(nextRangePage, 'touchmove', 310, 144);
      dispatchTouch(nextRangePage, 'touchend', 310, 144);
    });
    expect(screen.getByRole('table', { name: 'Elements 1–10' })).toBeInTheDocument();

    const restoredRangePage = screen.getByRole('region', { name: 'Periodic Table elements 1 to 10' });
    act(() => {
      dispatchTouch(restoredRangePage, 'touchstart', 220, 140);
      dispatchTouch(restoredRangePage, 'touchmove', 130, 144);
      dispatchTouch(restoredRangePage, 'touchend', 130, 144);
    });
    expect(screen.getByRole('table', { name: 'Elements 11–20' })).toBeInTheDocument();

    const verticalScrollPage = screen.getByRole('region', { name: 'Periodic Table elements 11 to 20' });
    act(() => {
      dispatchTouch(verticalScrollPage, 'touchstart', 220, 140);
      dispatchTouch(verticalScrollPage, 'touchmove', 214, 220);
      dispatchTouch(verticalScrollPage, 'touchend', 214, 220);
    });
    expect(screen.getByRole('table', { name: 'Elements 11–20' })).toBeInTheDocument();

    const scrollRegion = screen.getByRole('region', { name: 'Elements 11–20 table' });
    act(() => {
      dispatchTouch(scrollRegion, 'touchstart', 220, 140);
      dispatchTouch(scrollRegion, 'touchmove', 110, 143);
      dispatchTouch(scrollRegion, 'touchend', 110, 143);
    });
    expect(screen.getByRole('table', { name: 'Elements 21–30' })).toBeInTheDocument();

    const elementNameButton = screen.getByRole('button', { name: /Scandium, atomic number 21/i });
    fireEvent.click(elementNameButton);
    expect(onSelectElement).toHaveBeenCalledWith(21);
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

    const beforeDetailsTable = screen.getByRole('region', { name: 'Elements 21–30 table' }) as HTMLDivElement;
    beforeDetailsTable.scrollLeft = 140;
    fireEvent.scroll(beforeDetailsTable);

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

    rerender(<PeriodicTableLearning {...props} />);
    expect((screen.getByRole('region', { name: 'Elements 21–30 table' }) as HTMLDivElement).scrollLeft).toBe(140);
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