export type MCQGameAnswerValue = string | number;

export interface MCQGateMapping {
  questionId: string;
  optionId: string;
  laneId: string;
  gateId: string;
  laneIndex: number;
  optionValue: MCQGameAnswerValue;
}

export const MCQ_GAME_LANE_X = [-3.45, -1.15, 1.15, 3.45] as const;
export const MCQ_GAME_CAR_CENTER_Z = 2;
export const MCQ_GAME_CAR_HALF_WIDTH = 0.47;
export const MCQ_GAME_COLLISION_Z = 0.75;
export const MCQ_GAME_GATE_START_Z = -9.0;
// A gate stays slightly beyond the contact plane before the next wave respawns.
export const MCQ_GAME_GATE_CLEARANCE_Z = 0.45;
export const MCQ_GAME_GATE_HALF_WIDTH = 0.6;
export const MCQ_GAME_TRAVEL_DISTANCE = MCQ_GAME_COLLISION_Z - MCQ_GAME_GATE_START_Z;
export const MCQ_GAME_DEFAULT_GATE_TRAVEL_DURATION_MS = 10_000;
// Allows at most one short rendering-scheduler boundary when collision and timer expiry coincide.
export const MCQ_GAME_COLLISION_DEADLINE_TOLERANCE_MS = 50;

/** Uses the selected per-question timer when valid; an absent/disabled timer gets the 10s default. */
export function resolveMCQGameGateTravelDurationMs(durationMs: number | null | undefined): number {
  return typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0
    ? durationMs
    : MCQ_GAME_DEFAULT_GATE_TRAVEL_DURATION_MS;
}

/** Keeps a contact at the quiz deadline ahead of a timeout callback from a neighboring frame. */
export function isMCQGameCollisionWithinDeadline(contactTimestampMs: number, deadlineMs: number): boolean {
  return Number.isFinite(contactTimestampMs) &&
    Number.isFinite(deadlineMs) &&
    contactTimestampMs <= deadlineMs + MCQ_GAME_COLLISION_DEADLINE_TOLERANCE_MS;
}
export const MCQ_GAME_HOLD_THRESHOLD_MS = 180;
export const MCQ_GAME_BASE_SPEED_MULTIPLIER = 1;
export const MCQ_GAME_MAX_SPEED_MULTIPLIER = 3.25;
export const MCQ_GAME_ACCELERATION_RATE_PER_SECOND = 1.1;
export const MCQ_GAME_DECELERATION_RATE_PER_SECOND = 2.0;
export const MCQ_GAME_GESTURE_MOVE_TOLERANCE_PX = 18;
export const MCQ_GAME_ROAD_SCROLL_UNITS_PER_MS = 0.0045;

export interface SteeringGestureResult {
  kind: "tap" | "boost";
  direction: -1 | 1;
}

/** Classifies one completed press deterministically; no lane movement happens on pointer-down. */
export function classifySteeringGesture(
  durationMs: number,
  direction: -1 | 1,
  holdThresholdMs = MCQ_GAME_HOLD_THRESHOLD_MS,
): SteeringGestureResult {
  const safeDuration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const safeThreshold = Number.isFinite(holdThresholdMs) ? Math.max(0, holdThresholdMs) : MCQ_GAME_HOLD_THRESHOLD_MS;
  return safeDuration >= safeThreshold
    ? { kind: "boost", direction }
    : { kind: "tap", direction };
}

/** Constrains the target lane before it reaches the animation/physics loop. */
export function clampMCQGameLane(laneIndex: number, direction: -1 | 1): number {
  const safeLane = Number.isFinite(laneIndex) ? Math.trunc(laneIndex) : 1;
  return Math.min(3, Math.max(0, safeLane + direction));
}

/**
 * Advances forward speed using elapsed simulation time, never frame count.
 * Acceleration compounds exponentially while held; release eases back toward
 * cruising speed. The bounded timestep prevents a resumed tab from tunnelling.
 */
export function advanceMCQGameSpeed(
  currentSpeed: number,
  deltaMs: number,
  accelerating: boolean,
): number {
  const safeSpeed = Number.isFinite(currentSpeed)
    ? Math.min(MCQ_GAME_MAX_SPEED_MULTIPLIER, Math.max(MCQ_GAME_BASE_SPEED_MULTIPLIER, currentSpeed))
    : MCQ_GAME_BASE_SPEED_MULTIPLIER;
  const safeDeltaMs = Number.isFinite(deltaMs) ? Math.min(100, Math.max(0, deltaMs)) : 0;
  if (safeDeltaMs === 0) return safeSpeed;

  const elapsedSeconds = safeDeltaMs / 1000;
  if (accelerating) {
    return Math.min(
      MCQ_GAME_MAX_SPEED_MULTIPLIER,
      safeSpeed * Math.exp(MCQ_GAME_ACCELERATION_RATE_PER_SECOND * elapsedSeconds),
    );
  }

  return Math.max(
    MCQ_GAME_BASE_SPEED_MULTIPLIER,
    MCQ_GAME_BASE_SPEED_MULTIPLIER
      + (safeSpeed - MCQ_GAME_BASE_SPEED_MULTIPLIER)
      * Math.exp(-MCQ_GAME_DECELERATION_RATE_PER_SECOND * elapsedSeconds),
  );
}

