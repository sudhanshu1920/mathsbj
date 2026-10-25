import { describe, expect, it } from "vitest";
import {
  hasActiveMCQDrivingPointer,
  hasActiveMCQSpeedBoost,
  resolveMCQSteeringDirection,
  type MCQSteeringPointer,
} from "@/lib/mcqGameControls";

function pointer(
  pointerId: number,
  direction: -1 | 1,
  activationOrder: number,
  overrides: Partial<MCQSteeringPointer> = {},
): MCQSteeringPointer {
  return {
    pointerId,
    direction,
    activationOrder,
    startedAt: activationOrder * 10,
    startX: direction < 0 ? 10 : 90,
    startY: 50,
    movementExceeded: false,
    boostTriggered: false,
    laneMoveApplied: false,
    ...overrides,
  };
}

describe("3D car racing independent multi-touch controls", () => {
  it("keeps the left pointer active when a newer right tap is added", () => {
    const active = new Map<number, MCQSteeringPointer>([
      [11, pointer(11, -1, 1, { boostTriggered: true })],
    ]);
    active.set(22, pointer(22, 1, 2));
    expect(active.size).toBe(2);
    expect(resolveMCQSteeringDirection(active)).toBe(1);
    expect(hasActiveMCQDrivingPointer(active)).toBe(true);
    expect(hasActiveMCQSpeedBoost(active)).toBe(true);

    active.delete(22);
    expect(active.size).toBe(1);
    expect(resolveMCQSteeringDirection(active)).toBe(-1);
    expect(hasActiveMCQDrivingPointer(active)).toBe(true);
    expect(hasActiveMCQSpeedBoost(active)).toBe(true);
  });

  it("restores right steering after a newer left pointer releases", () => {
    const active = new Map<number, MCQSteeringPointer>([
      [1, pointer(1, 1, 1, { boostTriggered: true })],
      [2, pointer(2, -1, 2)],
    ]);
    expect(resolveMCQSteeringDirection(active)).toBe(-1);
    active.delete(2);
    expect(resolveMCQSteeringDirection(active)).toBe(1);
    expect(hasActiveMCQSpeedBoost(active)).toBe(true);
  });

  it("resolves simultaneous directions by activation order, not Map insertion order", () => {
    const active = new Map<number, MCQSteeringPointer>([
      [9, pointer(9, -1, 7)],
      [3, pointer(3, 1, 4)],
    ]);
    expect(resolveMCQSteeringDirection(active)).toBe(-1);
    active.set(5, pointer(5, 1, 8));
    expect(resolveMCQSteeringDirection(active)).toBe(1);
  });

  it("ignores a pointer that has become a swipe and clears boost when no valid hold remains", () => {
    const active = new Map<number, MCQSteeringPointer>([
      [1, pointer(1, -1, 1, { boostTriggered: true, movementExceeded: true })],
      [2, pointer(2, 1, 2, { movementExceeded: true })],
    ]);
    expect(resolveMCQSteeringDirection(active)).toBeNull();
    expect(hasActiveMCQDrivingPointer(active)).toBe(false);
    expect(hasActiveMCQSpeedBoost(active)).toBe(false);
  });

  it("keeps Speed and steering input independent by control role", () => {
    const speed = pointer(10, 1, 1, { control: "speed", boostTriggered: true });
    const left = pointer(11, -1, 2, { control: "steering" });
    const right = pointer(12, 1, 3, { control: "steering" });
    const active = new Map<number, MCQSteeringPointer>([[10, speed], [11, left]]);
    expect(hasActiveMCQDrivingPointer(active)).toBe(true);
    expect(hasActiveMCQSpeedBoost(active)).toBe(true);
    expect(resolveMCQSteeringDirection(active)).toBe(-1);

    active.set(12, right);
    expect(resolveMCQSteeringDirection(active)).toBe(1);
    active.delete(10);
    expect(hasActiveMCQDrivingPointer(active)).toBe(false);
    expect(hasActiveMCQSpeedBoost(active)).toBe(false);
    expect(resolveMCQSteeringDirection(active)).toBe(1);
  });

  it("does not treat a steering-only hold as an accelerator", () => {
    const active = new Map<number, MCQSteeringPointer>([
      [1, pointer(1, -1, 1, { control: "steering", boostTriggered: true })],
    ]);
    expect(hasActiveMCQDrivingPointer(active)).toBe(false);
    expect(hasActiveMCQSpeedBoost(active)).toBe(false);
    expect(resolveMCQSteeringDirection(active)).toBe(-1);
  });

  it("does not accelerate after all active pointers are removed", () => {
    const active = new Map<number, MCQSteeringPointer>([
      [1, pointer(1, -1, 1)],
      [2, pointer(2, 1, 2)],
    ]);
    active.delete(1);
    expect(hasActiveMCQDrivingPointer(active)).toBe(true);
    active.delete(2);
    expect(hasActiveMCQDrivingPointer(active)).toBe(false);
  });
});
