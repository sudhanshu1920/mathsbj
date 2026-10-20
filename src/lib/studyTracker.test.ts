import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_STUDY_SUBJECTS,
  STUDY_TRACKER_TEMPLATE_END,
  STUDY_TRACKER_TEMPLATE_START,
  STUDY_TRACKER_STORAGE_KEY,
  addStudySubject,
  createDefaultStudyTrackerState,
  cycleStudyMode,
  getMonthDates,
  getStudyEntry,
  getTableDates,
  getWeekDates,
  normalizeStudyTrackerState,
  reorderStudySubject,
  renameStudySubject,
  saveStudyTrackerState,
  loadStudyTrackerState,
  setStudySubjectArchived,
  shiftStudyPeriod,
  studyEntryKey,
  upsertStudyEntry,
} from '@/lib/studyTracker';

afterEach(() => {
  localStorage.clear();
});

const fixedNow = () => new Date(2026, 9, 20, 12, 0, 0);
const defaults = () => createDefaultStudyTrackerState(fixedNow());

describe('Study Tracker calendar rules', () => {
  it('starts with the PDF-inspired subjects and a customizable template period', () => {
    const state = defaults();
    expect(state.subjects.filter((subject) => !subject.archived).map((subject) => subject.name)).toEqual([...DEFAULT_STUDY_SUBJECTS]);
    expect(state.preferences.mode).toBe('table');
    expect(state.preferences.anchorDate).toBe('2026-10-20');
    expect(state.preferences.templateStartDate).toBe(STUDY_TRACKER_TEMPLATE_START);
    expect(state.preferences.templateEndDate).toBe(STUDY_TRACKER_TEMPLATE_END);
  });

  it('returns exactly seven consecutive table dates starting at the selected date', () => {
    const dates = getTableDates('2026-10-20');
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('2026-10-20');
    expect(dates[6]).toBe('2026-10-26');
    expect(getTableDates('2026-12-29')).toEqual([
      '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01',
      '2027-01-02', '2027-01-03', '2027-01-04',
    ]);
  });

  it('uses Monday through Sunday for weekly overviews', () => {
    expect(getWeekDates('2026-10-20')).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
      '2026-10-23', '2026-10-24', '2026-10-25',
    ]);
    expect(getWeekDates('2027-01-01')).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
      '2027-01-01', '2027-01-02', '2027-01-03',
    ]);
  });

  it('builds Monday-aligned month grids with correct leap-year lengths', () => {
    const leap = getMonthDates('2024-02-10');
    const regular = getMonthDates('2023-02-10');
    expect(leap[0]).toBe('2024-01-29');
    expect(leap[leap.length - 1]).toBe('2024-03-03');
    expect(leap.filter((date) => date.startsWith('2024-02-'))).toHaveLength(29);
    expect(regular.filter((date) => date.startsWith('2023-02-'))).toHaveLength(28);
  });

  it('cycles modes exactly Table → Week → Month → Table', () => {
    expect(cycleStudyMode('table')).toBe('week');
    expect(cycleStudyMode('week')).toBe('month');
    expect(cycleStudyMode('month')).toBe('table');
  });

  it('moves exactly one period through month and year boundaries', () => {
    expect(shiftStudyPeriod('2026-12-29', 'table', 1)).toBe('2027-01-05');
    expect(shiftStudyPeriod('2026-12-30', 'week', 1)).toBe('2027-01-06');
    expect(shiftStudyPeriod('2024-01-31', 'month', 1)).toBe('2024-02-29');
    expect(shiftStudyPeriod('2026-01-01', 'month', -1)).toBe('2025-12-01');
  });
});

