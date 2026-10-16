import { act, fireEvent, render, screen, within } from '@testing-library/react';
import PeriodicTableLearning from './PeriodicTableLearning';
import SwipeBack from './SwipeBack';
import SwipeContainer from './SwipeContainer';
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


  it('keeps the atomic-mass popup wide, viewport-anchored, and applies exact/round formatting', () => {
    vi.useFakeTimers();
    try {
      render(<PeriodicTableLearning selectedElement={null} onSelectElement={vi.fn()} />);
      const moreButton = screen.getByRole('button', { name: /open element range menu/i });

      fireEvent.click(moreButton);
      fireEvent.click(screen.getByRole('button', { name: /11–20 10 elements/i }));
      const table = screen.getByRole('table', { name: 'Elements 11–20' });
      const chlorineRow = within(table).getByRole('row', { name: /17.*Chlorine.*35\.45/ });
      expect(chlorineRow.querySelectorAll('td')[2]).toHaveTextContent('Cl');

      const openMassMenu = (pointerId: number) => {
        // Selecting a range changes the dedicated page and remounts the toolbar.
        const currentMoreButton = screen.getByRole('button', { name: /open element range menu/i });
        fireEvent.pointerDown(currentMoreButton, { button: 0, pointerId, pointerType: 'touch' });
        act(() => { vi.advanceTimersByTime(550); });
        fireEvent.pointerUp(currentMoreButton, { button: 0, pointerId, pointerType: 'touch' });
      };

      openMassMenu(101);
      const dialog = screen.getByRole('dialog', { name: 'Atomic mass format' });
      expect(dialog).toHaveClass('periodic-mass-menu', 'fixed', 'z-[100]');
      expect(dialog.parentElement).toBe(document.body);
      expect(dialog).toHaveStyle({ position: 'fixed' });
      const width = Number.parseFloat((dialog as HTMLElement).style.width);
      const left = Number.parseFloat((dialog as HTMLElement).style.left);
      const top = Number.parseFloat((dialog as HTMLElement).style.top);
      expect(width).toBeGreaterThan(0);
      expect(width).toBeLessThanOrEqual(window.innerWidth - 24);
      expect(left).toBeGreaterThanOrEqual(12);
      expect(left + width).toBeLessThanOrEqual(window.innerWidth - 12);
      expect(top).toBeGreaterThanOrEqual(12);
      expect(screen.getByRole('button', { name: /Exact Figure/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Round Figure/ })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Round Figure/ }));
      expect(screen.queryByRole('dialog', { name: 'Atomic mass format' })).not.toBeInTheDocument();
      expect(within(table).getByRole('row', { name: /17.*Chlorine.*35\.5/ })).toBeInTheDocument();

      openMassMenu(102);
      fireEvent.click(screen.getByRole('button', { name: /Exact Figure/ }));
      expect(screen.queryByRole('dialog', { name: 'Atomic mass format' })).not.toBeInTheDocument();
      expect(within(table).getByRole('row', { name: /17.*Chlorine.*35\.45/ })).toBeInTheDocument();
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
    expect(Array.from(table.querySelectorAll('col')).map((column) => column.className)).toEqual([
      'periodic-col-number',
      'periodic-col-element',
      'periodic-col-symbol',
      'periodic-col-mass',
    ]);
    expect(table).toHaveClass('periodic-range-table', 'w-max', 'min-w-0', 'table-fixed');
    expect(table.querySelector('thead th:last-child')).toHaveClass('whitespace-nowrap', 'text-center', 'periodic-range-mass');
    expect(table.querySelector('thead th:last-child')).not.toHaveClass('text-right');
    const atomicMassCells = Array.from(table.querySelectorAll('tbody td.periodic-range-mass'));
    expect(atomicMassCells).toHaveLength(10);
    expect(atomicMassCells.every((cell) => cell.classList.contains('text-center'))).toBe(true);
    expect(atomicMassCells.every((cell) => !cell.classList.contains('text-right'))).toBe(true);
    const headers = Array.from(table.querySelectorAll('thead th'));
    expect(headers.every((header) => header.classList.contains('periodic-range-column-heading'))).toBe(true);
    expect(headers.every((header) => header.classList.contains('periodic-range-header-cell'))).toBe(true);
    expect(headers[0]).toHaveClass('text-center');
    expect(headers[1]).toHaveClass('text-left');
    expect(headers[2]).toHaveClass('text-center');
    expect(headers[3]).toHaveClass('text-center', 'periodic-range-mass');
    expect(headers[3]).not.toHaveClass('text-right');
    const columnTints = [
      'periodic-tint-number',
      'periodic-tint-element',
      'periodic-tint-symbol',
      'periodic-tint-mass',
    ];
    expect(headers.map((header) => columnTints.find((tint) => header.classList.contains(tint))).filter(Boolean)).toEqual(columnTints);
    expect(table.querySelectorAll('tbody td.periodic-range-cell')).toHaveLength(40);
    const tableRegion = screen.getByRole('region', { name: 'Elements 21–30 table' });
    expect(tableRegion).not.toHaveClass('max-h-[min(64dvh,38rem)]');
    expect(tableRegion).toHaveClass('overflow-x-auto');
    expect(table.closest('.periodic-range-table-frame')).toBeNull();
    expect(table.parentElement).toBe(tableRegion);
    const dataRows = Array.from(table.querySelectorAll('tbody tr'));
    expect(dataRows).toHaveLength(10);
    expect(dataRows.every((row) => row.classList.contains('periodic-range-data-row'))).toBe(true);
    expect(dataRows.every((row) => row.querySelectorAll('td.periodic-range-row-cell').length === 4)).toBe(true);
    expect(dataRows.every((row) =>
      Array.from(row.querySelectorAll('td')).every((cell, index) => cell.classList.contains(columnTints[index])),
    )).toBe(true);
    expect(table.querySelector('thead tr')).not.toHaveClass('periodic-range-data-row');
    expect(table.closest('.periodic-range-table-frame')).toBeNull();
    expect(table.querySelector('.periodic-range-element-name')).toBeInTheDocument();
    expect(table.querySelector('.periodic-range-symbol')).toBeInTheDocument();
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


  it('routes the range-page Back arrow directly to the main Periodic Table without reopening the range picker', () => {
    const onSelectRange = vi.fn();
    const onBackToTable = vi.fn();
    const baseProps = {
      selectedElement: null,
      onSelectElement: vi.fn(),
      onSelectRange,
      onBackToTable,
    };
    const { rerender } = render(<PeriodicTableLearning {...baseProps} selectedRangeIndex={0} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBackToTable).toHaveBeenCalledTimes(1);
    expect(onSelectRange).not.toHaveBeenCalled();

    rerender(<PeriodicTableLearning {...baseProps} selectedRangeIndex={null} />);
    expect(screen.getByRole('heading', { name: 'Periodic Table' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hydrogen, atomic number 1/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Element ranges' })).not.toBeInTheDocument();
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

  it('selects Periodic Table properties before opening Practice Mode and preserves the range menu', () => {
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
    const dialog = screen.getByRole('dialog', { name: 'Choose What to Practice' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(onOpenPractice).not.toHaveBeenCalled();
    const continueButton = within(dialog).getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeDisabled();

    const atomicNumber = within(dialog).getByRole('checkbox', { name: 'Atomic No.' });
    const element = within(dialog).getByRole('checkbox', { name: 'Element' });
    const symbol = within(dialog).getByRole('checkbox', { name: 'Symbol' });
    const mass = within(dialog).getByRole('checkbox', { name: 'Atomic Mass' });
    fireEvent.click(atomicNumber);
    fireEvent.click(element);
    fireEvent.click(mass);
    fireEvent.click(element);
    fireEvent.click(element);
    expect(atomicNumber).toHaveAttribute('aria-checked', 'true');
    expect(element).toHaveAttribute('aria-checked', 'true');
    expect(symbol).toHaveAttribute('aria-checked', 'false');
    expect(mass).toHaveAttribute('aria-checked', 'true');
    expect(continueButton).toBeEnabled();

    fireEvent.click(continueButton);
    expect(onOpenPractice).toHaveBeenCalledTimes(1);
    expect(onOpenPractice).toHaveBeenCalledWith({
      from: 1,
      to: 10,
      questionTypes: ['atomic-number', 'name', 'mass'],
      massMode: 'exact',
    });
    expect(screen.queryByRole('dialog', { name: 'Choose What to Practice' })).not.toBeInTheDocument();

    fireEvent.click(rangeButton);
    expect(screen.getByRole('dialog', { name: 'Element ranges' })).toBeInTheDocument();
  });

  it('preserves property selections when the popup is cancelled and reopened without duplicates', () => {
    const onOpenPractice = vi.fn();
    render(
      <PeriodicTableLearning
        selectedElement={null}
        selectedRangeIndex={1}
        onSelectElement={vi.fn()}
        onOpenPractice={onOpenPractice}
      />,
    );

    const practice = screen.getByRole('button', { name: /practice/i });
    fireEvent.click(practice);
    let dialog = screen.getByRole('dialog', { name: 'Choose What to Practice' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Symbol' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onOpenPractice).not.toHaveBeenCalled();

    fireEvent.click(practice);
    dialog = screen.getByRole('dialog', { name: 'Choose What to Practice' });
    expect(within(dialog).getByRole('checkbox', { name: 'Symbol' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Atomic No.' }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Element' }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Atomic Mass' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(onOpenPractice).toHaveBeenCalledTimes(1);
    expect(onOpenPractice).toHaveBeenCalledWith({
      from: 11,
      to: 20,
      questionTypes: ['symbol', 'atomic-number', 'name', 'mass'],
      massMode: 'exact',
    });
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

describe('Periodic Table range edge-back gesture', () => {
  const dispatchPointer = (
    target: HTMLElement,
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    init: { pointerId: number; pointerType: string; clientX: number; clientY: number; button?: number },
  ) => {
    // jsdom versions without PointerEvent silently fall back to generic events.
    // Define the pointer fields on a bubbling event so React receives the exact
    // touch-pointer coordinates/types the gesture recognizer expects.
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, init);
    target.dispatchEvent(event);
  };

  const fireRightPointerSwipe = (target: HTMLElement, pointerId: number, startX = 12) => {
    dispatchPointer(target, 'pointerdown', {
      pointerId, pointerType: 'touch', button: 0, clientX: startX, clientY: 120,
    });
    dispatchPointer(target, 'pointermove', {
      pointerId, pointerType: 'touch', clientX: startX + 24, clientY: 122,
    });
    dispatchPointer(target, 'pointermove', {
      pointerId, pointerType: 'touch', clientX: startX + 84, clientY: 123,
    });
    dispatchPointer(target, 'pointerup', {
      pointerId, pointerType: 'touch', clientX: startX + 84, clientY: 123,
    });
  };

  it('allows an edge-back swipe through the range page swipe-ignore surface when opted in', () => {
    const onBackToTable = vi.fn();
    render(
      <SwipeBack enabled allowIgnoredEdgeSwipe onBack={onBackToTable}>
        <div data-swipe-ignore-back="true" data-testid="range-swipe-surface">Range content</div>
      </SwipeBack>,
    );

    fireRightPointerSwipe(screen.getByTestId('range-swipe-surface'), 301);

    expect(onBackToTable).toHaveBeenCalledTimes(1);
  });

  it('keeps ignored surfaces protected by default and never captures a non-edge start', () => {
    const defaultOnBack = vi.fn();
    const { unmount } = render(
      <SwipeBack enabled onBack={defaultOnBack}>
        <div data-swipe-ignore-back="true" data-testid="default-ignored-surface">Range content</div>
      </SwipeBack>,
    );
    fireRightPointerSwipe(screen.getByTestId('default-ignored-surface'), 302);
    expect(defaultOnBack).not.toHaveBeenCalled();
    unmount();

    const allowEdgeOnBack = vi.fn();
    render(
      <SwipeBack enabled allowIgnoredEdgeSwipe onBack={allowEdgeOnBack}>
        <div data-swipe-ignore-back="true" data-testid="non-edge-surface">Range content</div>
      </SwipeBack>,
    );
    fireRightPointerSwipe(screen.getByTestId('non-edge-surface'), 303, 40);
    expect(allowEdgeOnBack).not.toHaveBeenCalled();
  });

  it('cancels edge-back navigation when the gesture is cancelled or vertical', () => {
    const onBack = vi.fn();
    const { getByTestId } = render(
      <SwipeBack enabled allowIgnoredEdgeSwipe onBack={onBack}>
        <div data-swipe-ignore-back="true" data-testid="cancel-range-swipe">Range content</div>
      </SwipeBack>,
    );
    const surface = getByTestId('cancel-range-swipe');

    dispatchPointer(surface, 'pointerdown', { pointerId: 304, pointerType: 'touch', button: 0, clientX: 12, clientY: 100 });
    dispatchPointer(surface, 'pointermove', { pointerId: 304, pointerType: 'touch', clientX: 36, clientY: 102 });
    dispatchPointer(surface, 'pointercancel', { pointerId: 304, pointerType: 'touch', clientX: 100, clientY: 102 });
    expect(onBack).not.toHaveBeenCalled();

    dispatchPointer(surface, 'pointerdown', { pointerId: 305, pointerType: 'touch', button: 0, clientX: 12, clientY: 100 });
    dispatchPointer(surface, 'pointermove', { pointerId: 305, pointerType: 'touch', clientX: 14, clientY: 140 });
    dispatchPointer(surface, 'pointerup', { pointerId: 305, pointerType: 'touch', clientX: 14, clientY: 145 });
    expect(onBack).not.toHaveBeenCalled();
  });

  it('reserves edge-origin touches for Back while middle swipes still change ranges', () => {
    const onIndexChange = vi.fn();
    const { container } = render(
      <SwipeContainer
        edgeBackEnabled
        itemCount={12}
        currentIndex={5}
        onIndexChange={onIndexChange}
        renderItem={(index) => <div>Range {index + 1}</div>}
      />,
    );
    const surface = container.firstElementChild as HTMLElement;

    fireEvent.touchStart(surface, { touches: [{ identifier: 306, clientX: 12, clientY: 100 }] });
    fireEvent.touchMove(surface, { touches: [{ identifier: 306, clientX: 100, clientY: 102 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ identifier: 306, clientX: 100, clientY: 102 }] });
    expect(onIndexChange).not.toHaveBeenCalled();

    fireEvent.touchStart(surface, { touches: [{ identifier: 307, clientX: 140, clientY: 100 }] });
    fireEvent.touchMove(surface, { touches: [{ identifier: 307, clientX: 60, clientY: 102 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ identifier: 307, clientX: 60, clientY: 102 }] });
    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(onIndexChange).toHaveBeenCalledWith(6);

    fireEvent.touchStart(surface, { touches: [{ identifier: 308, clientX: 60, clientY: 100 }] });
    fireEvent.touchMove(surface, { touches: [{ identifier: 308, clientX: 140, clientY: 102 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ identifier: 308, clientX: 140, clientY: 102 }] });
    expect(onIndexChange).toHaveBeenCalledTimes(2);
    expect(onIndexChange).toHaveBeenLastCalledWith(4);
  });
});

