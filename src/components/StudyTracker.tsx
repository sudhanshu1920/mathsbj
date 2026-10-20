import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  X,
} from 'lucide-react';
import { format, isSunday, isSameMonth, isToday, parseISO } from 'date-fns';
import {
  STUDY_TRACKER_STORAGE_KEY,
  STUDY_TRACKER_TEMPLATE_END,
  STUDY_TRACKER_TEMPLATE_START,
  addStudySubject,
  cycleStudyMode,
  formatDateKey,
  getMonthDates,
  getStudyEntry,
  getTableDates,
  getWeekDates,
  isDateKey,
  isStudyEntryStatus,
  loadStudyTrackerState,
  parseDateKey,
  reorderStudySubject,
  renameStudySubject,
  saveStudyTrackerState,
  setStudySubjectArchived,
  shiftStudyPeriod,
  upsertStudyEntry,
  type StudyEntry,
  type StudyEntryStatus,
  type StudyMode,
  type StudySubject,
  type StudyTrackerState,
} from '@/lib/studyTracker';

interface StudyTrackerProps {
  onBack?: () => void;
  onExit?: () => void;
}

type Overlay = 'subjects' | 'entry' | 'day-detail' | null;
type EntryDraft = { status: StudyEntryStatus; minutes: string; note: string };

const MODE_LABEL: Record<StudyMode, string> = {
  table: 'Table',
  week: 'Week',
  month: 'Month',
};

const STATUS_LABEL: Record<StudyEntryStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  completed: 'Completed',
};

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const makeEntryDraft = (entry?: StudyEntry): EntryDraft => ({
  status: entry?.status ?? 'not-started',
  minutes: entry && entry.minutes > 0 ? String(entry.minutes) : '',
  note: entry?.note ?? '',
});

const sortSubjects = (subjects: StudySubject[]) =>
  [...subjects].sort((left, right) => left.order - right.order);

const entryIsActive = (entry: StudyEntry | undefined): boolean =>
  !!entry && (entry.status !== 'not-started' || entry.minutes > 0 || entry.note.trim().length > 0);

const dateLabel = (dateKey: string, pattern = 'd MMM yyyy') =>
  format(parseDateKey(dateKey), pattern);

const periodLabel = (mode: StudyMode, anchorDate: string): string => {
  const date = parseDateKey(anchorDate);
  if (mode === 'month') return format(date, 'MMMM yyyy');
  const dates = mode === 'table' ? getTableDates(anchorDate) : getWeekDates(anchorDate);
  return dateLabel(dates[0], 'd MMM') + ' – ' + dateLabel(dates[dates.length - 1], 'd MMM yyyy');
};

const StatusGlyph = ({ status, small = false }: { status: StudyEntryStatus; small?: boolean }) => {
  const size = small ? 13 : 16;
  if (status === 'completed') return <CheckCircle2 size={size} className="text-success" aria-hidden="true" />;
  if (status === 'in-progress') return <Clock3 size={size} className="text-primary" aria-hidden="true" />;
  return <Circle size={size} className="text-muted-foreground/55" aria-hidden="true" />;
};

