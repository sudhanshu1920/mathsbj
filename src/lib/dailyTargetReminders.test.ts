import {
  DAILY_REMINDER_MINUTES,
  DAILY_REMINDER_POLICY_VERSION,
  HINDI_REMINDER_MESSAGES,
  MARATHI_REMINDER_MESSAGES,
  getDailyReminderStageIndex,
  getNextDailyReminderMinute,
  getRemainingTargetMinutes,
  isDailyTargetComplete,
} from './dailyTargetReminders';

describe('smart daily target reminder policy', () => {
  it('uses the expected eleven increasing local-time reminder stages', () => {
    expect(DAILY_REMINDER_POLICY_VERSION).toBe(2);
    expect(DAILY_REMINDER_MINUTES).toEqual([
      720, 840, 960, 1080, 1140, 1185, 1230, 1260, 1290, 1310, 1320,
    ]);
    expect(getNextDailyReminderMinute(719)).toBe(720);
    expect(getNextDailyReminderMinute(720)).toBe(840);
    expect(getNextDailyReminderMinute(18 * 60)).toBe(19 * 60);
    expect(getNextDailyReminderMinute(19 * 60)).toBe(19 * 60 + 45);
    expect(getNextDailyReminderMinute(19 * 60 + 45)).toBe(20 * 60 + 30);
    expect(getNextDailyReminderMinute(20 * 60 + 30)).toBe(21 * 60);
    expect(getNextDailyReminderMinute(21 * 60)).toBe(21 * 60 + 30);
    expect(getNextDailyReminderMinute(21 * 60 + 30)).toBe(21 * 60 + 50);
    expect(getNextDailyReminderMinute(21 * 60 + 50)).toBe(22 * 60);
    expect(getNextDailyReminderMinute(22 * 60)).toBeNull();
    expect(getNextDailyReminderMinute(23 * 60)).toBeNull();
  });

  it('maps delayed delivery to the current urgency stage and rejects times outside noon–10 PM', () => {
    expect(getDailyReminderStageIndex(11 * 60 + 59)).toBeNull();
    expect(getDailyReminderStageIndex(12 * 60)).toBe(0);
    expect(getDailyReminderStageIndex(13 * 60 + 59)).toBe(0);
    expect(getDailyReminderStageIndex(14 * 60)).toBe(1);
    expect(getDailyReminderStageIndex(18 * 60 + 10)).toBe(3);
    expect(getDailyReminderStageIndex(19 * 60 + 50)).toBe(5);
    expect(getDailyReminderStageIndex(21 * 60 + 55)).toBe(9);
    expect(getDailyReminderStageIndex(22 * 60)).toBe(10);
    expect(getDailyReminderStageIndex(22 * 60 + 1)).toBeNull();
    expect(getDailyReminderStageIndex(Number.NaN)).toBeNull();
  });

  it('recomputes completion when the user changes the target', () => {
    expect(isDailyTargetComplete(20, 19 * 60)).toBe(false);
    expect(isDailyTargetComplete(20, 20 * 60)).toBe(true);
    // A previously persisted completed flag must not override a newly increased target.
    expect(isDailyTargetComplete(30, 20 * 60)).toBe(false);
    // Lowering the target uses the actual accumulated study time immediately.
    expect(isDailyTargetComplete(10, 20 * 60)).toBe(true);
    expect(isDailyTargetComplete(0, 0)).toBe(false);
  });

  it('calculates remaining study-target minutes from the existing streak time state', () => {
    expect(getRemainingTargetMinutes(20, 0)).toBe(20);
    expect(getRemainingTargetMinutes(20, 5 * 60)).toBe(15);
    expect(getRemainingTargetMinutes(20, 12 * 60)).toBe(8);
    expect(getRemainingTargetMinutes(20, 12 * 60 + 1)).toBe(8);
    expect(getRemainingTargetMinutes(20, 19 * 60)).toBe(1);
    expect(getRemainingTargetMinutes(20, 20 * 60)).toBe(0);
    expect(getRemainingTargetMinutes(0, -4)).toBe(1);
  });

  it('has one Marathi and Hindi message pool per stage and never mixes languages within a pool', () => {
    expect(MARATHI_REMINDER_MESSAGES).toHaveLength(DAILY_REMINDER_MINUTES.length);
    expect(HINDI_REMINDER_MESSAGES).toHaveLength(DAILY_REMINDER_MINUTES.length);
    for (const pool of MARATHI_REMINDER_MESSAGES) {
      expect(pool.length).toBeGreaterThanOrEqual(3);
      expect(new Set(pool).size).toBe(pool.length);
      expect(pool.every((message) => message.includes('%1$d'))).toBe(true);
      expect(pool.every((message) => !/[a-zA-Z]/.test(message.replace('%1$d', '').replace('%2$d', '')))).toBe(true);
    }
    for (const pool of HINDI_REMINDER_MESSAGES) {
      expect(pool.length).toBeGreaterThanOrEqual(3);
      expect(new Set(pool).size).toBe(pool.length);
      expect(pool.every((message) => message.includes('%1$d'))).toBe(true);
      expect(pool.every((message) => !/[a-zA-Z]/.test(message.replace('%1$d', '').replace('%2$d', '')))).toBe(true);
    }
    expect(MARATHI_REMINDER_MESSAGES[9].every((message) => message.includes('%2$d'))).toBe(true);
    expect(HINDI_REMINDER_MESSAGES[9].every((message) => message.includes('%2$d'))).toBe(true);
    expect(MARATHI_REMINDER_MESSAGES[10].every((message) => !message.includes('%2$d'))).toBe(true);
    expect(HINDI_REMINDER_MESSAGES[10].every((message) => !message.includes('%2$d'))).toBe(true);
  });
});
