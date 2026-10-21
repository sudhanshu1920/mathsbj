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
  it('uses the exact 17-slot 9 AM to 10 PM local-time schedule', () => {
    expect(DAILY_REMINDER_POLICY_VERSION).toBe(3);
    expect(DAILY_REMINDER_MINUTES).toEqual([
      540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1185, 1230, 1260, 1290, 1310, 1320,
    ]);
    expect(getNextDailyReminderMinute(539)).toBe(540);
    expect(getNextDailyReminderMinute(540)).toBe(600);
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

  it('maps delayed delivery to the current urgency stage and rejects times outside 9 AM–10 PM', () => {
    expect(getDailyReminderStageIndex(8 * 60 + 59)).toBeNull();
    expect(getDailyReminderStageIndex(9 * 60)).toBe(0);
    expect(getDailyReminderStageIndex(9 * 60 + 59)).toBe(0);
    expect(getDailyReminderStageIndex(10 * 60)).toBe(1);
    expect(getDailyReminderStageIndex(18 * 60 + 10)).toBe(9);
    expect(getDailyReminderStageIndex(19 * 60 + 50)).toBe(11);
    expect(getDailyReminderStageIndex(21 * 60 + 55)).toBe(15);
    expect(getDailyReminderStageIndex(22 * 60)).toBe(16);
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
      expect(pool.every((message) => !/[a-zA-Z]/.test(message.replace(/%[1-5]\$d/g, '')))).toBe(true);
    }
    for (const pool of HINDI_REMINDER_MESSAGES) {
      expect(pool.length).toBeGreaterThanOrEqual(3);
      expect(new Set(pool).size).toBe(pool.length);
      expect(pool.every((message) => message.includes('%1$d'))).toBe(true);
      expect(pool.every((message) => !/[a-zA-Z]/.test(message.replace(/%[1-5]\$d/g, '')))).toBe(true);
    }
    expect(MARATHI_REMINDER_MESSAGES[15].every((message) => message.includes('%2$d'))).toBe(true);
    expect(HINDI_REMINDER_MESSAGES[15].every((message) => message.includes('%2$d'))).toBe(true);
    expect(MARATHI_REMINDER_MESSAGES[16].every((message) => !message.includes('%2$d'))).toBe(true);
    expect(HINDI_REMINDER_MESSAGES[16].every((message) => !message.includes('%2$d'))).toBe(true);
    for (const pools of [MARATHI_REMINDER_MESSAGES, HINDI_REMINDER_MESSAGES]) {
      for (const pool of pools) {
        expect(pool[0]).not.toContain('%3$d');
        expect(pool[1]).not.toContain('%3$d');
        expect(pool[2]).toContain('%3$d');
        expect(pool[2]).toContain('%4$d');
        expect(pool[2]).toContain('%5$d%%');
      }
    }
  });
});


  it('uses unique, strictly increasing slots and gives the final notification exactly the 10 PM stage', () => {
    expect(DAILY_REMINDER_MINUTES[0]).toBe(9 * 60);
    expect(DAILY_REMINDER_MINUTES.at(-1)).toBe(22 * 60);
    expect(new Set(DAILY_REMINDER_MINUTES).size).toBe(17);
    expect(DAILY_REMINDER_MINUTES.every((minute, index, slots) =>
      minute >= 9 * 60 && minute <= 22 * 60 && (index === 0 || minute > slots[index - 1]),
    )).toBe(true);
    expect(getNextDailyReminderMinute(21 * 60 + 50)).toBe(22 * 60);
    expect(getNextDailyReminderMinute(22 * 60)).toBeNull();
    expect(getDailyReminderStageIndex(22 * 60 + 1)).toBeNull();
  });
