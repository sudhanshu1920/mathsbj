import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import StudyTracker from '@/components/StudyTracker';
import { STUDY_TRACKER_STORAGE_KEY, type StudyTrackerState } from '@/lib/studyTracker';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllTimers();
  vi.useRealTimers();
});

const dispatchPointer = (
  target: HTMLElement,
  type: 'pointerdown' | 'pointerup' | 'pointercancel',
  init: { pointerId?: number; clientX?: number; clientY?: number } = {},
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: init.pointerId ?? 1,
    pointerType: 'touch',
    button: 0,
    isPrimary: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
  });
  target.dispatchEvent(event);
};

describe('StudyTracker', () => {
  it('cycles Table → Week → Month → Table on one short tap per mode', () => {
    render(<StudyTracker onBack={vi.fn()} />);

    const modeButton = screen.getByRole('button', { name: /current mode table.*tap to switch view/i });
    expect(screen.getByText('Table mode')).toBeInTheDocument();

    fireEvent.click(modeButton);
    expect(screen.getByText('Week mode')).toBeInTheDocument();

    fireEvent.click(modeButton);
    expect(screen.getByText('Month mode')).toBeInTheDocument();

    fireEvent.click(modeButton);
    expect(screen.getByText('Table mode')).toBeInTheDocument();
  });

  it('opens the mode selector on long press without also cycling modes', () => {
    vi.useFakeTimers();
    render(<StudyTracker />);

    const modeButton = screen.getByRole('button', { name: /current mode table.*tap to switch view/i });
    dispatchPointer(modeButton, 'pointerdown');

    act(() => {
      vi.advanceTimersByTime(550);
    });

    expect(screen.getByRole('menu', { name: 'Study Tracker mode' })).toBeInTheDocument();
    dispatchPointer(modeButton, 'pointerup');
    fireEvent.click(modeButton);

    expect(screen.getByText('Table mode')).toBeInTheDocument();
    expect(screen.getByRole('menu', { name: 'Study Tracker mode' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Week' }));
    expect(screen.getByText('Week mode')).toBeInTheDocument();
    expect(screen.queryByRole('menu', { name: 'Study Tracker mode' })).not.toBeInTheDocument();
  });

  it('adds a custom subject column and persists an editable entry by date and stable subject ID', () => {
    render(<StudyTracker />);

    fireEvent.click(screen.getByRole('button', { name: 'Add subject column' }));
    expect(screen.getByRole('dialog', { name: 'Manage subjects' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('New subject'), { target: { value: 'English' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add$/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.getByRole('columnheader', { name: 'English' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Edit Math entry for/ }));
    expect(screen.getByRole('dialog', { name: 'Edit Math' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    fireEvent.change(screen.getByLabelText(/Study duration/), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'Fractions and practice' } });
    fireEvent.click(screen.getByRole('button', { name: /Save entry/ }));

    const saved = JSON.parse(localStorage.getItem(STUDY_TRACKER_STORAGE_KEY) ?? 'null') as StudyTrackerState | null;
    expect(saved).not.toBeNull();
    expect(saved?.subjects.some((subject) => subject.name === 'English' && !subject.archived)).toBe(true);
    const mathEntry = Object.values(saved?.entries ?? {}).find((entry) =>
      entry.subjectId === 'builtin-math' && entry.date === saved?.preferences.anchorDate,
    );
    expect(mathEntry).toMatchObject({
      date: saved?.preferences.anchorDate,
      subjectId: 'builtin-math',
      status: 'completed',
      minutes: 45,
      note: 'Fractions and practice',
    });
    expect(Object.keys(saved?.entries ?? {})).toHaveLength(1);
  });

  it('archives subjects without destroying past entries and keeps all views connected', () => {
    const { container } = render(<StudyTracker />);
    fireEvent.click(screen.getByRole('button', { name: 'Add subject column' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));

    fireEvent.click(screen.getByRole('button', { name: /Edit Math entry for/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    fireEvent.click(screen.getByRole('button', { name: /Save entry/ }));

    fireEvent.click(screen.getByRole('button', { name: /Manage/ }));
    const mathRow = container.querySelector('div.rounded-xl.border') ?? container;
    // The accessible archive action appears only after the subject editor is open.
    fireEvent.click(screen.getByRole('button', { name: /Archive Math/ }));
    fireEvent.click(screen.getByRole('button', { name: /Archive subject/ }));

    const saved = JSON.parse(localStorage.getItem(STUDY_TRACKER_STORAGE_KEY) ?? 'null') as StudyTrackerState | null;
    expect(saved?.subjects.find((subject) => subject.id === 'builtin-math')?.archived).toBe(true);
    expect(Object.values(saved?.entries ?? {}).some((entry) =>
      entry.subjectId === 'builtin-math' && entry.status === 'completed',
    )).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Current mode Table/ }));
    expect(screen.getByText('Week mode')).toBeInTheDocument();
    expect(mathRow).toBeTruthy();
  });
});
