import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import StudyTracker from '@/components/StudyTracker';
import {
  STUDY_TRACKER_STORAGE_KEY,
  createDefaultStudyTrackerState,
  saveStudyTrackerState,
  upsertStudyEntry,
  type StudyTrackerState,
} from '@/lib/studyTracker';

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
  Object.defineProperties(event, {
    pointerId: { configurable: true, value: init.pointerId ?? 1 },
    pointerType: { configurable: true, value: 'touch' },
    button: { configurable: true, value: 0 },
    isPrimary: { configurable: true, value: true },
    clientX: { configurable: true, value: init.clientX ?? 0 },
    clientY: { configurable: true, value: init.clientY ?? 0 },
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

    const modeMenu = screen.getByRole('menu', { name: 'Study Tracker mode' });
    expect(modeMenu).toBeInTheDocument();
    expect(modeMenu).toHaveStyle({ width: '9rem', maxWidth: 'none' });
    for (const option of screen.getAllByRole('menuitemradio')) {
      expect(option).toHaveStyle({ minWidth: '0px', minHeight: '0px' });
    }
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
    expect(screen.getByRole('dialog', { name: 'Subjects' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('New subject'), { target: { value: 'English' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add$/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.getByRole('columnheader', { name: 'English' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Edit Math entry for/ })[0]);
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

  it('keeps the period header compact and handles swipes without changing the table from cell gestures', () => {
    saveStudyTrackerState(createDefaultStudyTrackerState(new Date(2026, 9, 20, 12, 0, 0)));
    render(<StudyTracker />);

    expect(screen.queryByText(/Reference template/)).not.toBeInTheDocument();
    expect(screen.queryByText('Swipe ‹ ›')).not.toBeInTheDocument();
    expect(screen.queryByText('Completed', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.getByText('20 Oct – 26 Oct 2026')).toBeInTheDocument();

    const period = screen.getByRole('group', { name: /Study period/ });
    act(() => {
      dispatchPointer(period, 'pointerdown', { clientX: 230, clientY: 12 });
      dispatchPointer(period, 'pointerup', { clientX: 150, clientY: 14 });
    });
    expect(screen.getByText('27 Oct – 2 Nov 2026')).toBeInTheDocument();

    const table = screen.getByRole('region', { name: 'Seven day study table' }).querySelector('table');
    if (!(table instanceof HTMLElement)) throw new Error('Study table did not render.');
    act(() => {
      dispatchPointer(table, 'pointerdown', { clientX: 230, clientY: 12 });
      dispatchPointer(table, 'pointerup', { clientX: 150, clientY: 14 });
    });
    expect(screen.getByText('27 Oct – 2 Nov 2026')).toBeInTheDocument();
  });

  it('shows separate completed and in-progress indicators for a mixed monthly study day', () => {
    const initial = {
      ...createDefaultStudyTrackerState(new Date(2026, 9, 20, 12, 0, 0)),
      preferences: {
        ...createDefaultStudyTrackerState(new Date(2026, 9, 20, 12, 0, 0)).preferences,
        anchorDate: '2026-10-20',
      },
    };
    const mathDone = upsertStudyEntry(initial, {
      date: '2026-10-20', subjectId: 'builtin-math', status: 'completed', minutes: 25, note: '',
    }, new Date(2026, 9, 20, 12, 0, 0));
    const mixedDay = upsertStudyEntry(mathDone, {
      date: '2026-10-20', subjectId: 'builtin-reasoning', status: 'in-progress', minutes: 10, note: '',
    }, new Date(2026, 9, 20, 12, 0, 0));
    saveStudyTrackerState(mixedDay);
    render(<StudyTracker />);

    const modeButton = screen.getByRole('button', { name: /current mode table/i });
    fireEvent.click(modeButton);
    fireEvent.click(modeButton);

    const day = screen.getByRole('button', { name: /Tuesday 20 October 2026, 1 complete, 1 incomplete/i });
    const indicators = day.querySelectorAll('span[aria-hidden="true"] svg');
    expect(indicators).toHaveLength(2);
    expect(indicators[0]).toHaveClass('text-success');
    expect(indicators[1]).toHaveClass('text-primary');
  });

  it('archives subjects without destroying past entries and keeps all views connected', () => {
    render(<StudyTracker />);

    fireEvent.click(screen.getAllByRole('button', { name: /Edit Math entry for/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    fireEvent.click(screen.getByRole('button', { name: /Save entry/ }));

    fireEvent.click(screen.getByRole('button', { name: /Manage/ }));
    // The accessible archive action appears only while subject management is open.
    fireEvent.click(screen.getByRole('button', { name: /Archive Math/ }));
    fireEvent.click(screen.getByRole('button', { name: /Archive subject/ }));

    const saved = JSON.parse(localStorage.getItem(STUDY_TRACKER_STORAGE_KEY) ?? 'null') as StudyTrackerState | null;
    expect(saved?.subjects.find((subject) => subject.id === 'builtin-math')?.archived).toBe(true);
    expect(Object.values(saved?.entries ?? {}).some((entry) =>
      entry.subjectId === 'builtin-math' && entry.status === 'completed',
    )).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    fireEvent.click(screen.getByRole('button', { name: /Current mode Table/ }));
    expect(screen.getByText('Week mode')).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: 'Math' })).not.toBeInTheDocument();
  });
});
