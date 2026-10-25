export interface SpacePoint {
  x: number;
  y: number;
}

export interface SpaceAnswerTargetSize {
  width: number;
  height: number;
}

export interface SpaceAnswerTargetMotion extends SpacePoint {
  vx: number;
  fallSpeed: number;
  width: number;
  height: number;
  turnInMs: number;
  leftBound: number;
  rightBound: number;
}

export interface SpaceAnswerTargetBounds {
  width: number;
  height: number;
  bottom?: number;
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

function getSafeRandom(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0.5;
}

/** Creates one stable answer identity per option, with a shuffled starting lane and top-entry stagger. */
export function createSpaceAnswerTargetMotions(
  width: number,
  height: number,
  sizes: readonly SpaceAnswerTargetSize[],
  random: () => number = Math.random,
): SpaceAnswerTargetMotion[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || sizes.length === 0) {
    return [];
  }

  const count = sizes.length;
  const lanes = Array.from({ length: count }, (_, index) => index);
  for (let index = lanes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(getSafeRandom(random) * (index + 1));
    [lanes[index], lanes[swapIndex]] = [lanes[swapIndex]!, lanes[index]!];
  }

  const laneWidth = width / count;
  return sizes.map((size, index) => {
    const targetWidth = Number.isFinite(size.width) ? Math.max(1, Math.min(width, size.width)) : Math.min(width, 72);
    const targetHeight = Number.isFinite(size.height) ? Math.max(1, Math.min(height, size.height)) : 56;
    const lane = lanes[index]!;
    const halfWidth = Math.min(width / 2, targetWidth / 2);
    let leftBound = lane * laneWidth + halfWidth;
    let rightBound = (lane + 1) * laneWidth - halfWidth;
    if (rightBound < leftBound) {
      leftBound = (lane + 0.5) * laneWidth;
      rightBound = leftBound;
    }
    const direction = getSafeRandom(random) < 0.5 ? -1 : 1;
    const verticalSpacing = Math.max(24, Math.min(targetHeight * 0.8, height * 0.1));
    return {
      x: (leftBound + rightBound) / 2,
      y: -targetHeight / 2 + index * verticalSpacing + getSafeRandom(random) * Math.min(10, targetHeight * 0.15),
      vx: direction * (30 + getSafeRandom(random) * 58),
      fallSpeed: 36 + getSafeRandom(random) * 34,
      width: targetWidth,
      height: targetHeight,
      turnInMs: 500 + getSafeRandom(random) * 1500,
      leftBound,
      rightBound,
    };
  });
}

/** Advances a falling target with bounded frame time, lane-safe horizontal bouncing, and random reversals. */
export function advanceSpaceAnswerTargetMotion(
  target: SpaceAnswerTargetMotion,
  bounds: SpaceAnswerTargetBounds,
  elapsedMs: number,
  random: () => number = Math.random,
): SpaceAnswerTargetMotion {
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) {
    return { ...target };
  }

  const elapsed = Number.isFinite(elapsedMs)
    ? Math.min(MAX_SIMULATION_STEP_MS, Math.max(0, elapsedMs))
    : 0;
  const elapsedSeconds = elapsed / 1000;
  const leftBound = Number.isFinite(target.leftBound) ? Math.max(0, Math.min(bounds.width, target.leftBound)) : 0;
  const rightBound = Number.isFinite(target.rightBound) ? Math.max(leftBound, Math.min(bounds.width, target.rightBound)) : bounds.width;
  const rawNextX = target.x + (Number.isFinite(target.vx) ? target.vx : 0) * elapsedSeconds;
  let x = Math.min(rightBound, Math.max(leftBound, rawNextX));
  let vx = Number.isFinite(target.vx) ? target.vx : 0;
  let y = target.y + (Number.isFinite(target.fallSpeed) ? Math.max(0, target.fallSpeed) : 0) * elapsedSeconds;
  let fallSpeed = Number.isFinite(target.fallSpeed) ? Math.max(0, target.fallSpeed) : 42;
  let turnInMs = Math.max(0, (Number.isFinite(target.turnInMs) ? target.turnInMs : 0) - elapsed);
  const bounced = rawNextX < leftBound || rawNextX > rightBound;

  if (rawNextX < leftBound) vx = Math.abs(vx);
  else if (rawNextX > rightBound) vx = -Math.abs(vx);

  const bottom = Number.isFinite(bounds.bottom)
    ? Math.min(bounds.height, Math.max(0, bounds.bottom as number))
    : bounds.height;
  if (y - target.height / 2 > bottom) {
    y = -target.height / 2 - getSafeRandom(random) * Math.min(36, target.height * 0.8);
    x = leftBound + getSafeRandom(random) * (rightBound - leftBound);
    vx = (getSafeRandom(random) < 0.5 ? -1 : 1) * (30 + getSafeRandom(random) * 58);
    fallSpeed = 36 + getSafeRandom(random) * 34;
    turnInMs = 500 + getSafeRandom(random) * 1500;
  } else if (bounced || turnInMs <= 0) {
    if (!bounced) vx = (vx >= 0 ? -1 : 1) * (30 + getSafeRandom(random) * 58);
    turnInMs = 500 + getSafeRandom(random) * 1500;
  }

  return { ...target, x, y, vx, fallSpeed, turnInMs, leftBound, rightBound };
}

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
