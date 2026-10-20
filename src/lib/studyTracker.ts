import {
  addDays,
  addMonths,
  differenceInCalendarDays,
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

export interface StudySubjectSnapshot {
  id: string;
  name: string;
  order: number;
  archived: boolean;
}

export interface StudySubjectHistorySnapshot {
  effectiveDate: string;
  subjects: StudySubjectSnapshot[];
}

export interface StudyTrackerState {
  version: 2;
  subjects: StudySubject[];
  subjectHistory: StudySubjectHistorySnapshot[];
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

const toSubjectSnapshot = (subjects: StudySubject[]): StudySubjectSnapshot[] =>
  [...subjects]
    .sort((left, right) => left.order - right.order)
    .map(({ id, name, order, archived }) => ({ id, name, order, archived }));

function createInitialSubjectHistory(subjects: StudySubject[]): StudySubjectHistorySnapshot[] {
  // Built-in subjects are part of the tracker's original baseline. Custom
  // subjects enter history on their creation date, never before that date.
  const history: StudySubjectHistorySnapshot[] = [{
    effectiveDate: '0001-01-01',
    subjects: toSubjectSnapshot(subjects.filter((subject) => subject.id.startsWith('builtin-'))),
  }];
  const customDates = [...new Set(subjects
    .filter((subject) => !subject.id.startsWith('builtin-'))
    .map((subject) => {
      const created = Date.parse(subject.createdAt);
      return Number.isFinite(created) ? formatDateKey(new Date(created)) : '0001-01-01';
    }))].sort();

  for (const effectiveDate of customDates) {
    history.push({
      effectiveDate,
      subjects: toSubjectSnapshot(subjects.filter((subject) =>
        subject.id.startsWith('builtin-') ||
        (Number.isFinite(Date.parse(subject.createdAt)) &&
          formatDateKey(new Date(Date.parse(subject.createdAt))) <= effectiveDate),
      )),
    });
  }
  return history;
}

function snapshotSubjectsForDate(subjects: StudySubject[], effectiveDate: string): StudySubjectHistorySnapshot {
  return { effectiveDate, subjects: toSubjectSnapshot(subjects) };
}

function recordSubjectConfiguration(
  state: StudyTrackerState,
  subjects: StudySubject[],
  effectiveDate: string,
): StudyTrackerState {
  if (!isDateKey(effectiveDate)) return state;
  const nextHistory = state.subjectHistory.filter((snapshot) => snapshot.effectiveDate !== effectiveDate);
  nextHistory.push(snapshotSubjectsForDate(subjects, effectiveDate));
  nextHistory.sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
  return { ...state, subjects, subjectHistory: nextHistory };
}

function sameSubjectSnapshot(left: StudySubjectSnapshot[], right: StudySubjectSnapshot[]): boolean {
  return JSON.stringify(toSnapshotOrder(left)) === JSON.stringify(toSnapshotOrder(right));
}

function toSnapshotOrder(subjects: StudySubjectSnapshot[]): StudySubjectSnapshot[] {
  return [...subjects].sort((left, right) =>
    left.order - right.order || left.id.localeCompare(right.id),
  );
}

export function createDefaultStudyTrackerState(now = new Date()): StudyTrackerState {
  const timestamp = now.toISOString();
  const subjects = DEFAULT_STUDY_SUBJECTS.map((name, order) => ({
    id: 'builtin-' + name.toLowerCase(),
    name,
    order,
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  return {
    version: 2,
    subjects,
    subjectHistory: createInitialSubjectHistory(subjects),
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

  let subjectHistory: StudySubjectHistorySnapshot[] = [];
  if (Array.isArray(value.subjectHistory)) {
    const snapshotsByDate = new Map<string, StudySubjectHistorySnapshot>();
    value.subjectHistory.forEach((candidate) => {
      if (!isRecord(candidate) || !isDateKey(candidate.effectiveDate) || !Array.isArray(candidate.subjects)) return;
      const snapshotSubjects: StudySubjectSnapshot[] = [];
      const usedIds = new Set<string>();
      candidate.subjects.forEach((item) => {
        if (!isRecord(item) || typeof item.id !== 'string' || !subjectIds.has(item.id) ||
            typeof item.name !== 'string' || usedIds.has(item.id)) return;
        const name = normalizeSubjectName(item.name).slice(0, 40);
        if (!name || !Number.isFinite(item.order)) return;
        usedIds.add(item.id);
        snapshotSubjects.push({
          id: item.id,
          name,
          order: Math.trunc(item.order as number),
          archived: item.archived === true,
        });
      });
      snapshotsByDate.set(candidate.effectiveDate, {
        effectiveDate: candidate.effectiveDate,
        subjects: toSnapshotOrder(snapshotSubjects),
      });
    });
    subjectHistory = [...snapshotsByDate.values()].sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
  }
  if (subjectHistory.length === 0) subjectHistory = createInitialSubjectHistory(subjects);

  const start = isDateKey(preferences.templateStartDate)
    ? preferences.templateStartDate
    : STUDY_TRACKER_TEMPLATE_START;
  const end = isDateKey(preferences.templateEndDate)
    ? preferences.templateEndDate
    : STUDY_TRACKER_TEMPLATE_END;
  const orderedRangeIsValid = start <= end;

  return {
    version: 2,
    subjects: subjects.sort((left, right) => left.order - right.order),
    subjectHistory,
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

function canPersistStudyTrackerChange(
  previous: StudyTrackerState | undefined,
  next: StudyTrackerState,
  today: string,
): boolean {
  const previousEntries = previous?.entries ?? {};
  const entryKeys = new Set([...Object.keys(previousEntries), ...Object.keys(next.entries)]);
  for (const key of entryKeys) {
    const before = previousEntries[key];
    const after = next.entries[key];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const affectedDate = after?.date ?? before?.date;
    if (affectedDate !== today) return false;
  }

  if (previous) {
    const previousHistory = new Map(previous.subjectHistory.map((snapshot) => [snapshot.effectiveDate, snapshot]));
    const nextHistory = new Map(next.subjectHistory.map((snapshot) => [snapshot.effectiveDate, snapshot]));
    const historyDates = new Set([...previousHistory.keys(), ...nextHistory.keys()]);
    for (const date of historyDates) {
      const before = previousHistory.get(date);
      const after = nextHistory.get(date);
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      if (date !== today) return false;
    }
  } else {
    // With no existing storage record there is no historical baseline to
    // authorize imported entries/configurations. A fresh tracker may only
    // initialize today's entries and today's effective-dated change.
    if (Object.values(next.entries).some((entry) => entry.date !== today)) return false;
    if (next.subjectHistory.some((snapshot) =>
      snapshot.effectiveDate !== '0001-01-01' && snapshot.effectiveDate !== today,
    )) return false;
    const initialBaseline = toSnapshotOrder(next.subjectHistory.find(
      (snapshot) => snapshot.effectiveDate === '0001-01-01',
    )?.subjects ?? []);
    const expectedBaseline: StudySubjectSnapshot[] = DEFAULT_STUDY_SUBJECTS.map((name, order) => ({
      id: 'builtin-' + name.toLowerCase(),
      name,
      order,
      archived: false,
    }));
    if (JSON.stringify(initialBaseline) !== JSON.stringify(toSnapshotOrder(expectedBaseline))) return false;
  }

  // A caller must not bypass the effective-dated mutation helpers by changing
  // the live subject array without recording today's corresponding snapshot.
  const effectiveToday = getStudySubjectsForDate(next, today);
  if (!sameSubjectSnapshot(toSubjectSnapshot(next.subjects), toSubjectSnapshot(effectiveToday))) return false;
  return true;
}

export function saveStudyTrackerState(
  state: StudyTrackerState,
  storage = getBrowserStorage(),
  now = new Date(),
): boolean {
  if (!storage) return false;
  try {
    const today = formatDateKey(now);
    let previous: StudyTrackerState | undefined;
    const raw = storage.getItem(STUDY_TRACKER_STORAGE_KEY);
    if (raw) {
      try {
        previous = normalizeStudyTrackerState(JSON.parse(raw), now);
      } catch {
        previous = undefined;
      }
    }

    const normalized = normalizeStudyTrackerState(state, now);
    if (!canPersistStudyTrackerChange(previous, normalized, today)) return false;
    storage.setItem(STUDY_TRACKER_STORAGE_KEY, JSON.stringify(normalized));
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

export function canEditStudyDate(date: string, now = new Date()): boolean {
  return isDateKey(date) && date === formatDateKey(now);
}

export function getStudySubjectsForDate(state: StudyTrackerState, date: string): StudySubject[] {
  if (!isDateKey(date)) return [];
  let matching: StudySubjectHistorySnapshot | undefined;
  for (const snapshot of state.subjectHistory) {
    if (snapshot.effectiveDate > date) break;
    matching = snapshot;
  }
  const versioned = matching?.subjects ?? [];
  return versioned.map((snapshot) => {
    const subject = state.subjects.find((item) => item.id === snapshot.id);
    const timestamp = subject?.createdAt ?? '1970-01-01T00:00:00.000Z';
    return {
      ...snapshot,
      createdAt: timestamp,
      updatedAt: subject?.updatedAt ?? timestamp,
    };
  }).sort((left, right) => left.order - right.order);
}

export function getActiveStudySubjectsForDate(state: StudyTrackerState, date: string): StudySubject[] {
  return getStudySubjectsForDate(state, date).filter((subject) => !subject.archived);
}

/** Subjects available on a date, plus archived subjects whose saved record must remain visible. */
export function getStudySubjectsWithRecordsForDate(state: StudyTrackerState, date: string): StudySubject[] {
  return getStudySubjectsForDate(state, date).filter((subject) =>
    !subject.archived || getStudyEntry(state, date, subject.id) !== undefined,
  );
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
  // endOfWeek is 23:59:59.999; comparing raw milliseconds can round up
  // to an extra day. Calendar-day arithmetic keeps the grid at 4–6 rows.
  const days = differenceInCalendarDays(gridEnd, gridStart) + 1;
  return Array.from({ length: days }, (_, index) => formatDateKey(addDays(gridStart, index)));
}

export function shiftStudyPeriod(anchorDate: string, mode: StudyMode, direction: -1 | 1): string {
  const date = parseDateKey(anchorDate);
  if (mode === 'month') return formatDateKey(addMonths(date, direction));
  return formatDateKey(addDays(date, direction * 7));
}

export interface StudySubjectMutationResult {
  state: StudyTrackerState;
  error?: string;
  subject?: StudySubject;
}

export function addStudySubject(
  state: StudyTrackerState,
  rawName: string,
  now = new Date(),
  id = createStudyId(),
): StudySubjectMutationResult {
  const name = normalizeSubjectName(rawName).slice(0, 40);
  if (!name) return { state, error: 'Enter a subject name.' };
  if (state.subjects.some((subject) => getSubjectNameIdentity(subject.name) === getSubjectNameIdentity(name))) {
    return { state, error: 'A subject with this name already exists.' };
  }

  const timestamp = now.toISOString();
  const subject: StudySubject = {
    id,
    name,
    order: Math.max(-1, ...state.subjects.filter((item) => !item.archived).map((item) => item.order)) + 1,
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const nextState = recordSubjectConfiguration(state, [...state.subjects, subject], formatDateKey(now));
  return { state: nextState, subject };
}

export function renameStudySubject(
  state: StudyTrackerState,
  subjectId: string,
  rawName: string,
  now = new Date(),
): StudySubjectMutationResult {
  const name = normalizeSubjectName(rawName).slice(0, 40);
  if (!name) return { state, error: 'Subject name cannot be empty.' };
  if (!state.subjects.some((subject) => subject.id === subjectId)) {
    return { state, error: 'Subject not found.' };
  }
  if (state.subjects.some((subject) => subject.id !== subjectId && getSubjectNameIdentity(subject.name) === getSubjectNameIdentity(name))) {
    return { state, error: 'A subject with this name already exists.' };
  }

  const today = formatDateKey(now);
  const effectiveSubject = getActiveStudySubjectsForDate(state, today).find((subject) => subject.id === subjectId);
  if (!effectiveSubject) return { state, error: 'Only an active subject in today\'s configuration can be renamed.' };
  const timestamp = now.toISOString();
  const subjects = state.subjects.map((subject) => subject.id === subjectId
    ? { ...subject, name, updatedAt: timestamp }
    : subject);
  return { state: recordSubjectConfiguration(state, subjects, today) };
}

export function reorderStudySubject(
  state: StudyTrackerState,
  subjectId: string,
  direction: -1 | 1,
  now = new Date(),
): StudyTrackerState {
  const current = [...state.subjects]
    .filter((subject) => !subject.archived)
    .sort((left, right) => left.order - right.order);
  const fromIndex = current.findIndex((subject) => subject.id === subjectId);
  const toIndex = fromIndex + direction;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= current.length) return state;

  const reordered = [...current];
  [reordered[fromIndex], reordered[toIndex]] = [reordered[toIndex], reordered[fromIndex]];
  const orderById = new Map(reordered.map((subject, index) => [subject.id, index]));
  const archived = [...state.subjects]
    .filter((subject) => subject.archived)
    .sort((left, right) => left.order - right.order);
  const archivedOrderById = new Map(archived.map((subject, index) => [subject.id, reordered.length + index]));

  const subjects = state.subjects.map((subject) => ({
    ...subject,
    order: orderById.get(subject.id) ?? archivedOrderById.get(subject.id) ?? subject.order,
  }));
  return recordSubjectConfiguration(state, subjects, formatDateKey(now));
}

export function setStudySubjectArchived(
  state: StudyTrackerState,
  subjectId: string,
  archived: boolean,
  now = new Date(),
): StudyTrackerState {
  if (!state.subjects.some((subject) => subject.id === subjectId)) return state;
  const today = formatDateKey(now);
  const currentVersion = getStudySubjectsForDate(state, today).find((subject) => subject.id === subjectId);
  if (!currentVersion || (archived && currentVersion.archived) || (!archived && !currentVersion.archived)) return state;
  const nextActiveOrder = Math.max(
    -1,
    ...state.subjects.filter((subject) => !subject.archived && subject.id !== subjectId).map((subject) => subject.order),
  ) + 1;
  const timestamp = now.toISOString();
  const subjects = state.subjects.map((subject) => subject.id === subjectId
    ? { ...subject, archived, order: archived ? subject.order : nextActiveOrder, updatedAt: timestamp }
    : subject);
  return recordSubjectConfiguration(state, subjects, today);
}

export function upsertStudyEntry(
  state: StudyTrackerState,
  entry: Omit<StudyEntry, 'updatedAt'>,
  now = new Date(),
): StudyTrackerState {
  if (!isDateKey(entry.date) ||
      !canEditStudyDate(entry.date, now) ||
      !getActiveStudySubjectsForDate(state, entry.date).some((subject) => subject.id === entry.subjectId) ||
      !isStudyEntryStatus(entry.status) ||
      !Number.isFinite(entry.minutes) ||
      !Number.isInteger(entry.minutes) ||
      entry.minutes < 0 || entry.minutes > 1440) return state;

  const saved: StudyEntry = {
    ...entry,
    note: entry.note.slice(0, 240),
    updatedAt: now.toISOString(),
  };
  return {
    ...state,
    entries: { ...state.entries, [studyEntryKey(saved.date, saved.subjectId)]: saved },
  };
}

export function cycleStudyMode(mode: StudyMode): StudyMode {
  const index = STUDY_MODES.indexOf(mode);
  return STUDY_MODES[(index + 1) % STUDY_MODES.length];
}
