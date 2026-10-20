import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export const STUDY_TRACKER_STORAGE_KEY = 'math-app-study-tracker-v1';
export const STUDY_TRACKER_TEMPLATE_START = '2026-10-20';
export const STUDY_TRACKER_TEMPLATE_END = '2026-12-31';
export const DEFAULT_STUDY_SUBJECTS = ['Math', 'Reasoning', 'Science', 'Others'] as const;

export type StudyMode = 'table' | 'week' | 'month';
export type StudyEntryStatus = 'not-started' | 'in-progress' | 'completed';

export interface StudySubject {
  id: string;
  name: string;
  order: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudyEntry {
  date: string;
  subjectId: string;
  status: StudyEntryStatus;
  minutes: number;
  note: string;
  updatedAt: string;
}

export interface StudyTrackerState {
  version: 1;
  subjects: StudySubject[];
  entries: Record<string, StudyEntry>;
  preferences: {
    mode: StudyMode;
    anchorDate: string;
    templateStartDate: string;
    templateEndDate: string;
  };
}

export const STUDY_MODES: readonly StudyMode[] = ['table', 'week', 'month'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const isStudyMode = (value: unknown): value is StudyMode =>
  value === 'table' || value === 'week' || value === 'month';

export const isStudyEntryStatus = (value: unknown): value is StudyEntryStatus =>
  value === 'not-started' || value === 'in-progress' || value === 'completed';

export const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

export const isDateKey = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed) && formatDateKey(parsed) === value;
};

export const parseDateKey = (value: string): Date => {
  const parsed = parseISO(value);
  return isValid(parsed) && formatDateKey(parsed) === value
    ? parsed
    : new Date(2026, 9, 20);
};

export const studyEntryKey = (date: string, subjectId: string): string =>
  date + '|' + subjectId;

export const normalizeSubjectName = (name: string): string =>
  name.trim().replace(/\s+/g, ' ');

export const getSubjectNameIdentity = (name: string): string =>
  normalizeSubjectName(name).toLocaleLowerCase();

export const createStudyId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Some older WebViews expose crypto but disable randomUUID.
  }
  return 'study-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
};

