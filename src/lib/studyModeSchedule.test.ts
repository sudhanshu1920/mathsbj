import { describe, expect, it } from "vitest";
import {
  getNextStudyModeTransition,
  isStudyModeScheduledAt,
  validateStudyModeSchedule,
  type StudyModeSchedule,
} from "./studyModeSchedule";

const weekday: StudyModeSchedule = {
  startHour: 9, startMinute: 0, endHour: 18, endMinute: 0,
  selectedDays: [1, 2, 3, 4, 5, 6],
};

describe("Study Mode weekly schedule", () => {
  it("includes the start boundary and excludes the end boundary", () => {
    expect(isStudyModeScheduledAt(new Date(2026, 10, 2, 8, 59), weekday)).toBe(false);
    expect(isStudyModeScheduledAt(new Date(2026, 10, 2, 9, 0), weekday)).toBe(true);
    expect(isStudyModeScheduledAt(new Date(2026, 10, 2, 17, 59), weekday)).toBe(true);
    expect(isStudyModeScheduledAt(new Date(2026, 10, 2, 18, 0), weekday)).toBe(false);
  });

  it("does not activate on an unselected start day", () => {
    expect(isStudyModeScheduledAt(new Date(2026, 10, 1, 10, 0), weekday)).toBe(false);
  });

  it("keeps a Friday overnight session active on Saturday morning", () => {
    const overnight: StudyModeSchedule = {
      startHour: 21, startMinute: 0, endHour: 6, endMinute: 0,
      selectedDays: [5],
    };
    expect(isStudyModeScheduledAt(new Date(2026, 10, 6, 20, 59), overnight)).toBe(false);
    expect(isStudyModeScheduledAt(new Date(2026, 10, 6, 21, 0), overnight)).toBe(true);
    expect(isStudyModeScheduledAt(new Date(2026, 10, 7, 5, 59), overnight)).toBe(true);
    expect(isStudyModeScheduledAt(new Date(2026, 10, 7, 6, 0), overnight)).toBe(false);
    expect(isStudyModeScheduledAt(new Date(2026, 10, 8, 5, 0), overnight)).toBe(false);
  });

  it("rejects equal times, invalid times, and empty days", () => {
    expect(validateStudyModeSchedule({ ...weekday, endHour: 9 })).toMatch(/cannot be the same/);
    expect(validateStudyModeSchedule({ ...weekday, startHour: 24 })).toMatch(/valid/);
    expect(validateStudyModeSchedule({ ...weekday, selectedDays: [] })).toMatch(/at least one/);
  });

  it("returns the next future boundary and advances after an exact boundary", () => {
    const beforeStart = new Date(2026, 10, 2, 8, 30);
    expect(getNextStudyModeTransition(beforeStart, weekday)?.getTime())
      .toBe(new Date(2026, 10, 2, 9, 0).getTime());
    const atStart = new Date(2026, 10, 2, 9, 0);
    expect(getNextStudyModeTransition(atStart, weekday)?.getTime())
      .toBe(new Date(2026, 10, 2, 18, 0).getTime());
  });

  it("handles year and month boundaries using local calendar dates", () => {
    const schedule: StudyModeSchedule = {
      startHour: 23, startMinute: 0, endHour: 1, endMinute: 0,
      selectedDays: [4],
    };
    const after = new Date(2026, 11, 31, 22, 0);
    expect(getNextStudyModeTransition(after, schedule)?.getTime())
      .toBe(new Date(2026, 11, 31, 23, 0).getTime());
  });
});
