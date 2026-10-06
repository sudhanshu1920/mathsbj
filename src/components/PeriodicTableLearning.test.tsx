import { fireEvent, render, screen } from '@testing-library/react';
import PeriodicTableLearning from './PeriodicTableLearning';

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

  it('moves to next and previous ranges with horizontal touch swipes without changing on vertical swipes', () => {
    const onSelectElement = vi.fn();
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={onSelectElement} />);

    const menuButton = screen.getByRole('button', { name: /open element range menu/i });
    fireEvent.click(menuButton);
    fireEvent.click(screen.getByRole('button', { name: /1–10 10 elements/i }));

    const rangeSurface = screen.getByLabelText('Periodic Table elements 1 to 10');

    fireEvent.pointerDown(rangeSurface, { clientX: 320, clientY: 160, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerMove(rangeSurface, { clientX: 180, clientY: 165, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerUp(rangeSurface, { clientX: 180, clientY: 165, pointerId: 1, pointerType: 'touch' });

    expect(screen.getByRole('heading', { name: 'Elements 11–20' })).toBeInTheDocument();

    const nextSurface = screen.getByLabelText('Periodic Table elements 11 to 20');
    fireEvent.pointerDown(nextSurface, { clientX: 180, clientY: 160, pointerId: 2, pointerType: 'touch' });
    fireEvent.pointerMove(nextSurface, { clientX: 190, clientY: 290, pointerId: 2, pointerType: 'touch' });
    fireEvent.pointerUp(nextSurface, { clientX: 190, clientY: 290, pointerId: 2, pointerType: 'touch' });

    expect(screen.getByRole('heading', { name: 'Elements 11–20' })).toBeInTheDocument();
  });

  it('keeps the range menu synchronized after swipe and ignores cancelled swipes', () => {
    const onSelectElement = vi.fn();
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={onSelectElement} />);

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /21–30 10 elements/i }));

    const rangeSurface = screen.getByLabelText('Periodic Table elements 21 to 30');
    fireEvent.pointerDown(rangeSurface, { clientX: 320, clientY: 160, pointerId: 11, pointerType: 'touch' });
    fireEvent.pointerMove(rangeSurface, { clientX: 180, clientY: 160, pointerId: 11, pointerType: 'touch' });
    fireEvent.pointerUp(rangeSurface, { clientX: 180, clientY: 160, pointerId: 11, pointerType: 'touch' });

    expect(screen.getByRole('heading', { name: 'Elements 31–40' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    expect(screen.getByRole('button', { name: /31–40 10 elements/i })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /close element range menu/i }));

    const nextSurface = screen.getByLabelText('Periodic Table elements 31 to 40');
    fireEvent.pointerDown(nextSurface, { clientX: 320, clientY: 160, pointerId: 12, pointerType: 'touch' });
    fireEvent.pointerMove(nextSurface, { clientX: 180, clientY: 160, pointerId: 12, pointerType: 'touch' });
    fireEvent.pointerCancel(nextSurface, { clientX: 120, clientY: 160, pointerId: 12, pointerType: 'touch' });

    expect(screen.getByRole('heading', { name: 'Elements 31–40' })).toBeInTheDocument();
  });

  it('does not navigate beyond the first or last range', () => {
    const onSelectElement = vi.fn();
    render(<PeriodicTableLearning selectedElement={null} onSelectElement={onSelectElement} />);

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /1–10 10 elements/i }));

    let rangeSurface = screen.getByLabelText('Periodic Table elements 1 to 10');
    fireEvent.pointerDown(rangeSurface, { clientX: 180, clientY: 160, pointerId: 3, pointerType: 'touch' });
    fireEvent.pointerMove(rangeSurface, { clientX: 320, clientY: 160, pointerId: 3, pointerType: 'touch' });
    fireEvent.pointerUp(rangeSurface, { clientX: 320, clientY: 160, pointerId: 3, pointerType: 'touch' });
    expect(screen.getByRole('heading', { name: 'Elements 1–10' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open element range menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /110–118 9 elements/i }));

    rangeSurface = screen.getByLabelText('Periodic Table elements 110 to 118');
    fireEvent.pointerDown(rangeSurface, { clientX: 320, clientY: 160, pointerId: 4, pointerType: 'touch' });
    fireEvent.pointerMove(rangeSurface, { clientX: 170, clientY: 160, pointerId: 4, pointerType: 'touch' });
    fireEvent.pointerUp(rangeSurface, { clientX: 170, clientY: 160, pointerId: 4, pointerType: 'touch' });

    expect(screen.getByRole('heading', { name: 'Elements 110–118' })).toBeInTheDocument();
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
    expect(tableContent).toHaveStyle({ minWidth: '1416px' });
  });
});