export function createDefaultStudyTrackerState(now = new Date()): StudyTrackerState {
  const timestamp = now.toISOString();
  return {
    version: 1,
    subjects: DEFAULT_STUDY_SUBJECTS.map((name, order) => ({
      id: 'builtin-' + name.toLowerCase(),
      name,
      order,
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
    entries: {},
    preferences: {
      mode: 'table',
      anchorDate: formatDateKey(now),
      templateStartDate: STUDY_TRACKER_TEMPLATE_START,
      templateEndDate: STUDY_TRACKER_TEMPLATE_END,
    },
  };
}

function safeTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const time = Date.parse(value);
  return Number.isFinite(time) ? value : fallback;
}

export function normalizeStudyTrackerState(value: unknown, now = new Date()): StudyTrackerState {
  const fallback = createDefaultStudyTrackerState(now);
  if (!isRecord(value)) return fallback;

  const preferences = isRecord(value.preferences) ? value.preferences : {};
  const subjectList: StudySubject[] = [];
  const subjectIds = new Set<string>();

  if (Array.isArray(value.subjects)) {
    value.subjects.forEach((candidate, index) => {
      if (!isRecord(candidate) || typeof candidate.id !== 'string' || !candidate.id.trim()) return;
      if (subjectIds.has(candidate.id)) return;
      if (typeof candidate.name !== 'string') return;
      const name = normalizeSubjectName(candidate.name).slice(0, 40);
      if (!name) return;
      subjectIds.add(candidate.id);
      subjectList.push({
        id: candidate.id,
        name,
        order: Number.isFinite(candidate.order) ? Math.trunc(candidate.order as number) : index,
        archived: candidate.archived === true,
        createdAt: safeTimestamp(candidate.createdAt, fallback.subjects[0].createdAt),
        updatedAt: safeTimestamp(candidate.updatedAt, fallback.subjects[0].updatedAt),
      });
    });
  }

  // Missing or corrupted subject definitions should not strand a new user on
  // an unusable empty tracker. A deliberately archived subject remains stored.
  const subjects = subjectList.length > 0 ? subjectList : fallback.subjects;
  const validSubjectIds = new Set(subjects.map((subject) => subject.id));
  const entries: Record<string, StudyEntry> = {};

  if (isRecord(value.entries)) {
    Object.values(value.entries).forEach((candidate) => {
      if (!isRecord(candidate) || !isDateKey(candidate.date) ||
          typeof candidate.subjectId !== 'string' || !validSubjectIds.has(candidate.subjectId) ||
          !isStudyEntryStatus(candidate.status)) return;

      const rawMinutes = typeof candidate.minutes === 'number' ? candidate.minutes : 0;
      const minutes = Number.isFinite(rawMinutes) ? Math.min(1440, Math.max(0, Math.trunc(rawMinutes))) : 0;
      const note = typeof candidate.note === 'string' ? candidate.note.slice(0, 240) : '';
      const entry: StudyEntry = {
        date: candidate.date,
        subjectId: candidate.subjectId,
        status: candidate.status,
        minutes,
        note,
        updatedAt: safeTimestamp(candidate.updatedAt, fallback.subjects[0].updatedAt),
      };
      entries[studyEntryKey(entry.date, entry.subjectId)] = entry;
    });
  }

  const start = isDateKey(preferences.templateStartDate)
    ? preferences.templateStartDate
    : STUDY_TRACKER_TEMPLATE_START;
  const end = isDateKey(preferences.templateEndDate)
    ? preferences.templateEndDate
    : STUDY_TRACKER_TEMPLATE_END;
  const orderedRangeIsValid = start <= end;

  return {
    version: 1,
    subjects: subjects.sort((left, right) => left.order - right.order),
    entries,
    preferences: {
      mode: isStudyMode(preferences.mode) ? preferences.mode : 'table',
      anchorDate: isDateKey(preferences.anchorDate) ? preferences.anchorDate : fallback.preferences.anchorDate,
      templateStartDate: orderedRangeIsValid ? start : STUDY_TRACKER_TEMPLATE_START,
      templateEndDate: orderedRangeIsValid ? end : STUDY_TRACKER_TEMPLATE_END,
    },
  };
}

function getBrowserStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function loadStudyTrackerState(now = new Date(), storage = getBrowserStorage()): StudyTrackerState {
  if (!storage) return createDefaultStudyTrackerState(now);
  try {
    const raw = storage.getItem(STUDY_TRACKER_STORAGE_KEY);
    if (!raw) return createDefaultStudyTrackerState(now);
    return normalizeStudyTrackerState(JSON.parse(raw), now);
  } catch {
    return createDefaultStudyTrackerState(now);
  }
}

export function saveStudyTrackerState(
  state: StudyTrackerState,
  storage = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STUDY_TRACKER_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Keep the current session interactive if Web Storage is unavailable.
    return false;
  }
}

export function getStudyEntry(
  state: StudyTrackerState,
  date: string,
  subjectId: string,
): StudyEntry | undefined {
  return state.entries[studyEntryKey(date, subjectId)];
}

export function getTableDates(anchorDate: string): string[] {
  const start = parseDateKey(anchorDate);
  return Array.from({ length: 7 }, (_, index) => formatDateKey(addDays(start, index)));
}

export function getWeekDates(anchorDate: string): string[] {
  const date = parseDateKey(anchorDate);
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => formatDateKey(addDays(start, index)));
}

export function getMonthDates(anchorDate: string): string[] {
  const date = parseDateKey(anchorDate);
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86_400_000) + 1;
  return Array.from({ length: days }, (_, index) => formatDateKey(addDays(gridStart, index)));
}

export function shiftStudyPeriod(anchorDate: string, mode: StudyMode, direction: -1 | 1): string {
  const date = parseDateKey(anchorDate);
  if (mode === 'month') return formatDateKey(addMonths(date, direction));
  return formatDateKey(addDays(date, direction * 7));
}

export function cycleStudyMode(mode: StudyMode): StudyMode {
  const index = STUDY_MODES.indexOf(mode);
  return STUDY_MODES[(index + 1) % STUDY_MODES.length];
}
