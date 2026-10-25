import { describe, expect, it } from "vitest";
import {
  doesSpaceHazardHitShip,
  getSpaceShooterBestScore,
  getSpaceShooterBossState,
  getSpaceShooterLevel,
  getSpaceQuestionComplexity,
  normalizeSpaceShooterDifficulty,
  selectSpaceShooterQuestions,
} from "@/lib/mcqSpaceShooterMission";

const tableQuestions = Array.from({ length: 30 }, (_, index) => {
  const left = index + 1;
  const right = 1 + (index % 10);
  return {
    topicId: "tables",
    text: `${left} × ${right} = ?`,
    answer: left * right,
  };
});

describe("Math Space Shooter mission rules", () => {
  it("applies ship collision only inside the collision bounds and outside invulnerability", () => {
    const collision = {
      hazardX: 100, hazardY: 500, hazardSize: 30,
      shipX: 100, shipY: 500, shipRadius: 24, invulnerableMs: 0,
    };
    expect(doesSpaceHazardHitShip(collision)).toBe(true);
    expect(doesSpaceHazardHitShip({ ...collision, invulnerableMs: 50 })).toBe(false);
    expect(doesSpaceHazardHitShip({ ...collision, hazardX: 220 })).toBe(false);
    expect(doesSpaceHazardHitShip({ ...collision, hazardX: Number.NaN })).toBe(false);
  });

  it("normalizes unknown difficulty and clamps invalid persistent scores", () => {
    expect(normalizeSpaceShooterDifficulty("hard")).toBe("hard");
    expect(normalizeSpaceShooterDifficulty("extreme")).toBe("medium");
    expect(getSpaceShooterBestScore(-50)).toBe(0);
    expect(getSpaceShooterBestScore("not-a-number")).toBe(0);
    expect(getSpaceShooterBestScore(50.9)).toBe(50);
  });

  it("chooses materially different generated question pools for easy and hard", () => {
    const easy = selectSpaceShooterQuestions(tableQuestions, "easy", 10);
    const hard = selectSpaceShooterQuestions(tableQuestions, "hard", 10);
    expect(easy.length).toBeGreaterThan(0);
    expect(easy.length).toBeLessThan(tableQuestions.length);
    expect(hard.length).toBe(easy.length);
    expect(easy.map((question) => question.text)).not.toEqual(hard.map((question) => question.text));
    const average = (pool: typeof tableQuestions) => pool.reduce((sum, question) => sum + getSpaceQuestionComplexity(question), 0) / pool.length;
    expect(average(easy)).toBeLessThan(average(hard));
  });

  it("keeps the requested count when the preference pool is too small", () => {
    const questions = tableQuestions.slice(0, 8);
    expect(selectSpaceShooterQuestions(questions, "hard", 8)).toHaveLength(8);
  });

  it("advances levels based on accepted correct answers and creates boss encounters every third level", () => {
    expect(getSpaceShooterLevel(0, "medium")).toBe(1);
    expect(getSpaceShooterLevel(8, "medium")).toBe(3);
    expect(getSpaceShooterBossState(8, "medium")).toEqual({
      active: true, defeated: false, health: 3, maximumHealth: 3,
    });
    expect(getSpaceShooterBossState(11, "medium")).toEqual({
      active: true, defeated: true, health: 0, maximumHealth: 3,
    });
    expect(getSpaceShooterBossState(12, "medium").active).toBe(false);
    expect(getSpaceShooterLevel(10, "hard")).toBe(3);
    expect(getSpaceShooterBossState(10, "hard")).toEqual({
      active: true, defeated: false, health: 4, maximumHealth: 4,
    });
    expect(getSpaceShooterBossState(14, "hard")).toEqual({
      active: true, defeated: true, health: 0, maximumHealth: 4,
    });
  });

  it("treats wrong answers as non-progress and exposes greater hazard pressure per difficulty", async () => {
    const mod = await import("@/lib/mcqSpaceShooterMission");
    expect(mod.SPACE_SHOOTER_DIFFICULTIES.easy.hazardSpeed).toBeLessThan(mod.SPACE_SHOOTER_DIFFICULTIES.medium.hazardSpeed);
    expect(mod.SPACE_SHOOTER_DIFFICULTIES.medium.hazardSpeed).toBeLessThan(mod.SPACE_SHOOTER_DIFFICULTIES.hard.hazardSpeed);
    expect(mod.SPACE_SHOOTER_DIFFICULTIES.easy.lives).toBeGreaterThan(mod.SPACE_SHOOTER_DIFFICULTIES.hard.lives);
  });
});
