export type MCQSteeringDirection = -1 | 1;

export interface MCQSteeringPointer {
  pointerId: number;
  /** Explicit button role; omitted only for compatibility with older pure-helper callers. */
  control?: "speed" | "steering";
  direction: MCQSteeringDirection;
  startedAt: number;
  activationOrder: number;
  startX: number;
  startY: number;
  movementExceeded: boolean;
  boostTriggered: boolean;
  laneMoveApplied: boolean;
}

/** The newest non-swipe pointer wins steering; older held pointers remain available to resume. */
export function resolveMCQSteeringDirection(
  pointers: ReadonlyMap<number, MCQSteeringPointer>,
): MCQSteeringDirection | null {
  let latest: MCQSteeringPointer | null = null;
  for (const pointer of pointers.values()) {
    if (pointer.movementExceeded || pointer.control === "speed") continue;
    if (!latest || pointer.activationOrder > latest.activationOrder) latest = pointer;
  }
  return latest?.direction ?? null;
}

/** Any live directional hold can accelerate; moved/cancelled gestures cannot leave acceleration stuck. */
export function hasActiveMCQDrivingPointer(
  pointers: ReadonlyMap<number, MCQSteeringPointer>,
): boolean {
  for (const pointer of pointers.values()) {
    if (!pointer.movementExceeded && pointer.control !== "steering") return true;
  }
  return false;
}

export function hasActiveMCQSpeedBoost(
  pointers: ReadonlyMap<number, MCQSteeringPointer>,
): boolean {
  for (const pointer of pointers.values()) {
    if (!pointer.movementExceeded && pointer.control !== "steering" && pointer.boostTriggered) return true;
  }
  return false;
}
