const KEY = 'math-app-xp-v1';

export interface XPState {
  xp: number; // total lifetime XP
  lastLevel: number; // last level we've shown so we can detect level-ups
}

// Linear-ish curve: each level = 100 XP
export const XP_PER_LEVEL = 100;
export const XP_CORRECT = 10;
export const XP_STREAK_BONUS = 5; // extra every 5 in a row
export const XP_MILESTONE = 20; // extra every 10 in a row

const defaults = (): XPState => ({ xp: 0, lastLevel: 1 });

export const getXP = (): XPState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return { ...defaults(), ...JSON.parse(raw) };
  } catch { return defaults(); }
};

const save = (s: XPState) => {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('xp-updated'));
};

export const levelFromXP = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1;
export const xpInLevel = (xp: number) => xp % XP_PER_LEVEL;
export const xpProgressPct = (xp: number) => (xpInLevel(xp) / XP_PER_LEVEL) * 100;

export interface XPGain {
  base: number;
  bonus: number;
  total: number;
  newXP: number;
  newLevel: number;
  leveledUp: boolean;
}

/** Award XP for a correct answer. comboCount is the new consecutive correct count (>=1). */
export const awardCorrectXP = (comboCount: number): XPGain => {
  const s = getXP();
  let bonus = 0;
  if (comboCount > 0 && comboCount % 10 === 0) bonus += XP_MILESTONE;
  else if (comboCount > 0 && comboCount % 5 === 0) bonus += XP_STREAK_BONUS;
  const total = XP_CORRECT + bonus;
  const newXP = s.xp + total;
  const newLevel = levelFromXP(newXP);
  const leveledUp = newLevel > s.lastLevel;
  s.xp = newXP;
  s.lastLevel = newLevel;
  save(s);
  return { base: XP_CORRECT, bonus, total, newXP, newLevel, leveledUp };
};

export const acknowledgeLevel = () => {
  const s = getXP();
  s.lastLevel = levelFromXP(s.xp);
  save(s);
};