describe('Study Tracker subject and entry identity', () => {
  it('normalizes names and prevents blank or case-insensitive duplicate subjects', () => {
    const state = defaults();
    const added = addStudySubject(state, '  Current   Affairs ', fixedNow(), 'custom-current-affairs');
    expect(added.error).toBeUndefined();
    expect(added.subject?.name).toBe('Current Affairs');

    const duplicate = addStudySubject(added.state, ' current affairs ', fixedNow(), 'duplicate-id');
    expect(duplicate.error).toMatch(/already exists/i);
    const empty = addStudySubject(added.state, '   ', fixedNow(), 'empty-id');
    expect(empty.error).toMatch(/enter a subject/i);
    expect(added.state.subjects).toHaveLength(state.subjects.length + 1);
  });

  it('keeps entries linked to stable subject IDs across rename, reorder, archive and restore', () => {
    const initial = defaults();
    const math = initial.subjects.find((subject) => subject.id === 'builtin-math')!;
    let state = upsertStudyEntry(initial, {
      date: '2026-10-20',
      subjectId: math.id,
      status: 'completed',
      minutes: 35,
      note: 'Fractions',
    }, fixedNow());

    const renamed = renameStudySubject(state, math.id, 'Mathematics', fixedNow());
    expect(renamed.error).toBeUndefined();
    state = renamed.state;
    expect(state.subjects.find((subject) => subject.id === math.id)?.name).toBe('Mathematics');
    expect(getStudyEntry(state, '2026-10-20', math.id)?.note).toBe('Fractions');

    state = reorderStudySubject(state, math.id, 1);
    expect(state.subjects.find((subject) => subject.id === math.id)?.order).toBe(1);
    expect(state.entries[studyEntryKey('2026-10-20', math.id)]?.status).toBe('completed');

    state = setStudySubjectArchived(state, math.id, true, fixedNow());
    expect(state.subjects.find((subject) => subject.id === math.id)?.archived).toBe(true);
    expect(getStudyEntry(state, '2026-10-20', math.id)?.minutes).toBe(35);

    state = setStudySubjectArchived(state, math.id, false, fixedNow());
    expect(state.subjects.find((subject) => subject.id === math.id)?.archived).toBe(false);
    expect(getStudyEntry(state, '2026-10-20', math.id)?.status).toBe('completed');
  });

  it('upserts a single date/subject record and rejects invalid minutes without replacing it', () => {
    const initial = defaults();
    const subjectId = initial.subjects[0].id;
    const saved = upsertStudyEntry(initial, {
      date: '2026-10-20',
      subjectId,
      status: 'in-progress',
      minutes: 20,
      note: '',
    }, fixedNow());
    const unchanged = upsertStudyEntry(saved, {
      date: '2026-10-20',
      subjectId,
      status: 'completed',
      minutes: 1441,
      note: '',
    }, fixedNow());

    expect(Object.keys(saved.entries)).toHaveLength(1);
    expect(unchanged).toBe(saved);
    expect(getStudyEntry(saved, '2026-10-20', subjectId)?.status).toBe('in-progress');
    expect(getStudyEntry(initial, '2026-10-20', subjectId)).toBeUndefined();
  });

  it('preserves valid offline data across app reloads', () => {
    const state = upsertStudyEntry(defaults(), {
      date: '2026-10-20',
      subjectId: 'builtin-math',
      status: 'completed',
      minutes: 50,
      note: 'Chapter 1',
    }, fixedNow());

    expect(saveStudyTrackerState(state)).toBe(true);
    expect(localStorage.getItem(STUDY_TRACKER_STORAGE_KEY)).not.toBeNull();
    const restored = loadStudyTrackerState(fixedNow());
    expect(restored.preferences.mode).toBe('table');
    expect(getStudyEntry(restored, '2026-10-20', 'builtin-math')).toMatchObject({
      status: 'completed',
      minutes: 50,
      note: 'Chapter 1',
    });
  });

  it('safely falls back when saved preferences or tracker data are malformed', () => {
    const state = normalizeStudyTrackerState({
      version: 99,
      subjects: [{ id: 'bad', name: '  ', order: 0 }],
      entries: { invalid: { date: 'not-a-date', status: 'complete', minutes: -1 } },
      preferences: { mode: 'year', anchorDate: 'invalid', templateStartDate: '2027-01-01', templateEndDate: '2026-01-01' },
    }, fixedNow());

    expect(state.version).toBe(1);
    expect(state.preferences.mode).toBe('table');
    expect(state.preferences.anchorDate).toBe('2026-10-20');
    expect(state.preferences.templateStartDate).toBe(STUDY_TRACKER_TEMPLATE_START);
    expect(Object.keys(state.entries)).toHaveLength(0);
    expect(state.subjects.map((subject) => subject.name)).toEqual([...DEFAULT_STUDY_SUBJECTS]);
  });
});
