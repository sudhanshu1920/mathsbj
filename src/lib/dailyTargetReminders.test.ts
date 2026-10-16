import {
  DAILY_REMINDER_MINUTES,
  HINDI_REMINDER_MESSAGES,
  MARATHI_REMINDER_MESSAGES,
  getNextDailyReminderMinute,
  getRemainingTargetMinutes,
} from './dailyTargetReminders';

describe('daily target reminder rules', () => {
  it('uses the six configured local-time reminder slots from noon to 10 PM', () => {
    expect(DAILY_REMINDER_MINUTES).toEqual([720, 840, 960, 1080, 1200, 1320]);
    expect(getNextDailyReminderMinute(719)).toBe(720);
    expect(getNextDailyReminderMinute(720)).toBe(840);
    expect(getNextDailyReminderMinute(21 * 60 + 59)).toBe(1320);
    expect(getNextDailyReminderMinute(22 * 60)).toBeNull();
    expect(getNextDailyReminderMinute(23 * 60)).toBeNull();
  });

  it('calculates remaining target minutes from the existing streak time state', () => {
    expect(getRemainingTargetMinutes(20, 0)).toBe(20);
    expect(getRemainingTargetMinutes(20, 12 * 60)).toBe(8);
    expect(getRemainingTargetMinutes(20, 12 * 60 + 1)).toBe(8);
    expect(getRemainingTargetMinutes(20, 19 * 60)).toBe(1);
    expect(getRemainingTargetMinutes(20, 20 * 60)).toBe(0);
    expect(getRemainingTargetMinutes(0, -4)).toBe(1);
  });

  it('has enough single-language message variety for both supported languages', () => {
    expect(MARATHI_REMINDER_MESSAGES.length).toBeGreaterThanOrEqual(10);
    expect(HINDI_REMINDER_MESSAGES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(MARATHI_REMINDER_MESSAGES).size).toBe(MARATHI_REMINDER_MESSAGES.length);
    expect(new Set(HINDI_REMINDER_MESSAGES).size).toBe(HINDI_REMINDER_MESSAGES.length);
    expect([...MARATHI_REMINDER_MESSAGES, ...HINDI_REMINDER_MESSAGES].every((message) => message.includes('%d'))).toBe(true);
    expect(MARATHI_REMINDER_MESSAGES.some((message) => message.includes('बाकी'))).toBe(true);
    expect(HINDI_REMINDER_MESSAGES.some((message) => message.includes('बाकी'))).toBe(true);
  });
});
