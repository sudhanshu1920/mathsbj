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
export const MCQ_GAME_GATE_HALF_WIDTH = 0.6;
export const MCQ_GAME_TRAVEL_DISTANCE = MCQ_GAME_COLLISION_Z - MCQ_GAME_GATE_START_Z;

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
