import { describe, expect, it } from "vitest";
import { createJumpPlatforms, stepJumpPlayer, type JumpPlayerState, type JumpPlatform } from "@/lib/mcqJumpPhysics";

const player = (overrides: Partial<JumpPlayerState> = {}): JumpPlayerState => ({
  x: 20,
  y: 80,
  vx: 0,
  vy: 0,
  width: 20,
  height: 20,
  grounded: true,
  checkpointX: 20,
  checkpointY: 80,
  ...overrides,
});

describe("2D Math Jump Adventure physics", () => {
  it("moves horizontally at a bounded speed and clamps the player to the world", () => {
    const moved = stepJumpPlayer(player(), {
      axis: 1,
      jump: false,
      movementSpeed: 200,
      gravity: 0,
      jumpImpulse: 500,
    }, [], 100, 120, 1 / 60);

    expect(moved.x).toBeGreaterThan(20);
    expect(moved.vx).toBe(200);
    expect(stepJumpPlayer(player({ x: 95 }), {
      axis: 1, jump: false, movementSpeed: 200, gravity: 0, jumpImpulse: 500,
    }, [], 100, 120, 1 / 60).x).toBe(80);
  });

  it("jumps only from a grounded state and rejects a second mid-air jump", () => {
    const platforms: JumpPlatform[] = [{ x: 0, y: 100, width: 200, height: 12 }];
    const jumped = stepJumpPlayer(player(), {
      axis: 0, jump: true, movementSpeed: 200, gravity: 900, jumpImpulse: 500,
    }, platforms, 300, 300, 1 / 120);

    expect(jumped.vy).toBeLessThan(0);
    expect(jumped.grounded).toBe(false);

    const secondJump = stepJumpPlayer(jumped, {
      axis: 0, jump: true, movementSpeed: 200, gravity: 900, jumpImpulse: 500,
    }, platforms, 300, 300, 1 / 120);
    expect(secondJump.vy).toBeGreaterThan(jumped.vy);
  });

  it("lands on a thin platform using swept vertical crossing", () => {
    const start = player({ x: 50, y: 78, vy: 100, grounded: false });
    const platform = { x: 0, y: 100, width: 180, height: 8 };
    const landed = stepJumpPlayer(start, {
      axis: 0, jump: false, movementSpeed: 200, gravity: 0, jumpImpulse: 500,
    }, [platform], 300, 300, 1 / 30);

    expect(landed.grounded).toBe(true);
    expect(landed.y).toBe(80);
    expect(landed.vy).toBe(0);
  });

  it("respawns once at the last checkpoint after falling below the world", () => {
    const start = player({ x: 200, y: 130, vy: 150, grounded: false, checkpointX: 65, checkpointY: 40 });
    const respawned = stepJumpPlayer(start, {
      axis: 1, jump: false, movementSpeed: 200, gravity: 900, jumpImpulse: 500,
    }, [], 300, 100, 1 / 120);

    expect(respawned.x).toBe(65);
    expect(respawned.y).toBe(40);
    expect(respawned.vx).toBe(0);
    expect(respawned.vy).toBe(0);
    expect(respawned.grounded).toBe(false);
  });

  it("builds responsive, ordered platforms including safe checkpoints", () => {
    const platforms = createJumpPlatforms(360, 640);
    expect(platforms.length).toBeGreaterThan(5);
    expect(platforms[0].checkpoint).toBe(true);
    expect(platforms.every((platform) => Number.isFinite(platform.x) && platform.width > 0)).toBe(true);
    expect(platforms[platforms.length - 1].x).toBeGreaterThan(platforms[0].x);
  });
});
