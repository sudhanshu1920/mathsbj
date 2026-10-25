import { describe, expect, it } from "vitest";
import {
  advanceSpaceShooterBoost,
  advanceSpaceProjectile,
  clampSpaceShipX,
  getSpaceAimVelocity,
  sweptSpaceProjectileHitsRect,
} from "@/lib/mcqSpaceShooterPhysics";

describe("Math Space Shooter physics", () => {
  it("ramps boost smoothly and returns toward normal after release", () => {
    expect(advanceSpaceShooterBoost(1, true, 1.7, 0)).toBe(1);
    const accelerating = advanceSpaceShooterBoost(1, true, 1.7, 16);
    expect(accelerating).toBeGreaterThan(1);
    expect(accelerating).toBeLessThan(1.7);
    const released = advanceSpaceShooterBoost(1.7, false, 1.7, 16);
    expect(released).toBeGreaterThan(1);
    expect(released).toBeLessThan(1.7);
    expect(advanceSpaceShooterBoost(Number.NaN, true, 99, 1000)).toBe(1);
    expect(advanceSpaceShooterBoost(1, true, 99, 1000)).toBeLessThanOrEqual(3);
  });
  it("clamps the ship inside the playable width, including narrow screens", () => {
    expect(clampSpaceShipX(2, 400, 24)).toBe(24);
    expect(clampSpaceShipX(900, 400, 24)).toBe(376);
    expect(clampSpaceShipX(2, 30, 24)).toBe(15);
    expect(clampSpaceShipX(Number.NaN, 400, 24)).toBe(200);
    expect(clampSpaceShipX(100, 0, 24)).toBe(0);
  });

  it("creates a normalized projectile velocity toward the aimed target", () => {
    expect(getSpaceAimVelocity({ x: 0, y: 0 }, { x: 3, y: 4 }, 500)).toEqual({
      x: 300,
      y: 400,
    });
    expect(getSpaceAimVelocity({ x: 5, y: 8 }, { x: 5, y: 8 }, 500)).toEqual({
      x: 0,
      y: -500,
    });
    expect(getSpaceAimVelocity({ x: 0, y: 0 }, { x: 1, y: 1 }, -4)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("clamps long frame steps and expires projectiles at their lifetime", () => {
    const projectile = {
      x: 10,
      y: 20,
      vx: 100,
      vy: -200,
      ageMs: 90,
      lifetimeMs: 120,
    };
    expect(advanceSpaceProjectile(projectile, 1000)).toEqual({
      x: 15,
      y: 10,
      ageMs: 140,
      expired: true,
    });
    expect(advanceSpaceProjectile(projectile, -10)).toEqual({
      x: 10,
      y: 20,
      ageMs: 90,
      expired: false,
    });
  });

  it("detects swept hits when a fast laser crosses a target between frames", () => {
    expect(
      sweptSpaceProjectileHitsRect(
        { x: 0, y: 50 },
        { x: 200, y: 50 },
        { x: 95, y: 40, width: 10, height: 20 },
      ),
    ).toBe(true);
    expect(
      sweptSpaceProjectileHitsRect(
        { x: 0, y: 5 },
        { x: 200, y: 5 },
        { x: 95, y: 40, width: 10, height: 20 },
      ),
    ).toBe(false);
    expect(
      sweptSpaceProjectileHitsRect(
        { x: 100, y: 50 },
        { x: 100, y: 50 },
        { x: 95, y: 40, width: 10, height: 20 },
      ),
    ).toBe(true);
  });

  it("rejects malformed collision geometry safely", () => {
    expect(
      sweptSpaceProjectileHitsRect(
        { x: Number.NaN, y: 0 },
        { x: 4, y: 5 },
        { x: 1, y: 1, width: 10, height: 10 },
      ),
    ).toBe(false);
    expect(
      sweptSpaceProjectileHitsRect(
        { x: 0, y: 0 },
        { x: 4, y: 5 },
        { x: 1, y: 1, width: -10, height: 10 },
      ),
    ).toBe(false);
  });
});
