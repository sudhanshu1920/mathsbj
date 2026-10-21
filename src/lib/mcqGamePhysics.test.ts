import { describe, expect, it } from "vitest";
import {
  MCQ_GAME_BOOST_MULTIPLIER,
  MCQ_GAME_CAR_HALF_WIDTH,
  MCQ_GAME_COLLISION_Z,
  MCQ_GAME_GATE_HALF_WIDTH,
  MCQ_GAME_HOLD_THRESHOLD_MS,
  MCQ_GAME_LANE_X,
  clampMCQGameLane,
  classifySteeringGesture,
  createMCQGateMappings,
  detectSweptGateCollision,
  getMCQGameSpeedMultiplier,
} from "@/lib/mcqGamePhysics";

describe("3D MCQ racing steering and collision physics", () => {
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

  it("uses one bounded forward-speed multiplier for hold boost", () => {
    expect(getMCQGameSpeedMultiplier(false)).toBe(1);
    expect(getMCQGameSpeedMultiplier(true)).toBe(MCQ_GAME_BOOST_MULTIPLIER);
    expect(getMCQGameSpeedMultiplier(true)).toBeLessThanOrEqual(2.25);
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
