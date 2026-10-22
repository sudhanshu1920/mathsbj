export interface JumpPlatform {
  x: number;
  y: number;
  width: number;
  height: number;
  checkpoint?: boolean;
}

export interface JumpPlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  grounded: boolean;
  checkpointX: number;
  checkpointY: number;
}

export interface JumpPhysicsInput {
  axis: number;
  jump: boolean;
  movementSpeed: number;
  gravity: number;
  jumpImpulse: number;
}

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

/**
 * Advances one bounded simulation step. Landing uses the complete vertical
 * segment (previous bottom -> next bottom), so thin platforms cannot be
 * skipped by a long frame. Jumping is allowed only from the grounded state.
 */
export function stepJumpPlayer(
  player: JumpPlayerState,
  input: JumpPhysicsInput,
  platforms: readonly JumpPlatform[],
  worldWidth: number,
  worldHeight: number,
  deltaSeconds: number,
): JumpPlayerState {
  const dt = clamp(finiteOr(deltaSeconds, 0), 0, 1 / 30);
  const safeWorldWidth = Math.max(player.width, finiteOr(worldWidth, player.width));
  const safeWorldHeight = Math.max(1, finiteOr(worldHeight, 1));
  const axis = clamp(finiteOr(input.axis, 0), -1, 1);
  const movementSpeed = clamp(finiteOr(input.movementSpeed, 0), 0, 2400);
  const gravity = clamp(finiteOr(input.gravity, 0), 0, 10000);
  const jumpImpulse = clamp(finiteOr(input.jumpImpulse, 0), 0, 6000);

  let x = clamp(player.x + axis * movementSpeed * dt, 0, safeWorldWidth - player.width);
  let y = finiteOr(player.y, safeWorldHeight * 0.5);
  let vx = axis * movementSpeed;
  let vy = finiteOr(player.vy, 0);
  let grounded = false;
  let checkpointX = finiteOr(player.checkpointX, x);
  let checkpointY = finiteOr(player.checkpointY, y);

  if (input.jump && player.grounded && jumpImpulse > 0) {
    vy = -jumpImpulse;
  } else {
    vy += gravity * dt;
  }

  const previousBottom = y + player.height;
  y += vy * dt;
  const nextBottom = y + player.height;

  if (vy >= 0) {
    for (const platform of platforms) {
      const values = [platform.x, platform.y, platform.width, platform.height];
      if (!values.every(Number.isFinite) || platform.width <= 0 || platform.height < 0) continue;

      const overlapsHorizontally =
        x + player.width > platform.x &&
        x < platform.x + platform.width;
      const crossedPlatformTop =
        previousBottom <= platform.y + 0.5 &&
        nextBottom >= platform.y;

      if (!overlapsHorizontally || !crossedPlatformTop) continue;

      y = platform.y - player.height;
      vy = 0;
      grounded = true;

      if (platform.checkpoint) {
        checkpointX = clamp(x, platform.x, Math.max(platform.x, platform.x + platform.width - player.width));
        checkpointY = y;
      }
      break;
    }
  }

  if (y > safeWorldHeight + player.height) {
    x = clamp(checkpointX, 0, safeWorldWidth - player.width);
    y = clamp(checkpointY, 0, safeWorldHeight - player.height);
    vx = 0;
    vy = 0;
    grounded = false;
  }

  return {
    x,
    y,
    vx,
    vy,
    width: player.width,
    height: player.height,
    grounded,
    checkpointX,
    checkpointY,
  };
}

export function createJumpPlatforms(width: number, height: number): JumpPlatform[] {
  const w = Math.max(240, finiteOr(width, 360));
  const h = Math.max(320, finiteOr(height, 640));
  const thickness = clamp(h * 0.025, 12, 20);

  return [
    { x: 0, y: h * 0.68, width: w * 0.46, height: thickness, checkpoint: true },
    { x: w * 0.54, y: h * 0.59, width: w * 0.22, height: thickness },
    { x: w * 0.84, y: h * 0.49, width: w * 0.2, height: thickness },
    { x: w * 1.12, y: h * 0.59, width: w * 0.23, height: thickness },
    { x: w * 1.43, y: h * 0.47, width: w * 0.24, height: thickness, checkpoint: true },
    { x: w * 1.76, y: h * 0.57, width: w * 0.22, height: thickness },
    { x: w * 2.07, y: h * 0.47, width: w * 0.24, height: thickness },
    { x: w * 2.4, y: h * 0.59, width: w * 0.24, height: thickness, checkpoint: true },
    { x: w * 2.73, y: h * 0.49, width: w * 0.22, height: thickness },
    { x: w * 3.04, y: h * 0.57, width: w * 0.24, height: thickness },
    { x: w * 3.38, y: h * 0.47, width: w * 0.36, height: thickness, checkpoint: true },
  ];
}

export function clampJumpWorldX(x: number, playerWidth: number, worldWidth: number): number {
  const safeWidth = Math.max(0, finiteOr(playerWidth, 0));
  const safeWorld = Math.max(safeWidth, finiteOr(worldWidth, safeWidth));
  return clamp(finiteOr(x, 0), 0, safeWorld - safeWidth);
}
