export type QuizTimerMode = 'off' | 'perQuestion' | 'challenge';

export const CHALLENGE_MINUTES = [1, 2, 3, 4, 5, 10] as const;
export type ChallengeMinutes = (typeof CHALLENGE_MINUTES)[number];

export function getChallengeDurationSeconds(minutes: ChallengeMinutes): number {
  return minutes * 60;
}

/** Derive remaining seconds from a monotonic deadline to avoid interval drift. */
export function getRemainingSeconds(deadline: number, now: number): number {
  if (!Number.isFinite(deadline) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function formatChallengeTime(seconds: number): string {
  const remaining = Math.max(0, Math.ceil(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(remaining / 60);
  const secondsPart = remaining % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')}`;
}

/** A timer toggle selects exactly one mode; switching modes replaces the old one. */
export function getTimerModeFromToggle(
  target: Exclude<QuizTimerMode, 'off'>,
  enabled: boolean,
): QuizTimerMode {
  return enabled ? target : 'off';
}
