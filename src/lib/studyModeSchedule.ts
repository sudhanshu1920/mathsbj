export interface StudyModeSchedule {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  /** ISO weekday values: Monday = 1 … Sunday = 7. */
  selectedDays: number[];
}

export interface StudyModeConfig extends StudyModeSchedule {
  enabled: boolean;
  selectedPackageNames: string[];
  notificationBlockingEnabled: boolean;
}

export const DEFAULT_STUDY_MODE_CONFIG: StudyModeConfig = {
  enabled: false,
  selectedPackageNames: [],
  startHour: 9,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  selectedDays: [1, 2, 3, 4, 5, 6],
  notificationBlockingEnabled: true,
};

export function normalizeStudyModeDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (day): day is number => Number.isInteger(day) && day >= 1 && day <= 7,
  ))].sort((a, b) => a - b);
}

export function validateStudyModeSchedule(schedule: StudyModeSchedule): string | null {
  const validTime = (hour: number, minute: number) =>
    Number.isInteger(hour) && hour >= 0 && hour <= 23
    && Number.isInteger(minute) && minute >= 0 && minute <= 59;

  if (!validTime(schedule.startHour, schedule.startMinute)
      || !validTime(schedule.endHour, schedule.endMinute)) {
    return "Choose a valid start and end time.";
  }
  if (schedule.startHour === schedule.endHour
      && schedule.startMinute === schedule.endMinute) {
    return "Start time and end time cannot be the same.";
  }
  if (normalizeStudyModeDays(schedule.selectedDays).length === 0) {
    return "Select at least one repeat day.";
  }
  return null;
}

const isoWeekday = (date: Date): number => date.getDay() === 0 ? 7 : date.getDay();

export function isStudyModeScheduledAt(
  date: Date,
  schedule: StudyModeSchedule,
): boolean {
  if (validateStudyModeSchedule(schedule)) return false;

  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  const start = schedule.startHour * 60 + schedule.startMinute;
  const end = schedule.endHour * 60 + schedule.endMinute;
  const today = isoWeekday(date);
  const yesterday = today === 1 ? 7 : today - 1;
  const days = normalizeStudyModeDays(schedule.selectedDays);

  if (start < end) {
    return days.includes(today) && minuteOfDay >= start && minuteOfDay < end;
  }

  // Overnight sessions belong to the day on which they started.
  return (days.includes(today) && minuteOfDay >= start)
    || (days.includes(yesterday) && minuteOfDay < end);
}

export function getNextStudyModeTransition(
  after: Date,
  schedule: StudyModeSchedule,
  horizonDays = 8,
): Date | null {
  if (validateStudyModeSchedule(schedule)) return null;

  const startMinute = schedule.startHour * 60 + schedule.startMinute;
  const endMinute = schedule.endHour * 60 + schedule.endMinute;
  const overnight = endMinute < startMinute;
  const days = normalizeStudyModeDays(schedule.selectedDays);
  let next: Date | null = null;

  for (let offset = -1; offset <= horizonDays; offset += 1) {
    const day = new Date(
      after.getFullYear(),
      after.getMonth(),
      after.getDate() + offset,
      12, 0, 0, 0,
    );
    if (!days.includes(isoWeekday(day))) continue;

    const startAt = new Date(
      day.getFullYear(), day.getMonth(), day.getDate(),
      schedule.startHour, schedule.startMinute, 0, 0,
    );
    const endDay = overnight
      ? new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 12, 0, 0, 0)
      : day;
    const endAt = new Date(
      endDay.getFullYear(), endDay.getMonth(), endDay.getDate(),
      schedule.endHour, schedule.endMinute, 0, 0,
    );

    for (const candidate of [startAt, endAt]) {
      if (candidate.getTime() <= after.getTime()) continue;
      if (!next || candidate.getTime() < next.getTime()) next = candidate;
    }
  }
  return next;
}
