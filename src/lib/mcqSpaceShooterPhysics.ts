export interface SpacePoint {
  x: number;
  y: number;
}

export interface SpaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpaceProjectileMotion extends SpacePoint {
  vx: number;
  vy: number;
  ageMs: number;
  lifetimeMs: number;
}

export interface SpaceProjectileStep extends SpacePoint {
  ageMs: number;
  expired: boolean;
}

const MAX_SIMULATION_STEP_MS = 50;
const MAX_BOOST_MULTIPLIER = 3;
const BOOST_RESPONSE_TIME_MS = 130;

/** Smooth, elapsed-time boost ramping and release with bounded simulation delta. */
export function advanceSpaceShooterBoost(
  currentMultiplier: number,
  isHeld: boolean,
  maximumMultiplier: number,
  elapsedMs: number,
): number {
  const safeMaximum = Number.isFinite(maximumMultiplier)
    ? Math.min(MAX_BOOST_MULTIPLIER, Math.max(1, maximumMultiplier))
    : 1;
  const current = Number.isFinite(currentMultiplier)
    ? Math.min(MAX_BOOST_MULTIPLIER, Math.max(1, currentMultiplier))
    : 1;
  const elapsed = Number.isFinite(elapsedMs)
    ? Math.min(MAX_SIMULATION_STEP_MS, Math.max(0, elapsedMs))
    : 0;
  const target = isHeld ? safeMaximum : 1;
  const response = 1 - Math.exp(-elapsed / BOOST_RESPONSE_TIME_MS);
  return Math.min(MAX_BOOST_MULTIPLIER, Math.max(1, current + (target - current) * response));
}

export function clampSpaceShipX(x: number, width: number, radius = 24): number {
  if (!Number.isFinite(width) || width <= 0) return 0;
  const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  if (width <= safeRadius * 2) return width / 2;
  const safeX = Number.isFinite(x) ? x : width / 2;
  return Math.min(width - safeRadius, Math.max(safeRadius, safeX));
}

export function getSpaceAimVelocity(
  from: SpacePoint,
  to: SpacePoint,
  speed: number,
): SpacePoint {
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (
    !Number.isFinite(distance) ||
    distance <= Number.EPSILON ||
    !Number.isFinite(dx) ||
    !Number.isFinite(dy)
  ) {
    return { x: 0, y: -safeSpeed };
  }
  return {
    x: (dx / distance) * safeSpeed,
    y: (dy / distance) * safeSpeed,
  };
}

/**
 * Advances a projectile with bounded simulation time so a delayed animation
 * frame cannot teleport it across the playfield.
 */
export function advanceSpaceProjectile(
  projectile: SpaceProjectileMotion,
  elapsedMs: number,
): SpaceProjectileStep {
  const elapsed = Number.isFinite(elapsedMs)
    ? Math.min(MAX_SIMULATION_STEP_MS, Math.max(0, elapsedMs))
    : 0;
  const ageMs = Math.max(0, projectile.ageMs) + elapsed;
  const lifetimeMs = Number.isFinite(projectile.lifetimeMs)
    ? Math.max(0, projectile.lifetimeMs)
    : 0;
  return {
    x: projectile.x + projectile.vx * (elapsed / 1000),
    y: projectile.y + projectile.vy * (elapsed / 1000),
    ageMs,
    expired: ageMs >= lifetimeMs,
  };
}

/**
 * Continuous segment-vs-rectangle collision (Liang–Barsky clipping). Testing
 * the complete movement segment prevents fast lasers tunnelling through a
 * target between rendered frames.
 */
export function sweptSpaceProjectileHitsRect(
  from: SpacePoint,
  to: SpacePoint,
  rect: SpaceRect,
  padding = 0,
): boolean {
  const values = [from.x, from.y, to.x, to.y, rect.x, rect.y, rect.width, rect.height];
  if (!values.every(Number.isFinite) || rect.width < 0 || rect.height < 0) return false;

  const extra = Number.isFinite(padding) ? Math.max(0, padding) : 0;
  const left = rect.x - extra;
  const right = rect.x + rect.width + extra;
  const top = rect.y - extra;
  const bottom = rect.y + rect.height + extra;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let enter = 0;
  let exit = 1;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) <= Number.EPSILON) return q >= 0;
    const ratio = q / p;
    if (p < 0) {
      if (ratio > exit) return false;
      enter = Math.max(enter, ratio);
    } else {
      if (ratio < enter) return false;
      exit = Math.min(exit, ratio);
    }
    return enter <= exit;
  };

  return (
    clip(-dx, from.x - left) &&
    clip(dx, right - from.x) &&
    clip(-dy, from.y - top) &&
    clip(dy, bottom - from.y)
  );
}
