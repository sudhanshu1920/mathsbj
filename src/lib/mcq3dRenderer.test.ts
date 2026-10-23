import { describe, expect, it } from "vitest";
import {
  getMCQ3DEnvironmentChangeDelay,
  getMCQ3DVerticalFovDegrees,
  getNextMCQ3DEnvironmentThemeIndex,
  MCQ_3D_ENVIRONMENT_CHANGE_MAX_MS,
  MCQ_3D_ENVIRONMENT_CHANGE_MIN_MS,
  MCQ_3D_ENVIRONMENT_THEME_COUNT,
} from "@/lib/mcq3dRenderer";

const ASPECT_RATIOS = [0.45, 0.6, 0.75, 0.9, 1.2, 1.6, 1.8, 2.2] as const;

function horizontalFovDegrees(aspectRatio: number, verticalFovDegrees: number): number {
  return (
    2 *
    Math.atan(aspectRatio * Math.tan((verticalFovDegrees * Math.PI) / 360)) *
    180 /
    Math.PI
  );
}

function cameraDepth(point: readonly [number, number, number]): number {
  const eye = [0, 3.45, 7.2] as const;
  const target = [0, 0.92, -4.85] as const;
  const forward = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
  const length = Math.hypot(forward[0], forward[1], forward[2]);
  return (
    (point[1] - eye[1]) * forward[1] / length +
    (point[2] - eye[2]) * forward[2] / length
  );
}

function projectedHorizontalNdc(point: readonly [number, number, number], aspectRatio: number): number {
  const depth = cameraDepth(point);
  const verticalFov = getMCQ3DVerticalFovDegrees(aspectRatio);
  return point[0] / (depth * aspectRatio * Math.tan((verticalFov * Math.PI) / 360));
}

function projectedVerticalNdc(point: readonly [number, number, number], aspectRatio: number): number {
  const eye = [0, 3.45, 7.2] as const;
  const target = [0, 0.92, -4.85] as const;
  const forward = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
  const length = Math.hypot(forward[0], forward[1], forward[2]);
  const cameraY =
    (point[1] - eye[1]) * (-forward[2] / length) +
    (point[2] - eye[2]) * (forward[1] / length);
  const depth = cameraDepth(point);
  const verticalFov = getMCQ3DVerticalFovDegrees(aspectRatio);
  return cameraY / (depth * Math.tan((verticalFov * Math.PI) / 360));
}

describe("MCQ 3D random environment rotation", () => {
  it("keeps random background intervals within the active-play range", () => {
    expect(getMCQ3DEnvironmentChangeDelay(0)).toBe(MCQ_3D_ENVIRONMENT_CHANGE_MIN_MS);
    expect(getMCQ3DEnvironmentChangeDelay(0.999999)).toBe(MCQ_3D_ENVIRONMENT_CHANGE_MAX_MS);
    for (const value of [0, 0.25, 0.5, 0.75, 0.999999, Number.NaN]) {
      const delay = getMCQ3DEnvironmentChangeDelay(value);
      expect(delay).toBeGreaterThanOrEqual(MCQ_3D_ENVIRONMENT_CHANGE_MIN_MS);
      expect(delay).toBeLessThanOrEqual(MCQ_3D_ENVIRONMENT_CHANGE_MAX_MS);
    }
  });

  it("selects a different valid theme rather than immediately repeating the current one", () => {
    expect(MCQ_3D_ENVIRONMENT_THEME_COUNT).toBeGreaterThanOrEqual(4);
    for (let current = 0; current < MCQ_3D_ENVIRONMENT_THEME_COUNT; current += 1) {
      for (const randomValue of [0, 0.2, 0.5, 0.8, 0.999999]) {
        const next = getNextMCQ3DEnvironmentThemeIndex(current, randomValue);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(MCQ_3D_ENVIRONMENT_THEME_COUNT);
        expect(next).not.toBe(current);
      }
    }
  });
});

describe("MCQ 3D responsive camera framing", () => {
  it("keeps at least a 90-degree horizontal field of view across supported screen shapes", () => {
    for (const aspectRatio of ASPECT_RATIOS) {
      const horizontalFov = horizontalFovDegrees(
        aspectRatio,
        getMCQ3DVerticalFovDegrees(aspectRatio),
      );
      expect(horizontalFov).toBeGreaterThanOrEqual(90 - 1e-8);
      if (aspectRatio <= 1.6) expect(horizontalFov).toBeCloseTo(90, 8);
    }
  });

  it("keeps the car's outer-lane body and spoiler corners inside the viewport", () => {
    // These bounds mirror the widest points in buildCarMesh after lane placement:
    // rear wheels at x +/-0.6475 and the spoiler at x +/-0.61.
    for (const laneX of [-3.45, 3.45]) {
      const outerX = laneX < 0 ? laneX - 0.6475 : laneX + 0.6475;
      const spoilerX = laneX < 0 ? laneX - 0.61 : laneX + 0.61;
      const carExtremes: Array<readonly [number, number, number]> = [
        [outerX, 0.21, 3.075],
        [spoilerX, 0.8225, 3.20],
        [laneX + (laneX < 0 ? 0.54 : -0.54), 0.45, 3.23],
      ];

      for (const aspectRatio of ASPECT_RATIOS) {
        for (const point of carExtremes) {
          expect(cameraDepth(point)).toBeGreaterThan(0);
          expect(Math.abs(projectedHorizontalNdc(point, aspectRatio))).toBeLessThan(1);
        }
      }
    }
  });

  it("keeps the visible tire bottoms and spoiler top inside the vertical viewport", () => {
    // These points represent the low tyre edge and high spoiler edge in buildCarMesh
    // after the car is translated to MCQ_GAME_CAR_CENTER_Z.
    const verticalExtremes: Array<readonly [number, number, number]> = [
      [0, -0.105, 2.84],
      [0, 0.8225, 3.20],
    ];

    for (const aspectRatio of ASPECT_RATIOS) {
      for (const point of verticalExtremes) {
        expect(cameraDepth(point)).toBeGreaterThan(0);
        expect(Math.abs(projectedVerticalNdc(point, aspectRatio))).toBeLessThan(1);
      }
    }
  });

  it("falls back to a valid square viewport for invalid aspect ratios", () => {
    expect(getMCQ3DVerticalFovDegrees(0)).toBeCloseTo(90, 8);
    expect(getMCQ3DVerticalFovDegrees(Number.NaN)).toBeCloseTo(90, 8);
    expect(getMCQ3DVerticalFovDegrees(Number.POSITIVE_INFINITY)).toBeCloseTo(90, 8);
  });
});
