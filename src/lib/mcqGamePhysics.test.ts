import { describe, expect, it } from "vitest";
import {
  MCQ_GAME_BASE_SPEED_MULTIPLIER,
  MCQ_GAME_MAX_SPEED_MULTIPLIER,
  MCQ_GAME_CAR_HALF_WIDTH,
  MCQ_GAME_COLLISION_Z,
  MCQ_GAME_DEFAULT_GATE_TRAVEL_DURATION_MS,
  resolveMCQGameGateTravelDurationMs,
  isMCQGameCollisionWithinDeadline,
  MCQ_GAME_GATE_HALF_WIDTH,
  MCQ_GAME_HOLD_THRESHOLD_MS,
  MCQ_GAME_LANE_X,
  clampMCQGameLane,
  classifySteeringGesture,
  createMCQGateMappings,
  detectSweptGateCollision,
  getSweptLaneGateContactFraction,
  advanceMCQGameSpeed,
} from "@/lib/mcqGamePhysics";

describe("3D MCQ racing steering and collision physics", () => {
  it("uses the selected per-question timer for gate travel and defaults to ten seconds only when absent", () => {
    expect(resolveMCQGameGateTravelDurationMs(5_000)).toBe(5_000);
    expect(resolveMCQGameGateTravelDurationMs(10_000)).toBe(10_000);
    expect(resolveMCQGameGateTravelDurationMs(20_000)).toBe(20_000);
    expect(resolveMCQGameGateTravelDurationMs(30_000)).toBe(30_000);
    expect(resolveMCQGameGateTravelDurationMs(undefined)).toBe(MCQ_GAME_DEFAULT_GATE_TRAVEL_DURATION_MS);
    expect(resolveMCQGameGateTravelDurationMs(null)).toBe(MCQ_GAME_DEFAULT_GATE_TRAVEL_DURATION_MS);
    expect(resolveMCQGameGateTravelDurationMs(0)).toBe(MCQ_GAME_DEFAULT_GATE_TRAVEL_DURATION_MS);
    expect(resolveMCQGameGateTravelDurationMs(Number.NaN)).toBe(MCQ_GAME_DEFAULT_GATE_TRAVEL_DURATION_MS);
  });

  it("resolves a collision at the timer boundary ahead of timeout, but rejects a late crossing", () => {
    expect(isMCQGameCollisionWithinDeadline(5_000, 5_000)).toBe(true);
    expect(isMCQGameCollisionWithinDeadline(5_050, 5_000)).toBe(true);
    expect(isMCQGameCollisionWithinDeadline(5_051, 5_000)).toBe(false);
    expect(isMCQGameCollisionWithinDeadline(Number.NaN, 5_000)).toBe(false);
    expect(isMCQGameCollisionWithinDeadline(5_000, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("binds each visible answer to one stable option, lane and gate", () => {
    const mappings = createMCQGateMappings("question-42", ["26", "28", "22", "33"]);
    expect(mappings).toHaveLength(4);
    expect(mappings.map((mapping) => mapping.optionValue)).toEqual(["26", "28", "22", "33"]);
    expect(mappings.map((mapping) => mapping.laneId)).toEqual(["lane-1", "lane-2", "lane-3", "lane-4"]);
    expect(new Set(mappings.map((mapping) => mapping.gateId)).size).toBe(4);
    expect(mappings.every((mapping) => mapping.questionId === "question-42")).toBe(true);
  });

  it("maps short presses to exactly one directional tap", () => {
    expect(classifySteeringGesture(MCQ_GAME_HOLD_THRESHOLD_MS - 1, -1)).toEqual({ kind: "tap", direction: -1 });
    expect(classifySteeringGesture(0, 1)).toEqual({ kind: "tap", direction: 1 });
  });

  it("maps the hold threshold and longer presses to boost, never an extra lane change", () => {
    expect(classifySteeringGesture(MCQ_GAME_HOLD_THRESHOLD_MS, -1)).toEqual({ kind: "boost", direction: -1 });
    expect(classifySteeringGesture(MCQ_GAME_HOLD_THRESHOLD_MS + 500, 1)).toEqual({ kind: "boost", direction: 1 });
  });

  it("clamps the car to the four road lanes", () => {
    expect(clampMCQGameLane(0, -1)).toBe(0);
    expect(clampMCQGameLane(3, 1)).toBe(3);
    expect(clampMCQGameLane(2, -1)).toBe(1);
    expect(clampMCQGameLane(1, 1)).toBe(2);
    expect(clampMCQGameLane(99, 1)).toBe(3);
  });

  it("reaches a clearly higher speed quickly while keeping acceleration time-based", () => {
    let speed = MCQ_GAME_BASE_SPEED_MULTIPLIER;
    for (let frame = 0; frame < 15; frame += 1) {
      speed = advanceMCQGameSpeed(speed, 1000 / 30, true);
    }
    expect(speed).toBeGreaterThan(1.4);
    expect(speed).toBeLessThanOrEqual(MCQ_GAME_MAX_SPEED_MULTIPLIER);
  });

  it("compounds speed as a hold continues and clamps at the configured maximum", () => {
    let speed = MCQ_GAME_BASE_SPEED_MULTIPLIER;
    for (let frame = 0; frame < 5; frame += 1) speed = advanceMCQGameSpeed(speed, 100, true);
    const after500Ms = speed;
    for (let frame = 0; frame < 5; frame += 1) speed = advanceMCQGameSpeed(speed, 100, true);
    const after1000Ms = speed;

    expect(after500Ms).toBeGreaterThan(MCQ_GAME_BASE_SPEED_MULTIPLIER);
    expect(after1000Ms).toBeGreaterThan(after500Ms);

    for (let frame = 0; frame < 80; frame += 1) speed = advanceMCQGameSpeed(speed, 100, true);
    expect(speed).toBe(MCQ_GAME_MAX_SPEED_MULTIPLIER);
  });

  it("decelerates smoothly toward cruising speed after release", () => {
    const accelerated = advanceMCQGameSpeed(2.5, 50, false);
    expect(accelerated).toBeGreaterThan(MCQ_GAME_BASE_SPEED_MULTIPLIER);
    expect(accelerated).toBeLessThan(2.5);

    let speed = accelerated;
    for (let frame = 0; frame < 100; frame += 1) speed = advanceMCQGameSpeed(speed, 100, false);
    expect(speed).toBeCloseTo(MCQ_GAME_BASE_SPEED_MULTIPLIER, 6);
  });

  it("keeps the acceleration curve consistent at 30 and 60 simulated FPS", () => {
    const simulateOneSecond = (frames: number) => {
      let speed = MCQ_GAME_BASE_SPEED_MULTIPLIER;
      for (let frame = 0; frame < frames; frame += 1) {
        speed = advanceMCQGameSpeed(speed, 1000 / frames, true);
      }
      return speed;
    };

    expect(simulateOneSecond(30)).toBeCloseTo(simulateOneSecond(60), 6);
  });

  it("sanitizes invalid speed and elapsed-time inputs safely", () => {
    expect(advanceMCQGameSpeed(Number.NaN, Number.NaN, true))
      .toBe(MCQ_GAME_BASE_SPEED_MULTIPLIER);
    expect(advanceMCQGameSpeed(MCQ_GAME_MAX_SPEED_MULTIPLIER * 2, 0, true))
      .toBe(MCQ_GAME_MAX_SPEED_MULTIPLIER);
  });

  it("detects the first swept contact with a fixed gate as the car enters its lane", () => {
    const contact = getSweptLaneGateContactFraction({
      previousCarX: MCQ_GAME_LANE_X[1],
      carX: -2.5,
      gateX: MCQ_GAME_LANE_X[0],
      carHalfWidth: MCQ_GAME_CAR_HALF_WIDTH,
      gateHalfWidth: MCQ_GAME_GATE_HALF_WIDTH,
    });
    expect(contact).not.toBeNull();
    expect(contact).toBeGreaterThan(0);
    expect(contact).toBeLessThan(1);
  });

  it("does not treat existing overlap or leaving a lane as a new contact", () => {
    expect(getSweptLaneGateContactFraction({
      previousCarX: MCQ_GAME_LANE_X[1],
      carX: MCQ_GAME_LANE_X[1] + 0.3,
      gateX: MCQ_GAME_LANE_X[1],
      carHalfWidth: MCQ_GAME_CAR_HALF_WIDTH,
      gateHalfWidth: MCQ_GAME_GATE_HALF_WIDTH,
    })).toBeNull();
    expect(getSweptLaneGateContactFraction({
      previousCarX: MCQ_GAME_LANE_X[1],
      carX: MCQ_GAME_LANE_X[1],
      gateX: MCQ_GAME_LANE_X[0],
      carHalfWidth: MCQ_GAME_CAR_HALF_WIDTH,
      gateHalfWidth: MCQ_GAME_GATE_HALF_WIDTH,
    })).toBeNull();
  });

  it("detects a high-speed lateral sweep that enters and exits a gate within one frame", () => {
    const contact = getSweptLaneGateContactFraction({
      previousCarX: -5.2,
      carX: -1.8,
      gateX: MCQ_GAME_LANE_X[0],
      carHalfWidth: MCQ_GAME_CAR_HALF_WIDTH,
      gateHalfWidth: MCQ_GAME_GATE_HALF_WIDTH,
    });
    expect(contact).not.toBeNull();
    expect(contact).toBeCloseTo(((-3.45 - (MCQ_GAME_CAR_HALF_WIDTH + MCQ_GAME_GATE_HALF_WIDTH)) - (-5.2)) / 3.4, 6);
  });

  it("registers a real swept contact with the gate in the occupied lane", () => {
    expect(detectSweptGateCollision({
      previousGateZ: -0.4, gateZ: 1.1, collisionZ: MCQ_GAME_COLLISION_Z,
      previousCarX: MCQ_GAME_LANE_X[1], carX: MCQ_GAME_LANE_X[1],
      gateX: MCQ_GAME_LANE_X[1], carHalfWidth: MCQ_GAME_CAR_HALF_WIDTH,
      gateHalfWidth: MCQ_GAME_GATE_HALF_WIDTH,
    })).toBe(true);
  });

  it("does not report contact with a different lane or a car between lanes", () => {
    const common = {
      previousGateZ: -0.4, gateZ: 1.1, collisionZ: MCQ_GAME_COLLISION_Z,
      previousCarX: MCQ_GAME_LANE_X[1], carX: MCQ_GAME_LANE_X[1],
      carHalfWidth: MCQ_GAME_CAR_HALF_WIDTH, gateHalfWidth: MCQ_GAME_GATE_HALF_WIDTH,
    };
    expect(detectSweptGateCollision({ ...common, gateX: MCQ_GAME_LANE_X[2] })).toBe(false);
    expect(detectSweptGateCollision({
      ...common, previousCarX: 0, carX: 0, gateX: MCQ_GAME_LANE_X[1],
    })).toBe(false);
  });

  it("catches a high-speed crossing instead of tunnelling through the collider", () => {
    expect(detectSweptGateCollision({
      previousGateZ: -3, gateZ: 2, collisionZ: MCQ_GAME_COLLISION_Z,
      previousCarX: MCQ_GAME_LANE_X[3], carX: MCQ_GAME_LANE_X[3],
      gateX: MCQ_GAME_LANE_X[3], carHalfWidth: MCQ_GAME_CAR_HALF_WIDTH,
      gateHalfWidth: MCQ_GAME_GATE_HALF_WIDTH,
    })).toBe(true);
  });

  it("ignores gates that do not cross the collision plane in the forward direction", () => {
    const common = {
      collisionZ: MCQ_GAME_COLLISION_Z, previousCarX: MCQ_GAME_LANE_X[0],
      carX: MCQ_GAME_LANE_X[0], gateX: MCQ_GAME_LANE_X[0],
      carHalfWidth: MCQ_GAME_CAR_HALF_WIDTH, gateHalfWidth: MCQ_GAME_GATE_HALF_WIDTH,
    };
    expect(detectSweptGateCollision({ ...common, previousGateZ: -4, gateZ: -1 })).toBe(false);
    expect(detectSweptGateCollision({ ...common, previousGateZ: 1, gateZ: 0.5 })).toBe(false);
  });

  it("uses the car position at the plane-crossing instant during steering", () => {
    expect(detectSweptGateCollision({
      previousGateZ: 0, gateZ: 1, collisionZ: 0.5,
      previousCarX: MCQ_GAME_LANE_X[0], carX: MCQ_GAME_LANE_X[1],
      gateX: MCQ_GAME_LANE_X[1], carHalfWidth: MCQ_GAME_CAR_HALF_WIDTH,
      gateHalfWidth: MCQ_GAME_GATE_HALF_WIDTH,
    })).toBe(false);
  });
});