/**
 * Builds stable, explicit question -> option -> lane -> gate identities.
 * The lane index is only a presentation mapping; answer correctness remains
 * entirely owned by the existing quiz engine.
 */
export function createMCQGateMappings(
  questionKey: string | number,
  options: readonly MCQGameAnswerValue[],
): MCQGateMapping[] {
  const questionId = String(questionKey);
  return options.slice(0, 4).map((optionValue, laneIndex) => {
    const optionId = "option-" + String(laneIndex + 1) + "-" + encodeURIComponent(String(optionValue));
    const laneId = "lane-" + String(laneIndex + 1);
    const gateId = "question-" + encodeURIComponent(questionId) + "-" + laneId + "-" + optionId;
    return { questionId, optionId, laneId, gateId, laneIndex, optionValue };
  });
}

/**
 * Returns the first contact fraction when the car's lateral sweep ENTERS a
 * fixed viewport-anchored lane gate. Existing overlap at frame start is not a
 * new contact; that prevents the starting lane from being submitted merely
 * because the first animation frame ran. The entire movement segment is
 * tested, so a fast lateral movement cannot tunnel through a gate hit zone.
 */
export interface SweptLaneGateContactInput {
  previousCarX: number;
  carX: number;
  gateX: number;
  carHalfWidth: number;
  gateHalfWidth: number;
}

export function getSweptLaneGateContactFraction(input: SweptLaneGateContactInput): number | null {
  const values = [
    input.previousCarX, input.carX, input.gateX,
    input.carHalfWidth, input.gateHalfWidth,
  ];
  if (!values.every(Number.isFinite)) return null;

  const movement = input.carX - input.previousCarX;
  if (Math.abs(movement) <= Number.EPSILON) return null;

  const contactHalfWidth = Math.max(0, input.carHalfWidth) + Math.max(0, input.gateHalfWidth);
  const previousDistance = input.previousCarX - input.gateX;
  if (Math.abs(previousDistance) <= contactHalfWidth) return null;

  // Use the entering edge, not the frame's end position, to identify contact.
  const enteringEdge = movement > 0
    ? input.gateX - contactHalfWidth
    : input.gateX + contactHalfWidth;
  const crossedEntry = movement > 0
    ? input.previousCarX < enteringEdge && input.carX >= enteringEdge
    : input.previousCarX > enteringEdge && input.carX <= enteringEdge;
  if (!crossedEntry) return null;

  const fraction = (enteringEdge - input.previousCarX) / movement;
  return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : null;
}

export interface SweptGateCollisionInput {
  previousGateZ: number;
  gateZ: number;
  collisionZ: number;
  previousCarX: number;
  carX: number;
  gateX: number;
  carHalfWidth: number;
  gateHalfWidth: number;
}

/**
 * Swept AABB test for a gate crossing the player's front collision plane.
 * Checking the entire previous/current frame segment prevents fast gates
 * tunnelling through the car between rendered frames.
 */
export function detectSweptGateCollision(input: SweptGateCollisionInput): boolean {
  const values = [
    input.previousGateZ,
    input.gateZ,
    input.collisionZ,
    input.previousCarX,
    input.carX,
    input.gateX,
    input.carHalfWidth,
    input.gateHalfWidth,
  ];
  if (!values.every(Number.isFinite)) return false;
  if (input.gateZ <= input.previousGateZ) return false;
  if (!(input.previousGateZ < input.collisionZ && input.gateZ >= input.collisionZ)) return false;

  const distance = input.gateZ - input.previousGateZ;
  if (distance <= 0) return false;
  const crossingFraction = Math.min(1, Math.max(0, (input.collisionZ - input.previousGateZ) / distance));
  const crossingCarX = input.previousCarX + (input.carX - input.previousCarX) * crossingFraction;
  const overlapHalfWidth = Math.max(0, input.carHalfWidth) + Math.max(0, input.gateHalfWidth);
  return Math.abs(crossingCarX - input.gateX) <= overlapHalfWidth;
}