const OverlayFrame = ({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) => (
  <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-4" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="study-tracker-dialog-title"
      className="w-full max-w-lg overflow-hidden rounded-t-[1.4rem] border border-border bg-card text-card-foreground shadow-2xl sm:rounded-[1.4rem]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h3 id="study-tracker-dialog-title" className="font-display text-base font-extrabold text-foreground">{title}</h3>
          {description && <p className="mt-1 text-xs leading-4 text-muted-foreground">{description}</p>}
        </div>
        <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Close dialog">
          <X size={18} />
        </button>
      </header>
      <div className="max-h-[min(68dvh,34rem)] overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
      {footer && <footer className="border-t border-border/70 px-4 py-3 sm:px-5">{footer}</footer>}
    </section>
  </div>
);

const StudyTracker = ({ onBack, onExit }: StudyTrackerProps) => {
  const [state, setState] = useState<StudyTrackerState>(() => loadStudyTrackerState());
  const stateRef = useRef(state);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectNameDraft, setSubjectNameDraft] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [templateStartDraft, setTemplateStartDraft] = useState(state.preferences.templateStartDate);
  const [templateEndDraft, setTemplateEndDraft] = useState(state.preferences.templateEndDate);
  const [templateError, setTemplateError] = useState('');
  const [entryDate, setEntryDate] = useState(state.preferences.anchorDate);
  const [entrySubjectId, setEntrySubjectId] = useState('');
  const [entryDraft, setEntryDraft] = useState<EntryDraft>(makeEntryDraft());
  const [entryError, setEntryError] = useState('');
  const [returnToDayDetails, setReturnToDayDetails] = useState(false);
  const [dayDetailsDate, setDayDetailsDate] = useState(state.preferences.anchorDate);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const suppressNextClick = useRef(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<Overlay>(overlay);
  const archiveRef = useRef<string | null>(confirmArchiveId);
  const returnToDayDetailsRef = useRef(returnToDayDetails);

  stateRef.current = state;
  overlayRef.current = overlay;
  archiveRef.current = confirmArchiveId;
  returnToDayDetailsRef.current = returnToDayDetails;

  const commit = useCallback((updater: (previous: StudyTrackerState) => StudyTrackerState) => {
    const next = updater(stateRef.current);
    stateRef.current = next;
    setState(next);
    setStorageWarning(!saveStudyTrackerState(next));
  }, []);

  const setOverlayState = useCallback((next: Overlay) => {
    overlayRef.current = next;
    setOverlay(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('study-tracker-overlay-state', { detail: { open: next !== null } }));
    }
  }, []);

  const closeOverlay = useCallback(() => {
    if (archiveRef.current) {
      archiveRef.current = null;
      setConfirmArchiveId(null);
      return;
    }
    setOverlayState(null);
  }, [setOverlayState]);

  useEffect(() => {
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STUDY_TRACKER_STORAGE_KEY) return;
      const next = loadStudyTrackerState();
      stateRef.current = next;
      setState(next);
      setStorageWarning(false);
    };
    const closeFromAppBack = () => {
      if (archiveRef.current) {
        archiveRef.current = null;
        setConfirmArchiveId(null);
      } else if (overlayRef.current === 'entry' && returnToDayDetailsRef.current) {
        setOverlayState('day-detail');
      } else if (overlayRef.current !== null) {
        setOverlayState(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && overlayRef.current !== null) {
        event.preventDefault();
        closeFromAppBack();
      }
    };
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('study-tracker-back', closeFromAppBack);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('study-tracker-back', closeFromAppBack);
      window.removeEventListener('keydown', onKeyDown);
      if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
      window.dispatchEvent(new CustomEvent('study-tracker-overlay-state', { detail: { open: false } }));
    };
  }, [setOverlayState]);

  useEffect(() => {
    if (overlay !== 'subjects') return;
    setTemplateStartDraft(state.preferences.templateStartDate);
    setTemplateEndDraft(state.preferences.templateEndDate);
    setTemplateError('');
  }, [overlay, state.preferences.templateStartDate, state.preferences.templateEndDate]);

  const activeSubjects = sortSubjects(state.subjects.filter((subject) => !subject.archived));
  const archivedSubjects = sortSubjects(state.subjects.filter((subject) => subject.archived));
  const mode = state.preferences.mode;
  const anchorDate = state.preferences.anchorDate;

  const selectMode = (nextMode: StudyMode) => {
    setShowModeMenu(false);
    commit((previous) => ({
      ...previous,
      preferences: { ...previous.preferences, mode: nextMode },
    }));
  };

  const cycleMode = () => selectMode(cycleStudyMode(stateRef.current.preferences.mode));

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleModePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    clearLongPress();
    longPressTriggered.current = false;
    suppressNextClick.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      suppressNextClick.current = true;
      setShowModeMenu(true);
    }, 500);
  };

  const handleModePointerUp = () => {
    clearLongPress();
    if (longPressTriggered.current) {
      suppressNextClick.current = true;
      longPressTriggered.current = false;
    }
  };

  const handleModeClick = () => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    cycleMode();
  };

  const handleModeContextMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    clearLongPress();
    setShowModeMenu(true);
  };

  const beginPeriodSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const finishPeriodSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 52 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    navigatePeriod(dx < 0 ? 1 : -1);
  };

  const navigatePeriod = (direction: -1 | 1) => {
    commit((previous) => ({
      ...previous,
      preferences: {
        ...previous.preferences,
        anchorDate: shiftStudyPeriod(previous.preferences.anchorDate, previous.preferences.mode, direction),
      },
    }));
  };

  const updateAnchorDate = (date: string) => {
    if (!isDateKey(date)) return;
    commit((previous) => ({ ...previous, preferences: { ...previous.preferences, anchorDate: date } }));
  };

  const openEntry = (date: string, subject: StudySubject, fromDayDetails = false) => {
    setEntryDate(date);
    setEntrySubjectId(subject.id);
    setEntryDraft(makeEntryDraft(getStudyEntry(stateRef.current, date, subject.id)));
    setEntryError('');
    setReturnToDayDetails(fromDayDetails);
    setOverlayState('entry');
  };

  const saveEntry = () => {
    const rawMinutes = entryDraft.minutes.trim();
    if (rawMinutes && (!/^\d+$/.test(rawMinutes) || Number(rawMinutes) > 1440)) {
      setEntryError('Study minutes must be a whole number between 0 and 1440.');
      return;
    }
    const subjectExists = stateRef.current.subjects.some((subject) => subject.id === entrySubjectId);
    if (!subjectExists || !isDateKey(entryDate) || !isStudyEntryStatus(entryDraft.status)) {
      setEntryError('This entry is no longer valid. Close the editor and open it again.');
      return;
    }
    const minutes = rawMinutes ? Number(rawMinutes) : 0;
    const note = entryDraft.note.trim().slice(0, 240);
    const entry = {
      date: entryDate,
      subjectId: entrySubjectId,
      status: entryDraft.status,
      minutes,
      note,
    };
    commit((previous) => upsertStudyEntry(previous, entry));
    setEntryError('');
    setOverlayState(returnToDayDetails ? 'day-detail' : null);
  };

  const closeEntryEditor = () => {
    setEntryError('');
    setOverlayState(returnToDayDetails ? 'day-detail' : null);
  };

  const addSubject = () => {
    const result = addStudySubject(stateRef.current, newSubjectName);
    if (result.error) {
      setSubjectError(result.error);
      return;
    }
    commit(() => result.state);
    setNewSubjectName('');
    setSubjectError('');
  };

  const saveSubjectRename = (subjectId: string) => {
    const result = renameStudySubject(stateRef.current, subjectId, subjectNameDraft);
    if (result.error) {
      setSubjectError(result.error);
      return;
    }
    commit(() => result.state);
    setEditingSubjectId(null);
    setSubjectNameDraft('');
    setSubjectError('');
  };

  const moveSubject = (subjectId: string, direction: -1 | 1) => {
    commit((previous) => reorderStudySubject(previous, subjectId, direction));
  };

  const archiveSubject = (subjectId: string) => {
    commit((previous) => setStudySubjectArchived(previous, subjectId, true));
    setConfirmArchiveId(null);
    setSubjectError('');
  };

  const restoreSubject = (subjectId: string) => {
    commit((previous) => setStudySubjectArchived(previous, subjectId, false));
  };

  const saveTemplateRange = () => {
    if (!isDateKey(templateStartDraft) || !isDateKey(templateEndDraft) || templateStartDraft > templateEndDraft) {
      setTemplateError('Choose a valid start and end date. The end date must not be before the start date.');
      return;
    }
    commit((previous) => ({
      ...previous,
      preferences: {
        ...previous.preferences,
        templateStartDate: templateStartDraft,
        templateEndDate: templateEndDraft,
      },
    }));
    setTemplateError('');
  };

  const getEntryStatus = (date: string, subjectId: string): StudyEntryStatus =>
    getStudyEntry(state, date, subjectId)?.status ?? 'not-started';

  const dayEntries = (date: string) => activeSubjects.map((subject) => ({
    subject,
    entry: getStudyEntry(state, date, subject.id),
  }));

  const tableDates = getTableDates(anchorDate);
  const weekDates = getWeekDates(anchorDate);
  const monthDates = getMonthDates(anchorDate);
  const monthDate = parseDateKey(anchorDate);
  const entriesForPeriod = (mode === 'table' ? tableDates : mode === 'week' ? weekDates : monthDates.filter((date) => isSameMonth(parseDateKey(date), monthDate)))
    .flatMap((date) => activeSubjects.map((subject) => getStudyEntry(state, date, subject.id)))
    .filter((entry): entry is StudyEntry => !!entry);
  const periodCompleted = entriesForPeriod.filter((entry) => entry.status === 'completed').length;
  const periodDuration = entriesForPeriod.reduce((sum, entry) => sum + entry.minutes, 0);
  const periodActiveDays = new Set(entriesForPeriod.filter((entry) => entryIsActive(entry)).map((entry) => entry.date)).size;

  const dayCompletionCount = (date: string) =>
    activeSubjects.filter((subject) => getEntryStatus(date, subject.id) === 'completed').length;

  const openDayDetails = (date: string) => {
    updateAnchorDate(date);
    setDayDetailsDate(date);
    setOverlayState('day-detail');
  };

  const renderDateClass = (date: string, inMonth = true) => {
    const parts = [
      'relative min-w-0 rounded-lg border p-1.5 text-center transition-colors sm:p-2',
      inMonth ? 'text-foreground' : 'text-muted-foreground/55',
      isSunday(parseDateKey(date)) ? 'bg-[hsl(var(--warning)/0.13)]' : 'bg-card/35',
      isToday(parseDateKey(date)) ? 'border-primary ring-1 ring-primary/35' : 'border-border/75',
      'hover:border-primary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
    ];
    return parts.join(' ');
  };

  const goBackFromTracker = () => {
    if (onBack) onBack();
    else onExit?.();
  };

  const currentMonthLabel = format(monthDate, 'MMMM yyyy');

  return (
    <div className="study-tracker-screen min-w-0 pb-5">
      <header className="app-topbar-page flex items-center justify-between gap-2" data-app-topbar>
        <button type="button" onClick={goBackFromTracker} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Back to Learning Mode">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h2 className="truncate font-display text-sm font-extrabold text-foreground sm:text-base">Study Tracker</h2>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{MODE_LABEL[mode]} mode</p>
        </div>
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <button
            type="button"
            aria-label={`Current mode ${MODE_LABEL[mode]}. Tap to switch view; press and hold to choose a mode.`}
            aria-haspopup="menu"
            aria-expanded={showModeMenu}
            onPointerDown={handleModePointerDown}
            onPointerUp={handleModePointerUp}
            onPointerCancel={handleModePointerUp}
            onPointerLeave={handleModePointerUp}
            onContextMenu={handleModeContextMenu}
            onClick={handleModeClick}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MoreVertical size={20} />
          </button>
          <button type="button" className="sr-only focus:not-sr-only focus:absolute focus:right-0 focus:top-10 focus:z-50 focus:whitespace-nowrap focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg" onClick={() => setShowModeMenu(true)}>
            Choose tracker mode
          </button>
          {showModeMenu && (
            <>
              <button type="button" aria-label="Close mode selector" className="fixed inset-0 z-40 cursor-default" onClick={() => setShowModeMenu(false)} />
              <div role="menu" aria-label="Study Tracker mode" className="absolute right-0 top-10 z-50 w-36 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl">
                {(['table', 'week', 'month'] as StudyMode[]).map((option) => (
                  <button key={option} type="button" role="menuitemradio" aria-checked={mode === option} onClick={() => selectMode(option)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${mode === option ? 'bg-primary/12 font-bold text-primary' : 'text-foreground hover:bg-muted'}`}>
                    {MODE_LABEL[option]}
                    {mode === option && <Check size={15} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary"><CalendarCheck size={17} /></span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-foreground">{periodLabel(mode, anchorDate)}</p>
            <p className="truncate text-[10px] text-muted-foreground">Reference template · {dateLabel(state.preferences.templateStartDate)} – {dateLabel(state.preferences.templateEndDate)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => navigatePeriod(-1)} aria-label={`Previous ${MODE_LABEL[mode].toLowerCase()} period`} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/60 text-foreground hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ChevronLeft size={17} /></button>
          <button type="button" onClick={() => navigatePeriod(1)} aria-label={`Next ${MODE_LABEL[mode].toLowerCase()} period`} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/60 text-foreground hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ChevronRight size={17} /></button>
          <button type="button" onClick={() => { updateAnchorDate(formatDateKey(new Date())); }} aria-label="Go to today" className="inline-flex h-8 items-center justify-center rounded-full border border-primary/25 bg-primary/10 px-2 text-[11px] font-bold text-primary hover:bg-primary/15">Today</button>
        </div>
      </div>

      <div
        className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-card/50 px-3 py-2.5 select-none"
        onPointerDown={beginPeriodSwipe}
        onPointerUp={finishPeriodSwipe}
        onPointerCancel={() => { swipeStart.current = null; }}
        aria-label="Swipe left or right here to change the displayed period"
      >
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays size={15} className="shrink-0 text-primary" />
          <span className="truncate text-xs font-semibold text-foreground">{mode === 'month' ? currentMonthLabel : periodLabel(mode, anchorDate)}</span>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">Swipe ‹ ›</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} className="text-success" /> Completed</span>
          <span className="inline-flex items-center gap-1"><Clock3 size={12} className="text-primary" /> In progress</span>
          <span className="inline-flex items-center gap-1"><Circle size={12} /> Not started</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setOverlayState('subjects')} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card/60 px-2.5 text-[11px] font-semibold text-foreground hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Settings2 size={14} /> Manage
          </button>
          <button type="button" onClick={() => setOverlayState('subjects')} aria-label="Add subject column" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <Plus size={17} />
          </button>
        </div>
      </div>

      {storageWarning && (
        <p role="status" className="mt-2 rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-foreground">
          Changes are active for this session but could not be saved on this device. Check browser storage availability.
        </p>
      )}

      {activeSubjects.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-border p-5 text-center">
          <p className="text-sm font-semibold text-foreground">No active subjects</p>
          <p className="mt-1 text-xs text-muted-foreground">Restore a subject or add a new one to start tracking.</p>
          <button type="button" onClick={() => setOverlayState('subjects')} className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Plus size={13} className="mr-1 inline" /> Manage subjects</button>
        </div>
      )}

      {activeSubjects.length > 0 && mode === 'table' && (
        <section className="mt-3 overflow-hidden rounded-xl border border-border bg-card/45" aria-label="Seven day study table">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-max border-collapse text-xs">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-20 min-w-[6.2rem] border border-border bg-muted px-2.5 py-2.5 text-left font-display text-[11px] font-extrabold text-foreground">Date</th>
                  {activeSubjects.map((subject) => (
                    <th key={subject.id} scope="col" className="min-w-[5.4rem] max-w-[7.5rem] border border-border bg-muted px-2 py-2.5 text-center font-display text-[11px] font-extrabold text-foreground">
                      <span className="block max-w-[7rem] truncate" title={subject.name}>{subject.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableDates.map((date, rowIndex) => {
                  const day = parseDateKey(date);
                  const today = isToday(day);
                  const sunday = isSunday(day);
                  return (
                    <tr key={date} className={rowIndex % 2 === 0 ? 'bg-card/30' : 'bg-muted/25'}>
                      <th scope="row" className={`sticky left-0 z-10 border border-border px-2.5 py-2 text-left ${today ? 'bg-primary/15' : sunday ? 'bg-[hsl(var(--warning)/0.16)]' : rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/60'}`}>
                        <button type="button" onClick={() => openDayDetails(date)} className="flex w-full min-w-[5.8rem] flex-col items-start gap-0.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`View entries for ${dateLabel(date, 'EEEE d MMMM yyyy')}`}>
                          <span className="font-display text-[11px] font-bold text-foreground">{dateLabel(date, 'dd MMM')}</span>
                          <span className={`text-[9px] font-semibold ${today ? 'text-primary' : 'text-muted-foreground'}`}>{today ? 'Today' : dateLabel(date, 'EEE')}</span>
                        </button>
                      </th>
                      {activeSubjects.map((subject) => {
                        const entry = getStudyEntry(state, date, subject.id);
                        const status = entry?.status ?? 'not-started';
                        return (
                          <td key={subject.id} className={`border border-border p-0 ${today ? 'bg-primary/[0.045]' : sunday ? 'bg-[hsl(var(--warning)/0.08)]' : ''}`}>
                            <button type="button" onClick={() => openEntry(date, subject)} className="flex min-h-[2.8rem] w-full min-w-[5.25rem] items-center justify-center gap-1.5 px-2 py-2 text-foreground hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label={`Edit ${subject.name} entry for ${dateLabel(date, 'd MMMM yyyy')}. Status: ${STATUS_LABEL[status]}.`}>
                              {entry && entry.status !== 'not-started' ? <StatusGlyph status={entry.status} /> : <span className="text-muted-foreground/55">—</span>}
                              {entry?.minutes ? <span className="text-[9px] tabular-nums text-muted-foreground">{entry.minutes}m</span> : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-2 text-[10px] text-muted-foreground">
            <span>{tableDates.length} days · {activeSubjects.length} subjects</span>
            <span>{periodCompleted} completed entries · {periodDuration} min recorded</span>
          </div>
        </section>
      )}

      {activeSubjects.length > 0 && mode === 'week' && (
        <section className="mt-3 overflow-hidden rounded-xl border border-border bg-card/45" aria-label="Weekly subject overview">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[42rem] border-collapse text-xs">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-20 min-w-[7rem] border border-border bg-muted px-2 py-2.5 text-left font-display text-[11px] font-extrabold text-foreground">Subject</th>
                  {weekDates.map((date) => (
                    <th key={date} scope="col" className={`min-w-[3.1rem] border border-border px-1 py-2 text-center font-display text-[10px] font-extrabold ${isToday(parseDateKey(date)) ? 'bg-primary/15 text-primary' : isSunday(parseDateKey(date)) ? 'bg-[hsl(var(--warning)/0.16)] text-foreground' : 'bg-muted text-foreground'}`}>
                      <span className="block">{dateLabel(date, 'EEE')}</span><span className="mt-0.5 block font-normal">{dateLabel(date, 'd')}</span>
                    </th>
                  ))}
                  <th scope="col" className="min-w-[4rem] border border-border bg-muted px-2 py-2 text-center font-display text-[10px] font-extrabold text-foreground">Done</th>
                </tr>
              </thead>
              <tbody>
                {activeSubjects.map((subject, rowIndex) => {
                  const total = weekDates.filter((date) => getEntryStatus(date, subject.id) === 'completed').length;
                  return (
                    <tr key={subject.id} className={rowIndex % 2 === 0 ? 'bg-card/30' : 'bg-muted/25'}>
                      <th scope="row" className={`sticky left-0 z-10 border border-border px-2 py-2 text-left font-semibold text-foreground ${rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/80'}`}>
                        <span className="block max-w-[6.4rem] truncate" title={subject.name}>{subject.name}</span>
                      </th>
                      {weekDates.map((date) => {
                        const status = getEntryStatus(date, subject.id);
                        return (
                          <td key={date} className={`border border-border p-0 text-center ${isToday(parseDateKey(date)) ? 'bg-primary/[0.045]' : isSunday(parseDateKey(date)) ? 'bg-[hsl(var(--warning)/0.08)]' : ''}`}>
                            <button type="button" onClick={() => openEntry(date, subject)} className="flex min-h-[2.75rem] w-full items-center justify-center gap-1 px-1 py-2 hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label={`Edit ${subject.name} on ${dateLabel(date, 'EEEE d MMMM')}: ${STATUS_LABEL[status]}`}>
                              {status === 'completed' ? <Check size={15} className="text-success" /> : status === 'in-progress' ? <span className="h-2 w-2 rounded-full bg-primary" /> : <span className="text-muted-foreground/50">–</span>}
                            </button>
                          </td>
                        );
                      })}
                      <td className="border border-border px-2 py-2 text-center font-bold tabular-nums text-foreground">{total}/7</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-border/70 p-3">
            <div className="rounded-lg bg-muted/50 px-2 py-2"><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Completed</p><p className="mt-0.5 font-display text-base font-extrabold text-foreground">{weekDates.reduce((total, date) => total + dayCompletionCount(date), 0)}</p></div>
            <div className="rounded-lg bg-muted/50 px-2 py-2"><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Active days</p><p className="mt-0.5 font-display text-base font-extrabold text-foreground">{new Set(weekDates.filter((date) => activeSubjects.some((subject) => entryIsActive(getStudyEntry(state, date, subject.id)))).map((date) => date)).size}</p></div>
            <div className="rounded-lg bg-muted/50 px-2 py-2"><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Study time</p><p className="mt-0.5 font-display text-base font-extrabold text-foreground">{weekDates.reduce((total, date) => total + activeSubjects.reduce((sum, subject) => sum + (getStudyEntry(state, date, subject.id)?.minutes ?? 0), 0), 0)}<span className="ml-1 text-[10px] font-semibold text-muted-foreground">min</span></p></div>
          </div>
        </section>
      )}

      {activeSubjects.length > 0 && mode === 'month' && (
        <section className="mt-3 rounded-xl border border-border bg-card/45 p-2.5 sm:p-3" aria-label="Monthly calendar">
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAY_SHORT.map((day) => <div key={day} className="py-1 text-center text-[10px] font-extrabold text-muted-foreground">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDates.map((date) => {
              const day = parseDateKey(date);
              const inMonth = isSameMonth(day, monthDate);
              const completed = dayCompletionCount(date);
              const active = activeSubjects.some((subject) => entryIsActive(getStudyEntry(state, date, subject.id)));
              return (
                <button key={date} type="button" onClick={() => openDayDetails(date)} className={renderDateClass(date, inMonth)} aria-label={`${dateLabel(date, 'EEEE d MMMM yyyy')}, ${completed} completed subjects`}>
                  <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold sm:h-7 sm:w-7 ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}`}>{dateLabel(date, 'd')}</span>
                  <span className="mt-1 flex h-2.5 items-center justify-center gap-0.5" aria-hidden="true">
                    {completed > 0 && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
                    {active && completed === 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/70 pt-3">
            <div className="rounded-lg bg-muted/50 px-2 py-2"><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Active days</p><p className="mt-0.5 font-display text-base font-extrabold text-foreground">{new Set(monthDates.filter((date) => isSameMonth(parseDateKey(date), monthDate) && activeSubjects.some((subject) => entryIsActive(getStudyEntry(state, date, subject.id)))).map((date) => date)).size}</p></div>
            <div className="rounded-lg bg-muted/50 px-2 py-2"><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Completed</p><p className="mt-0.5 font-display text-base font-extrabold text-foreground">{monthDates.filter((date) => isSameMonth(parseDateKey(date), monthDate)).reduce((sum, date) => sum + dayCompletionCount(date), 0)}</p></div>
            <div className="rounded-lg bg-muted/50 px-2 py-2"><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Study time</p><p className="mt-0.5 font-display text-base font-extrabold text-foreground">{monthDates.filter((date) => isSameMonth(parseDateKey(date), monthDate)).reduce((sum, date) => sum + activeSubjects.reduce((daySum, subject) => daySum + (getStudyEntry(state, date, subject.id)?.minutes ?? 0), 0), 0)}<span className="ml-1 text-[10px] font-semibold text-muted-foreground">min</span></p></div>
          </div>
        </section>
      )}

      <p className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
        <span>{periodActiveDays} active days · {periodCompleted} completed entries</span>
        <span>{periodDuration} study minutes recorded</span>
      </p>

      {overlay === 'subjects' && (
        <OverlayFrame title="Manage subjects" description="Add columns, keep subjects in order, and archive history without deleting it." onClose={closeOverlay}>
          <form className="flex items-start gap-2" onSubmit={(event) => { event.preventDefault(); addSubject(); }}>
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-semibold text-foreground">New subject</span>
              <input value={newSubjectName} onChange={(event) => { setNewSubjectName(event.target.value); setSubjectError(''); }} maxLength={40} placeholder="e.g. English, History..." className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </label>
            <button type="submit" className="mt-[1.4rem] inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:opacity-90"><Plus size={14} /> Add</button>
          </form>
          {subjectError && <p role="alert" className="mt-2 text-xs text-destructive">{subjectError}</p>}

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Active columns · drag not required</p>
            <div className="space-y-2">
              {activeSubjects.map((subject, index) => (
                <div key={subject.id} className="rounded-xl border border-border/80 bg-background/55 p-2.5">
                  {editingSubjectId === subject.id ? (
                    <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); saveSubjectRename(subject.id); }}>
                      <input autoFocus value={subjectNameDraft} onChange={(event) => { setSubjectNameDraft(event.target.value); setSubjectError(''); }} maxLength={40} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary" aria-label={`Rename ${subject.name}`} />
                      <button type="submit" aria-label="Save subject name" className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Save size={15} /></button>
                      <button type="button" onClick={() => { setEditingSubjectId(null); setSubjectError(''); }} aria-label="Cancel subject rename" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground"><X size={15} /></button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarCheck size={15} /></span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground" title={subject.name}>{subject.name}</span>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button type="button" disabled={index === 0} onClick={() => moveSubject(subject.id, -1)} aria-label={`Move ${subject.name} up`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowUp size={14} /></button>
                        <button type="button" disabled={index === activeSubjects.length - 1} onClick={() => moveSubject(subject.id, 1)} aria-label={`Move ${subject.name} down`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"><ArrowDown size={14} /></button>
                        <button type="button" onClick={() => { setEditingSubjectId(subject.id); setSubjectNameDraft(subject.name); setSubjectError(''); }} aria-label={`Rename ${subject.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={14} /></button>
                        <button type="button" onClick={() => setConfirmArchiveId(subject.id)} aria-label={`Archive ${subject.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Archive size={14} /></button>
                      </div>
                    </div>
                  )}
                  {confirmArchiveId === subject.id && (
                    <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5">
                      <p className="text-xs font-semibold text-foreground">Archive {subject.name}?</p>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">It disappears from active columns, but all saved entries remain attached to this subject and can be restored later.</p>
                      <div className="mt-2 flex justify-end gap-2">
                        <button type="button" onClick={() => setConfirmArchiveId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground">Keep</button>
                        <button type="button" onClick={() => archiveSubject(subject.id)} className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground">Archive subject</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {archivedSubjects.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Archived · history retained</p>
              <div className="space-y-2">
                {archivedSubjects.map((subject) => (
                  <div key={subject.id} className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 p-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{subject.name}</span>
                    <button type="button" onClick={() => restoreSubject(subject.id)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground hover:border-primary/45"><RotateCcw size={13} /> Restore</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 border-t border-border/70 pt-4">
            <p className="font-display text-sm font-bold text-foreground">Reference date range</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">PDF-inspired preset only. Navigation and entries continue outside this range.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="min-w-0"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Start</span><input type="date" value={templateStartDraft} onChange={(event) => { setTemplateStartDraft(event.target.value); setTemplateError(''); }} className="h-10 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-xs text-foreground" /></label>
              <label className="min-w-0"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">End</span><input type="date" value={templateEndDraft} onChange={(event) => { setTemplateEndDraft(event.target.value); setTemplateError(''); }} className="h-10 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-xs text-foreground" /></label>
            </div>
            {templateError && <p role="alert" className="mt-2 text-xs text-destructive">{templateError}</p>}
            <button type="button" onClick={saveTemplateRange} className="mt-2 inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:border-primary/45"><Save size={13} /> Save reference range</button>
            <button type="button" onClick={() => { setTemplateStartDraft(STUDY_TRACKER_TEMPLATE_START); setTemplateEndDraft(STUDY_TRACKER_TEMPLATE_END); setTemplateError(''); }} className="ml-2 mt-2 inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:text-foreground">Reset PDF preset</button>
          </div>
        </OverlayFrame>
      )}

      {overlay === 'entry' && (
        <OverlayFrame title={`Edit ${state.subjects.find((subject) => subject.id === entrySubjectId)?.name ?? 'subject'}`} description={dateLabel(entryDate, 'EEEE, d MMMM yyyy')} onClose={closeEntryEditor} footer={
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={closeEntryEditor} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-foreground">Cancel</button>
            <button type="button" onClick={saveEntry} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"><Save size={15} /> Save entry</button>
          </div>
        }>
          <div>
            <p className="mb-2 text-xs font-semibold text-foreground">Study status</p>
            <div className="grid grid-cols-3 gap-2">
              {(['not-started', 'in-progress', 'completed'] as StudyEntryStatus[]).map((status) => (
                <button key={status} type="button" aria-pressed={entryDraft.status === status} onClick={() => setEntryDraft((current) => ({ ...current, status }))} className={`flex min-h-[4.1rem] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-center text-[10px] font-bold transition-colors ${entryDraft.status === status ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30' : 'border-border bg-background/60 text-muted-foreground hover:border-primary/35'}`}>
                  <StatusGlyph status={status} />{STATUS_LABEL[status]}
                </button>
              ))}
            </div>
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-foreground">Study duration <span className="font-normal text-muted-foreground">(optional minutes)</span></span>
            <input type="number" inputMode="numeric" min={0} max={1440} step={1} value={entryDraft.minutes} onChange={(event) => { setEntryDraft((current) => ({ ...current, minutes: event.target.value })); setEntryError(''); }} placeholder="e.g. 45" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-foreground">Note <span className="font-normal text-muted-foreground">(optional, max 240 characters)</span></span>
            <textarea rows={3} maxLength={240} value={entryDraft.note} onChange={(event) => setEntryDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Pages completed, practice topics..." className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" />
          </label>
          {entryError && <p role="alert" className="mt-3 text-xs text-destructive">{entryError}</p>}
        </OverlayFrame>
      )}

      {overlay === 'day-detail' && (
        <OverlayFrame title="Daily entries" description={dateLabel(dayDetailsDate, 'EEEE, d MMMM yyyy')} onClose={closeOverlay}>
          {activeSubjects.length === 0 ? <p className="text-sm text-muted-foreground">Add or restore a subject to log this day.</p> : (
            <div className="space-y-2">
              {dayEntries(dayDetailsDate).map(({ subject, entry }) => (
                <button key={subject.id} type="button" onClick={() => openEntry(dayDetailsDate, subject, true)} className="flex w-full items-center gap-3 rounded-xl border border-border/80 bg-background/55 p-3 text-left hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><StatusGlyph status={entry?.status ?? 'not-started'} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{subject.name}</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{STATUS_LABEL[entry?.status ?? 'not-started']}{entry?.minutes ? ` · ${entry.minutes} min` : ''}{entry?.note ? ` · ${entry.note}` : ''}</span></span>
                  <Pencil size={15} className="shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </OverlayFrame>
      )}
    </div>
  );
};

export default StudyTracker;
