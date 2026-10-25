import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { ArrowLeft, BookOpen, Pause, Play, RotateCcw, Rocket, Shield, Timer, Trophy, Volume2, VolumeX, Zap } from "lucide-react";
import type { MCQGameValue } from "@/lib/mcqGame";
import { createMCQGateMappings } from "@/lib/mcqGamePhysics";
import {
  advanceSpaceProjectile,
  clampSpaceShipX,
  getSpaceAimVelocity,
  sweptSpaceProjectileHitsRect,
  type SpaceProjectileMotion,
  type SpaceRect,
} from "@/lib/mcqSpaceShooterPhysics";
import { setGameImmersiveMode } from "@/lib/gameImmersiveMode";
import { playClick, playSpaceExplosion, playSpaceLaser } from "@/lib/sound";
import { getSettings, setSound } from "@/lib/settings";
import {
  doesSpaceHazardHitShip,
  getSpaceShooterBestScore,
  getSpaceShooterBossState,
  getSpaceShooterLevel,
  normalizeSpaceShooterDifficulty,
  SPACE_SHOOTER_DIFFICULTIES,
  type SpaceShooterDifficulty,
} from "@/lib/mcqSpaceShooterMission";
import "./mcq-space-shooter.css";

export interface MCQSpaceShooterOption {
  value: MCQGameValue;
  label: ReactNode;
}

export interface MCQSpaceShooterProps {
  questionKey: string | number;
  sessionKey?: string | number;
  questionLabel: ReactNode;
  options: MCQSpaceShooterOption[];
  correctAnswer: MCQGameValue;
  feedback: "correct" | "wrong" | null;
  selectedOption: number | null;
  correctScore: number;
  wrongScore: number;
  progressLabel?: string;
  timerLabel?: string;
  disabled?: boolean;
  finalSubmitReady: boolean;
  canFinalizeTest: boolean;
  onSelectOption: (laneIndex: number, optionValue: MCQGameValue, gateId: string) => boolean | void;
  onFinalSubmit: () => boolean | void;
  onChangeGame?: () => void;
  onRestartGame?: () => void;
  onPauseChange?: (paused: boolean) => void;
  difficulty?: SpaceShooterDifficulty;
  onStartMission?: (difficulty: SpaceShooterDifficulty) => boolean | void;
}

interface SpaceStar {
  x: number;
  y: number;
  radius: number;
  speed: number;
  alpha: number;
}

interface SpaceProjectile extends SpaceProjectileMotion {
  id: number;
  questionKey: string;
  targetId: string;
  targetIndex: number;
  optionValue: MCQGameValue;
}

interface SpaceParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifetimeMs: number;
  radius: number;
  color: string;
}

interface SpaceHazard {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  kind: "asteroid" | "enemy";
}

type SpaceControlAction = "left" | "right" | "boost";
interface ActiveSpaceControl {
  action: SpaceControlAction;
  sequence: number;
}

interface SpaceWorld {
  width: number;
  height: number;
  pixelRatio: number;
  shipX: number;
  heldDirection: -1 | 0 | 1;
  boostHeld: boolean;
  stars: SpaceStar[];
  projectiles: SpaceProjectile[];
  particles: SpaceParticle[];
  hazards: SpaceHazard[];
  nextProjectileId: number;
  nextHazardId: number;
  hazardSpawnElapsedMs: number;
  invulnerableMs: number;
  level: number;
  bossActive: boolean;
  bossHealth: number;
  bossMaxHealth: number;
  bossAttackPulseMs: number;
  lastTimestamp: number | null;
}

const PROJECTILE_SPEED = 690;
const PROJECTILE_LIFETIME_MS = 1500;
const MAX_PARTICLES = 48;
const MAX_HAZARDS = 4;
const SHIP_RADIUS = 24;
const SHOOTER_DIFFICULTY_KEY = "math-space-shooter-difficulty-v1";
const SHOOTER_BEST_SCORE_KEY = "math-space-shooter-best-v1";

function loadStoredDifficulty(): SpaceShooterDifficulty {
  try {
    return normalizeSpaceShooterDifficulty(window.localStorage.getItem(SHOOTER_DIFFICULTY_KEY));
  } catch {
    return "medium";
  }
}

function loadStoredBestScore(): number {
  try {
    return getSpaceShooterBestScore(window.localStorage.getItem(SHOOTER_BEST_SCORE_KEY));
  } catch {
    return 0;
  }
}

function persistBestScore(value: number): void {
  try {
    window.localStorage.setItem(SHOOTER_BEST_SCORE_KEY, String(getSpaceShooterBestScore(value)));
  } catch {
    // Private browsing/storage restrictions must never interrupt gameplay.
  }
}

const createWorld = (): SpaceWorld => ({
  width: 0,
  height: 0,
  pixelRatio: 1,
  shipX: 0,
  heldDirection: 0,
  boostHeld: false,
  stars: [],
  projectiles: [],
  particles: [],
  hazards: [],
  nextProjectileId: 1,
  nextHazardId: 1,
  hazardSpawnElapsedMs: 0,
  invulnerableMs: 0,
  level: 1,
  bossActive: false,
  bossHealth: 0,
  bossMaxHealth: 0,
  bossAttackPulseMs: 0,
  lastTimestamp: null,
});

function createStars(width: number, height: number): SpaceStar[] {
  const count = Math.max(36, Math.min(92, Math.round((width * height) / 5000)));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: 0.5 + Math.random() * 1.4,
    speed: 12 + Math.random() * 44,
    alpha: 0.2 + Math.random() * 0.72,
  }));
}

function createHitParticles(world: SpaceWorld, x: number, y: number): void {
  // One bounded burst per confirmed collision: bright sparks plus slower pixel debris.
  const colors = ["#bafaff", "#00e5ff", "#75a7ff", "#ffe18a", "#ff8fca", "#ff9b28"];
  const burstCount = 24;
  for (let i = 0; i < burstCount && world.particles.length < MAX_PARTICLES; i += 1) {
    const angle = (Math.PI * 2 * i) / burstCount + (i % 3) * 0.07;
    const debris = i % 3 === 0;
    const speed = debris ? 34 + (i % 4) * 12 : 82 + (i % 5) * 22;
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      ageMs: 0,
      lifetimeMs: debris ? 420 + (i % 4) * 65 : 220 + (i % 4) * 45,
      radius: debris ? 2.7 + (i % 3) * 0.8 : 1.7 + (i % 3) * 0.55,
      color: colors[i % colors.length]!,
    });
  }
}

function drawSpaceFrame(context: CanvasRenderingContext2D, world: SpaceWorld): void {
  const { width, height } = world;
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#050719";
  context.fillRect(0, 0, width, height);

  // Procedural pixel planets are drawn with coarse square cells.
  const drawPlanet = (cx: number, cy: number, radius: number, base: string, shade: string, glow: string) => {
    const cell = Math.max(3, Math.round(radius / 7));
    for (let py = -radius; py <= radius; py += cell) {
      for (let px = -radius; px <= radius; px += cell) {
        if (px * px + py * py > radius * radius) continue;
        context.fillStyle = py < -radius * 0.42 || px < -radius * 0.42 ? glow : (px + py) % (cell * 3) === 0 ? shade : base;
        context.fillRect(Math.round(cx + px), Math.round(cy + py), cell, cell);
      }
    }
    const craters = [[-0.28, -0.14, 0.13], [0.28, 0.18, 0.18], [-0.02, 0.42, 0.1]];
    for (const [dx, dy, size] of craters) {
      context.fillStyle = shade;
      context.fillRect(cx + dx * radius, cy + dy * radius, Math.max(cell * 2, radius * size), Math.max(cell, radius * size * 0.55));
    }
  };
  drawPlanet(-width * 0.012, height * 0.16, Math.min(width, height) * 0.13, "#452080", "#26114b", "#a52fcb");
  drawPlanet(width * 1.015, height * 0.2, Math.min(width, height) * 0.12, "#07538b", "#05305d", "#18a9e5");
  drawPlanet(-width * 0.015, height * 0.99, Math.min(width, height) * 0.17, "#087fa6", "#054568", "#25d2ed");
  drawPlanet(width * 1.025, height * 0.99, Math.min(width, height) * 0.16, "#8c2b42", "#4c172d", "#f16a41");

  for (let index = 0; index < world.stars.length; index += 1) {
    const star = world.stars[index]!;
    context.globalAlpha = star.alpha;
    context.fillStyle = index % 13 === 0 ? "#f8b93d" : index % 5 === 0 ? "#28dfff" : "#d9f8ff";
    const size = Math.max(1, Math.round(star.radius * 1.4));
    context.fillRect(Math.round(star.x), Math.round(star.y), size, size);
    if (index % 17 === 0) {
      context.fillRect(Math.round(star.x - 1), Math.round(star.y - 4), 3, 9);
      context.fillRect(Math.round(star.x - 4), Math.round(star.y - 1), 9, 3);
    }
  }
  context.globalAlpha = 1;

  for (const hazard of world.hazards) {
    context.save();
    context.translate(Math.round(hazard.x), Math.round(hazard.y));
    if (hazard.kind === "enemy") {
      context.fillStyle = "#a62c56";
      context.fillRect(-hazard.size * .5, -hazard.size * .25, hazard.size, hazard.size * .5);
      context.fillStyle = "#ff6386";
      context.fillRect(-hazard.size * .34, -hazard.size * .12, hazard.size * .68, hazard.size * .18);
      context.fillStyle = "#ffd9e4";
      context.fillRect(-hazard.size * .18, -hazard.size * .04, hazard.size * .1, hazard.size * .08);
      context.fillRect(hazard.size * .08, -hazard.size * .04, hazard.size * .1, hazard.size * .08);
      context.fillStyle = "#662044";
      context.fillRect(-hazard.size * .68, 0, hazard.size * .25, hazard.size * .12);
      context.fillRect(hazard.size * .43, 0, hazard.size * .25, hazard.size * .12);
    } else {
      const size = hazard.size;
      context.fillStyle = "#6d7894";
      context.fillRect(-size * .28, -size * .5, size * .55, size * .2);
      context.fillRect(-size * .46, -size * .3, size * .75, size * .6);
      context.fillRect(-size * .27, size * .3, size * .5, size * .18);
      context.fillStyle = "#343e5b";
      context.fillRect(-size * .2, -size * .12, size * .19, size * .18);
      context.fillRect(size * .13, size * .08, size * .15, size * .13);
      context.fillStyle = "#ffbd68";
      context.fillRect(-size * .11, -size * .35, size * .12, size * .08);
    }
    context.restore();
  }

  if (world.bossActive) {
    const bossX = width / 2;
    const bossY = Math.max(44, height * .17);
    const bossWidth = Math.min(116, width * .35);
    context.fillStyle = "#6c185f";
    context.fillRect(bossX - bossWidth * .5, bossY - 13, bossWidth, 26);
    context.fillStyle = "#d841a9";
    context.fillRect(bossX - bossWidth * .42, bossY - 18, bossWidth * .84, 10);
    context.fillRect(bossX - bossWidth * .62, bossY - 6, bossWidth * .2, 18);
    context.fillRect(bossX + bossWidth * .42, bossY - 6, bossWidth * .2, 18);
    context.fillStyle = "#ffb34d";
    context.fillRect(bossX - 10, bossY - 5, 20, 10);
    if (world.bossAttackPulseMs > 0) {
      context.fillStyle = "#ff4f73";
      context.fillRect(bossX - 3, bossY + 23, 6, 20);
      context.fillRect(bossX - 18, bossY + 23, 4, 12);
      context.fillRect(bossX + 14, bossY + 23, 4, 12);
    }
    context.fillStyle = "rgba(15, 9, 34, .92)";
    context.fillRect(bossX - bossWidth * .5, bossY + 22, bossWidth, 5);
    context.fillStyle = "#ff527b";
    context.fillRect(bossX - bossWidth * .5, bossY + 22, bossWidth * Math.max(0, world.bossHealth) / Math.max(1, world.bossMaxHealth), 5);
  }

  for (const projectile of world.projectiles) {
    const unitX = projectile.vx / PROJECTILE_SPEED;
    const unitY = projectile.vy / PROJECTILE_SPEED;
    context.fillStyle = "rgba(0, 229, 255, .42)";
    for (let step = 5; step >= 0; step -= 1) {
      context.fillRect(Math.round(projectile.x - unitX * step * 5 - 2), Math.round(projectile.y - unitY * step * 5 - 2), 5, 5);
    }
    context.fillStyle = "#bafaff";
    context.fillRect(Math.round(projectile.x - 2), Math.round(projectile.y - 2), 4, 4);
  }

  for (const particle of world.particles) {
    context.globalAlpha = Math.max(0, 1 - particle.ageMs / particle.lifetimeMs);
    context.fillStyle = particle.color;
    const size = Math.max(2, Math.round(particle.radius * 2));
    context.fillRect(Math.round(particle.x / size) * size, Math.round(particle.y / size) * size, size, size);
  }
  context.globalAlpha = 1;

  const shipY = Math.max(42, height - 42);
  const shipX = clampSpaceShipX(world.shipX, width, SHIP_RADIUS);
  const pixel = Math.max(2.5, Math.min(4, width / 120));
  const sprite = [
    "......WWW.......",
    ".....WCCCW......",
    "....WCCCCCW.....",
    "...BBCCCCCBB....",
    "..BBBCCCCCBBB...",
    ".BBBBCCGCCBBBB..",
    "RRBBBCCGCCBBBRR.",
    "..RBBCCGCCBBR...",
    "...RR.....RR....",
    "...RR.....RR....",
    "....O.....O.....",
    ".....O...O......",
  ];
  const colors: Record<string, string> = { W: "#ffffff", C: "#31cfff", B: "#1d65ff", G: "#073c92", R: "#ff3c54", O: "#ff9b28" };
  context.save();
  for (let row = 0; row < sprite.length; row += 1) {
    const line = sprite[row]!;
    for (let col = 0; col < line.length; col += 1) {
      const mark = line[col]!;
      if (mark === ".") continue;
      context.fillStyle = colors[mark]!;
      context.fillRect(Math.round(shipX - (line.length * pixel) / 2 + col * pixel), Math.round(shipY - sprite.length * pixel + row * pixel), Math.ceil(pixel), Math.ceil(pixel));
    }
  }
  if (world.heldDirection !== 0) {
    context.fillStyle = "#ff9b28";
    context.fillRect(shipX - 3, shipY + 2, 6, 13);
    context.fillStyle = "#fff4a3";
    context.fillRect(shipX - 1, shipY + 2, 2, 8);
  }
  context.restore();
}
const MCQSpaceShooter = ({
  questionKey,
  sessionKey,
  questionLabel,
  options,
  correctAnswer,
  feedback,
  selectedOption,
  correctScore,
  wrongScore,
  progressLabel,
  timerLabel,
  disabled = false,
  finalSubmitReady,
  canFinalizeTest,
  onSelectOption,
  onFinalSubmit,
  onChangeGame,
  onRestartGame,
  onPauseChange,
  difficulty: configuredDifficulty = "medium",
  onStartMission,
}: MCQSpaceShooterProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playfieldRef = useRef<HTMLDivElement | null>(null);
  const targetRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const worldRef = useRef<SpaceWorld>(createWorld());
  const latestPropsRef = useRef<MCQSpaceShooterProps>({
    questionKey,
    sessionKey,
    questionLabel,
    options,
    correctAnswer,
    feedback,
    selectedOption,
    correctScore,
    wrongScore,
    progressLabel,
    timerLabel,
    disabled,
    finalSubmitReady,
    canFinalizeTest,
    onSelectOption,
    onFinalSubmit,
    onChangeGame,
    onRestartGame,
    onPauseChange,
    difficulty: configuredDifficulty,
    onStartMission,
  });
  latestPropsRef.current = {
    questionKey,
    sessionKey,
    questionLabel,
    options,
    correctAnswer,
    feedback,
    selectedOption,
    correctScore,
    wrongScore,
    progressLabel,
    timerLabel,
    disabled,
    finalSubmitReady,
    canFinalizeTest,
    onSelectOption,
    onFinalSubmit,
    onChangeGame,
    onRestartGame,
    onPauseChange,
    difficulty: configuredDifficulty,
    onStartMission,
  };

  const mappings = useMemo(
    () => createMCQGateMappings(questionKey, options.map((option) => option.value)),
    [questionKey, options],
  );
  const mappingsRef = useRef(mappings);
  mappingsRef.current = mappings;

  const [selectedTargetIndex, setSelectedTargetIndex] = useState<number | null>(options.length > 0 ? 0 : null);
  const [paused, setPaused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [difficulty, setDifficulty] = useState<SpaceShooterDifficulty>(loadStoredDifficulty);
  const [heldControls, setHeldControls] = useState({ left: false, right: false, boost: false });
  const [lives, setLives] = useState(() => SPACE_SHOOTER_DIFFICULTIES[loadStoredDifficulty()].lives);
  const [combo, setCombo] = useState(0);
  const [missionScore, setMissionScore] = useState(0);
  const [bestScore, setBestScore] = useState(loadStoredBestScore);
  const [gameOver, setGameOver] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return getSettings().sound; } catch { return true; }
  });
  const [statusMessage, setStatusMessage] = useState("AIM · FIRE · SOLVE");
  const [levelNotice, setLevelNotice] = useState<string | null>(null);
  const [rendererError, setRendererError] = useState(false);
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const pausedRef = useRef(false);
  const menuOpenRef = useRef(true);
  const countdownRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const difficultyRef = useRef(difficulty);
  const configuredDifficultyRef = useRef(configuredDifficulty);
  difficultyRef.current = difficulty;
  const gameOverRef = useRef(false);
  const livesRef = useRef(lives);
  livesRef.current = lives;
  const comboRef = useRef(0);
  const missionScoreRef = useRef(0);
  const activeControlsRef = useRef(new Map<number | string, ActiveSpaceControl>());
  const controlSequenceRef = useRef(0);
  const processedFeedbackRef = useRef<string | null>(null);
  const damagePlayerRef = useRef<(message: string) => void>(() => undefined);
  const levelNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLevelRef = useRef(getSpaceShooterLevel(correctScore, difficulty));
  const submittedRef = useRef(false);
  const finalSubmitInvokedRef = useRef(false);
  const activeQuestionKeyRef = useRef(String(questionKey));
  const activeSessionKeyRef = useRef(String(sessionKey ?? "default"));
  const selectedTargetRef = useRef<number | null>(options.length > 0 ? 0 : null);
  const pendingDirectionalTapRef = useRef<{ direction: -1 | 1; timer: ReturnType<typeof setTimeout> } | null>(null);

  const clearPendingDirectionalTap = useCallback(() => {
    const pending = pendingDirectionalTapRef.current;
    if (pending) clearTimeout(pending.timer);
    pendingDirectionalTapRef.current = null;
  }, []);

  const canInteract = useCallback(() => {
    const current = latestPropsRef.current;
    return (
      !pausedRef.current &&
      !menuOpenRef.current &&
      !gameOverRef.current &&
      !current.disabled &&
      !current.feedback &&
      !current.finalSubmitReady &&
      !submittedRef.current &&
      !finalSubmitInvokedRef.current &&
      activeQuestionKeyRef.current === String(current.questionKey)
    );
  }, []);

  const syncActiveControls = useCallback(() => {
    const active = [...activeControlsRef.current.values()];
    let mostRecentSteering: ActiveSpaceControl | null = null;
    for (const control of active) {
      if ((control.action === "left" || control.action === "right") &&
          (!mostRecentSteering || control.sequence > mostRecentSteering.sequence)) {
        mostRecentSteering = control;
      }
    }
    worldRef.current.heldDirection = mostRecentSteering
      ? (mostRecentSteering.action === "left" ? -1 : 1)
      : 0;
    worldRef.current.boostHeld = active.some((control) => control.action === "boost");
    setHeldControls({
      left: active.some((control) => control.action === "left"),
      right: active.some((control) => control.action === "right"),
      boost: worldRef.current.boostHeld,
    });
  }, []);

  const clearActiveControls = useCallback(() => {
    activeControlsRef.current.clear();
    worldRef.current.heldDirection = 0;
    worldRef.current.boostHeld = false;
    setHeldControls((previous) => previous.left || previous.right || previous.boost
      ? { left: false, right: false, boost: false }
      : previous);
  }, []);

  const beginControl = useCallback((id: number | string, action: SpaceControlAction) => {
    if (!canInteract()) return;
    activeControlsRef.current.set(id, { action, sequence: ++controlSequenceRef.current });
    syncActiveControls();
  }, [canInteract, syncActiveControls]);

  const endControl = useCallback((id: number | string) => {
    if (!activeControlsRef.current.delete(id)) return;
    syncActiveControls();
  }, [syncActiveControls]);

  const setPausedState = useCallback((nextPaused: boolean, message: string, force = false) => {
    if (nextPaused && !force) {
      const current = latestPropsRef.current;
      if (current.disabled || current.feedback || current.finalSubmitReady || submittedRef.current) return;
    }
    if (pausedRef.current === nextPaused) {
      if (force) latestPropsRef.current.onPauseChange?.(nextPaused);
      return;
    }
    pausedRef.current = nextPaused;
    clearPendingDirectionalTap();
    clearActiveControls();
    worldRef.current.lastTimestamp = null;
    setPaused(nextPaused);
    setStatusMessage(message);
    latestPropsRef.current.onPauseChange?.(nextPaused);
  }, [clearPendingDirectionalTap, clearActiveControls]);

  const cancelCountdown = useCallback((updateUi = true) => {
    if (countdownTimerRef.current !== null) clearTimeout(countdownTimerRef.current);
    countdownTimerRef.current = null;
    countdownRef.current = null;
    if (updateUi) setCountdown(null);
  }, []);

  const startCountdown = useCallback(() => {
    cancelCountdown(false);
    countdownRef.current = 3;
    setCountdown(3);
    const advance = () => {
      const current = countdownRef.current;
      if (current === null) return;
      if (current > 0) {
        const next = current - 1;
        countdownRef.current = next;
        setCountdown(next);
        countdownTimerRef.current = setTimeout(advance, next === 0 ? 350 : 800);
        return;
      }
      countdownRef.current = null;
      countdownTimerRef.current = null;
      setCountdown(null);
      worldRef.current.lastTimestamp = null;
      setStatusMessage("GO · MISSION START");
      setPausedState(false, "Mission started.", true);
    };
    countdownTimerRef.current = setTimeout(advance, 800);
  }, [cancelCountdown, setPausedState]);

  const handlePlayerDamage = useCallback((message: string) => {
    if (gameOverRef.current || pausedRef.current || menuOpenRef.current) return;
    const nextLives = Math.max(0, livesRef.current - 1);
    livesRef.current = nextLives;
    setLives(nextLives);
    worldRef.current.invulnerableMs = 1100;
    worldRef.current.heldDirection = 0;
    worldRef.current.boostHeld = false;
    clearActiveControls();
    playSpaceExplosion();
    setStatusMessage(nextLives > 0 ? `HULL HIT · ${nextLives} SHIELD${nextLives === 1 ? "" : "S"} LEFT` : "SHIP DESTROYED · MISSION OVER");
    if (nextLives === 0) {
      gameOverRef.current = true;
      setGameOver(true);
      setPausedState(true, message, true);
    }
  }, [clearActiveControls, setPausedState]);
  damagePlayerRef.current = handlePlayerDamage;

  const handleDifficultySelect = useCallback((value: SpaceShooterDifficulty) => {
    const next = normalizeSpaceShooterDifficulty(value);
    setDifficulty(next);
    try { window.localStorage.setItem(SHOOTER_DIFFICULTY_KEY, next); } catch { /* Storage is optional. */ }
    playClick();
  }, []);

  const startMission = useCallback(() => {
    if (disabled || feedback || finalSubmitReady || submittedRef.current) return;
    clearPendingDirectionalTap();
    clearActiveControls();
    const current = latestPropsRef.current;
    let accepted: boolean | void;
    try {
      accepted = current.onStartMission?.(difficultyRef.current);
    } catch {
      accepted = false;
    }
    if (accepted === false) {
      setStatusMessage("MISSION COULD NOT START · CHECK QUIZ SETUP");
      return;
    }
    livesRef.current = SPACE_SHOOTER_DIFFICULTIES[difficultyRef.current].lives;
    setLives(livesRef.current);
    comboRef.current = 0;
    missionScoreRef.current = 0;
    setCombo(0);
    setMissionScore(0);
    gameOverRef.current = false;
    setGameOver(false);
    menuOpenRef.current = false;
    gameOverRef.current = false;
    setMenuOpen(false);
    setGameOver(false);
    setStatusMessage("PREPARE FOR LAUNCH · 3");
    setPausedState(true, "Countdown before launch.", true);
    startCountdown();
    playClick();
  }, [clearPendingDirectionalTap, clearActiveControls, disabled, feedback, finalSubmitReady, setPausedState, startCountdown]);

  const selectAnswerTarget = useCallback((index: number) => {
    if (!canInteract() || index < 0 || index >= latestPropsRef.current.options.length || !mappingsRef.current[index]) return;
    selectedTargetRef.current = index;
    setSelectedTargetIndex(index);
    setStatusMessage(`AIM LOCKED · TARGET ${index + 1} OF ${latestPropsRef.current.options.length}`);
    playClick();
  }, [canInteract]);

  useEffect(() => {
    setPausedState(true, "Mission briefing.", true);
    return () => {
      clearPendingDirectionalTap();
      activeControlsRef.current.clear();
      worldRef.current.heldDirection = 0;
      worldRef.current.boostHeld = false;
      if (countdownTimerRef.current !== null) clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
      countdownRef.current = null;
    };
  }, [setPausedState, clearPendingDirectionalTap]);

  useEffect(() => {
    // Preserve saved difficulty on first mount. React to subsequent session
    // updates only, e.g. when START MISSION regenerates the question pool.
    if (configuredDifficultyRef.current === configuredDifficulty) return;
    configuredDifficultyRef.current = configuredDifficulty;
    if (!configuredDifficulty) return;
    const next = normalizeSpaceShooterDifficulty(configuredDifficulty);
    difficultyRef.current = next;
    setDifficulty(next);
  }, [configuredDifficulty]);

  useEffect(() => {
    const updateSound = () => {
      try { setSoundEnabled(getSettings().sound); } catch { setSoundEnabled(true); }
    };
    window.addEventListener("settings-updated", updateSound);
    window.addEventListener("storage", updateSound);
    return () => {
      window.removeEventListener("settings-updated", updateSound);
      window.removeEventListener("storage", updateSound);
    };
  }, []);

  useEffect(() => {
    const score = getSpaceShooterBestScore(bestScore);
    if (score !== bestScore) setBestScore(score);
    persistBestScore(score);
  }, [bestScore]);

  useEffect(() => {
    const currentLevel = getSpaceShooterLevel(correctScore, difficulty);
    const previousLevel = lastLevelRef.current;
    if (currentLevel > previousLevel && !menuOpen && !gameOver) {
      const notice = currentLevel % 3 === 0
        ? "BOSS INCOMING"
        : previousLevel % 3 === 0
          ? "BOSS DEFEATED · SECTOR CLEARED"
          : `LEVEL ${currentLevel} REACHED`;
      setLevelNotice(notice);
      if (levelNoticeTimerRef.current !== null) clearTimeout(levelNoticeTimerRef.current);
      levelNoticeTimerRef.current = setTimeout(() => {
        setLevelNotice(null);
        levelNoticeTimerRef.current = null;
      }, 1650);
    }
    lastLevelRef.current = currentLevel;
  }, [correctScore, difficulty, menuOpen, gameOver]);

  useEffect(() => () => {
    if (levelNoticeTimerRef.current !== null) clearTimeout(levelNoticeTimerRef.current);
  }, []);

  const fireProjectile = useCallback(() => {
    if (!canInteract()) return;
    const current = latestPropsRef.current;
    const targetIndex = selectedTargetRef.current;
    const mapping = targetIndex === null ? undefined : mappingsRef.current[targetIndex];
    const targetElement = targetIndex === null ? null : targetRefs.current[targetIndex];
    const playfield = playfieldRef.current;
    const world = worldRef.current;

    if (targetIndex === null || !mapping || !targetElement || !playfield || world.width <= 0 || world.height <= 0) {
      setStatusMessage("Aim at an answer target before firing.");
      return;
    }
    if (
      mapping.questionId !== String(current.questionKey) ||
      !Object.is(mapping.optionValue, current.options[targetIndex]?.value) ||
      mapping.gateId.length === 0
    ) {
      setStatusMessage("That target is no longer active. Aim again.");
      return;
    }
    if (world.projectiles.length > 0) {
      setStatusMessage("LASER IN FLIGHT · WAIT FOR IMPACT");
      return;
    }

    const stageRect = playfield.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    if (stageRect.width <= 0 || stageRect.height <= 0 || targetRect.width <= 0 || targetRect.height <= 0) {
      setStatusMessage("The battlefield is resizing. Try firing again.");
      return;
    }
    const targetPoint = {
      x: targetRect.left + targetRect.width / 2 - stageRect.left,
      y: targetRect.top + targetRect.height / 2 - stageRect.top,
    };
    const shipY = Math.max(34, world.height - 42);
    const start = { x: clampSpaceShipX(world.shipX, world.width, SHIP_RADIUS), y: shipY - 19 };
    const velocity = getSpaceAimVelocity(start, targetPoint, PROJECTILE_SPEED);
    world.projectiles.push({
      id: world.nextProjectileId,
      x: start.x,
      y: start.y,
      vx: velocity.x,
      vy: velocity.y,
      ageMs: 0,
      lifetimeMs: PROJECTILE_LIFETIME_MS,
      questionKey: String(current.questionKey),
      targetId: mapping.gateId,
      targetIndex,
      optionValue: mapping.optionValue,
    });
    world.nextProjectileId += 1;
    playSpaceLaser();
    setStatusMessage("LASER FIRED · TRACK THE SHOT TO ITS TARGET");
  }, [canInteract]);



  const resolveProjectileHit = useCallback((projectile: SpaceProjectile) => {
    const current = latestPropsRef.current;
    const mapping = mappingsRef.current[projectile.targetIndex];
    if (
      projectile.questionKey !== String(current.questionKey) ||
      projectile.questionKey !== activeQuestionKeyRef.current ||
      !mapping ||
      mapping.questionId !== projectile.questionKey ||
      mapping.gateId !== projectile.targetId ||
      !Object.is(mapping.optionValue, projectile.optionValue) ||
      pausedRef.current ||
      current.disabled ||
      current.feedback ||
      current.finalSubmitReady ||
      submittedRef.current
    ) return;

    submittedRef.current = true;
    worldRef.current.heldDirection = 0;
    worldRef.current.boostHeld = false;
    clearActiveControls();
    worldRef.current.projectiles.length = 0;
    setStatusMessage("DIRECT HIT · TARGET DESTROYED · CHECKING ANSWER");
    playSpaceExplosion();

    try {
      const accepted = current.onSelectOption(
        mapping.laneIndex,
        mapping.optionValue,
        mapping.gateId,
      );
      if (accepted === false && activeQuestionKeyRef.current === projectile.questionKey) {
        submittedRef.current = false;
        setStatusMessage("The answer was not accepted. Aim and fire again.");
      }
    } catch {
      if (activeQuestionKeyRef.current === projectile.questionKey) {
        submittedRef.current = false;
        setStatusMessage("The answer could not be submitted. Aim and retry.");
      }
    }
  }, []);

  useEffect(() => {
    const nextQuestion = String(questionKey);
    const nextSession = String(sessionKey ?? "default");
    const questionChanged = activeQuestionKeyRef.current !== nextQuestion;
    const sessionChanged = activeSessionKeyRef.current !== nextSession;
    if (!questionChanged && !sessionChanged) return;

    activeQuestionKeyRef.current = nextQuestion;
    activeSessionKeyRef.current = nextSession;
    clearPendingDirectionalTap();
    clearActiveControls();
    submittedRef.current = false;
    worldRef.current.projectiles.length = 0;
    worldRef.current.particles.length = 0;
    worldRef.current.hazards.length = 0;
    worldRef.current.hazardSpawnElapsedMs = 0;
    worldRef.current.invulnerableMs = 0;
    worldRef.current.bossAttackPulseMs = 0;
    worldRef.current.heldDirection = 0;
    worldRef.current.boostHeld = false;
    worldRef.current.shipX = worldRef.current.width / 2;
    selectedTargetRef.current = options.length > 0 ? 0 : null;
    setSelectedTargetIndex(options.length > 0 ? 0 : null);
    if (sessionChanged) {
      finalSubmitInvokedRef.current = false;
      processedFeedbackRef.current = null;
      gameOverRef.current = false;
      livesRef.current = SPACE_SHOOTER_DIFFICULTIES[difficultyRef.current].lives;
      missionScoreRef.current = 0;
      comboRef.current = 0;
      setLives(livesRef.current);
      setMissionScore(0);
      setCombo(0);
      setGameOver(false);
      worldRef.current.level = 1;
      worldRef.current.bossActive = false;
    }
    if (pausedRef.current && countdownRef.current === null) setPausedState(false, "Mission resumed.");
    else setStatusMessage("NEW TARGETS ACQUIRED · AIM AND FIRE");
  }, [questionKey, sessionKey, setPausedState, clearPendingDirectionalTap, clearActiveControls, options.length]);

  useEffect(() => {
    if (!feedback) {
      processedFeedbackRef.current = null;
      return;
    }
    if (selectedOption === null) return;
    const eventKey = `${String(sessionKey ?? "default")}:${String(questionKey)}`;
    if (processedFeedbackRef.current === eventKey) return;
    processedFeedbackRef.current = eventKey;
    worldRef.current.projectiles.length = 0;
    worldRef.current.heldDirection = 0;
    worldRef.current.boostHeld = false;

    if (feedback === "correct") {
      const nextCombo = Math.min(999, comboRef.current + 1);
      comboRef.current = nextCombo;
      setCombo(nextCombo);
      const award = 100 + Math.min(500, (nextCombo - 1) * 10);
      const nextScore = getSpaceShooterBestScore(missionScoreRef.current + award);
      missionScoreRef.current = nextScore;
      setMissionScore(nextScore);
      if (nextScore > bestScore) setBestScore(nextScore);
      setStatusMessage(nextCombo > 1 ? `DIRECT HIT · COMBO ×${nextCombo} · +${award}` : `DIRECT HIT · +${award} POINTS`);
    } else {
      comboRef.current = 0;
      setCombo(0);
      setStatusMessage("WRONG ANSWER · SHIELD DAMAGED");
      damagePlayerRef.current("Your shields are depleted. Retry the mission or return to games.");
    }
  }, [feedback, selectedOption, questionKey, sessionKey, bestScore]);

  useEffect(() => {
    let context: CanvasRenderingContext2D | null = null;
    let frameId: number | null = null;
    let disposed = false;
    const canvas = canvasRef.current;
    const playfield = playfieldRef.current;
    if (!canvas || !playfield) return;

    const resize = () => {
      if (disposed) return;
      const rect = playfield.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const world = worldRef.current;
      const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      world.width = rect.width;
      world.height = rect.height;
      world.pixelRatio = pixelRatio;
      if (world.shipX <= 0) world.shipX = rect.width / 2;
      world.shipX = clampSpaceShipX(world.shipX, rect.width, SHIP_RADIUS);
      canvas.width = Math.round(rect.width * pixelRatio);
      canvas.height = Math.round(rect.height * pixelRatio);
      context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      world.stars = createStars(rect.width, rect.height);
    };

    try {
      context = canvas.getContext("2d");
    } catch {
      context = null;
    }
    if (!context) {
      setRendererError(true);
      return () => {
        disposed = true;
      };
    }

    context.imageSmoothingEnabled = false;
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(resize)
      : null;
    resizeObserver?.observe(playfield);
    window.addEventListener("resize", resize);
    resize();

    const tick = (timestamp: number) => {
      if (disposed || !context) return;
      const world = worldRef.current;
      const elapsedMs = world.lastTimestamp === null
        ? 16
        : Math.min(40, Math.max(0, timestamp - world.lastTimestamp));
      world.lastTimestamp = timestamp;
      const elapsedSeconds = elapsedMs / 1000;
      const current = latestPropsRef.current;

      // The overlay owns presentation while the mission is stopped. Keep timing
      // references fresh but avoid redrawing the procedural background at 60fps.
      if (pausedRef.current || menuOpenRef.current || gameOverRef.current) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      if (!pausedRef.current && !menuOpenRef.current && !gameOverRef.current) {
        const rules = SPACE_SHOOTER_DIFFICULTIES[difficultyRef.current];
        const currentLevel = getSpaceShooterLevel(current.correctScore, difficultyRef.current);
        const bossState = getSpaceShooterBossState(current.correctScore, difficultyRef.current);
        world.level = currentLevel;
        world.bossActive = bossState.active;
        world.bossHealth = bossState.health;
        world.bossMaxHealth = bossState.maximumHealth;
        world.invulnerableMs = Math.max(0, world.invulnerableMs - elapsedMs);
        world.bossAttackPulseMs = Math.max(0, world.bossAttackPulseMs - elapsedMs);

        for (const star of world.stars) {
          star.y += star.speed * elapsedSeconds * (world.boostHeld ? 1.7 : 1);
          if (star.y > world.height + 2) {
            star.y = -2;
            star.x = Math.random() * world.width;
          }
        }

        for (let index = world.particles.length - 1; index >= 0; index -= 1) {
          const particle = world.particles[index]!;
          particle.x += particle.vx * elapsedSeconds;
          particle.y += particle.vy * elapsedSeconds;
          particle.ageMs += elapsedMs;
          if (particle.ageMs >= particle.lifetimeMs) world.particles.splice(index, 1);
        }

        const canSimulateCombat =
          !current.disabled &&
          !current.feedback &&
          !current.finalSubmitReady &&
          !submittedRef.current &&
          activeQuestionKeyRef.current === String(current.questionKey);

        if (canSimulateCombat) {
          world.shipX = clampSpaceShipX(
            world.shipX + world.heldDirection * rules.shipSpeed * (world.boostHeld ? rules.boostMultiplier : 1) * elapsedSeconds,
            world.width,
            SHIP_RADIUS,
          );

          world.hazardSpawnElapsedMs += elapsedMs;
          const regularSpawnInterval = Math.max(540, rules.hazardSpawnMs - (world.level - 1) * 65);
          const spawnInterval = bossState.active ? Math.min(850, regularSpawnInterval) : regularSpawnInterval;
          if (world.hazardSpawnElapsedMs >= spawnInterval && world.hazards.length < MAX_HAZARDS && world.width > 0) {
            world.hazardSpawnElapsedMs %= spawnInterval;
            const size = 22 + Math.random() * 15;
            const bossAttack = bossState.active && !bossState.defeated && Math.random() < 0.68;
            world.hazards.push({
              id: world.nextHazardId++,
              x: bossAttack
                ? clampSpaceShipX(world.width / 2 + (Math.random() - 0.5) * world.width * 0.28, world.width, size / 2)
                : size + Math.random() * Math.max(1, world.width - size * 2),
              y: bossAttack ? Math.max(44, world.height * 0.17) + 24 : -size,
              size,
              speed: bossAttack
                ? rules.hazardSpeed * 1.55 + world.level * 7
                : rules.hazardSpeed + Math.min(90, (world.level - 1) * 7) + Math.random() * 22,
              drift: (Math.random() - 0.5) * (bossAttack ? 42 : 72),
              kind: bossAttack || Math.random() < 0.38 ? "enemy" : "asteroid",
            });
            if (bossAttack) world.bossAttackPulseMs = 480;
          }

          const shipY = Math.max(42, world.height - 42);
          for (let index = world.hazards.length - 1; index >= 0; index -= 1) {
            const hazard = world.hazards[index]!;
            hazard.y += hazard.speed * elapsedSeconds;
            hazard.x = clampSpaceShipX(hazard.x + hazard.drift * elapsedSeconds, world.width, hazard.size / 2);
            if (hazard.y > world.height + hazard.size) {
              world.hazards.splice(index, 1);
              continue;
            }
            if (doesSpaceHazardHitShip({
              hazardX: hazard.x,
              hazardY: hazard.y,
              hazardSize: hazard.size,
              shipX: world.shipX,
              shipY,
              shipRadius: SHIP_RADIUS,
              invulnerableMs: world.invulnerableMs,
            })) {
              createHitParticles(world, hazard.x, hazard.y);
              world.hazards.splice(index, 1);
              damagePlayerRef.current("Ship destroyed by space hazards.");
              if (gameOverRef.current || pausedRef.current) break;
            }
          }

          const stageRect = playfield.getBoundingClientRect();
          for (let index = world.projectiles.length - 1; index >= 0; index -= 1) {
            const projectile = world.projectiles[index]!;
            const oldPoint = { x: projectile.x, y: projectile.y };
            const next = advanceSpaceProjectile(projectile, elapsedMs);
            projectile.x = next.x;
            projectile.y = next.y;
            projectile.ageMs = next.ageMs;

            const target = targetRefs.current[projectile.targetIndex];
            const mapping = mappingsRef.current[projectile.targetIndex];
            let didHit = false;
            if (
              target &&
              mapping &&
              projectile.questionKey === String(current.questionKey) &&
              projectile.targetId === mapping.gateId &&
              mapping.questionId === projectile.questionKey
            ) {
              // Read the live DOM rect each frame. CSS floating transforms therefore
              // move both the visible sprite and its collision rectangle together.
              // The projectile still resolves only against its immutable target ID.
              const targetRect = target.getBoundingClientRect();
              if (targetRect.width > 0 && targetRect.height > 0) {
                const collisionRect: SpaceRect = {
                  x: targetRect.left - stageRect.left,
                  y: targetRect.top - stageRect.top,
                  width: targetRect.width,
                  height: targetRect.height,
                };
                didHit = sweptSpaceProjectileHitsRect(oldPoint, projectile, collisionRect, 2);
                if (didHit) {
                  createHitParticles(
                    world,
                    collisionRect.x + collisionRect.width / 2,
                    collisionRect.y + collisionRect.height / 2,
                  );
                  world.projectiles.splice(index, 1);
                  resolveProjectileHit(projectile);
                  break;
                }
              }
            }

            if (
              next.expired ||
              projectile.x < -24 ||
              projectile.x > world.width + 24 ||
              projectile.y < -24 ||
              projectile.y > world.height + 24
            ) {
              world.projectiles.splice(index, 1);
            } else if (didHit) {
              world.projectiles.splice(index, 1);
            }
          }
        }
      }

      drawSpaceFrame(context, world);
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    setRendererError(false);

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [rendererAttempt, resolveProjectileHit]);

  useEffect(() => {
    void setGameImmersiveMode(true).catch(() => undefined);
    return () => {
      clearPendingDirectionalTap();
      worldRef.current.projectiles.length = 0;
      worldRef.current.particles.length = 0;
      worldRef.current.heldDirection = 0;
      if (pausedRef.current) latestPropsRef.current.onPauseChange?.(false);
      void setGameImmersiveMode(false).catch(() => undefined);
    };
  }, [clearPendingDirectionalTap]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("button, input, textarea, select, [contenteditable='true']")) return;
      if (!canInteract()) return;
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        event.preventDefault();
        beginControl("keyboard:left", "left");
      } else if (key === "arrowright" || key === "d") {
        event.preventDefault();
        beginControl("keyboard:right", "right");
      } else if (key === "shift" || key === "x") {
        event.preventDefault();
        beginControl("keyboard:boost", "boost");
      } else if (event.code === "Space") {
        event.preventDefault();
        fireProjectile();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a") endControl("keyboard:left");
      if (key === "arrowright" || key === "d") endControl("keyboard:right");
      if (key === "shift" || key === "x") endControl("keyboard:boost");
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        cancelCountdown();
        clearActiveControls();
        setPausedState(true, "Paused while the app is in the background.", true);
      }
    };
    const onWindowBlur = () => {
      cancelCountdown();
      clearActiveControls();
      setPausedState(true, "Paused after the app lost focus.", true);
    };
    const onGlobalPointerUp = (event: PointerEvent) => endControl(event.pointerId);
    const onGlobalPointerCancel = (event: PointerEvent) => endControl(event.pointerId);
    const onGlobalKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a") endControl("keyboard:left");
      if (key === "arrowright" || key === "d") endControl("keyboard:right");
      if (key === "shift" || key === "x") endControl("keyboard:boost");
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("pointerup", onGlobalPointerUp);
    window.addEventListener("pointercancel", onGlobalPointerCancel);
    window.addEventListener("keyup", onGlobalKeyUp);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      activeControlsRef.current.clear();
      worldRef.current.heldDirection = 0;
      worldRef.current.boostHeld = false;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("pointerup", onGlobalPointerUp);
      window.removeEventListener("pointercancel", onGlobalPointerCancel);
      window.removeEventListener("keyup", onGlobalKeyUp);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [canInteract, fireProjectile, setPausedState, clearActiveControls, endControl, beginControl, cancelCountdown]);

  const handlePointerControlDown = (event: ReactPointerEvent<HTMLButtonElement>, action: SpaceControlAction) => {
    event.preventDefault();
    if (!canInteract()) return;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Some WebViews omit pointer capture. */ }
    beginControl(event.pointerId, action);
  };

  const handlePointerControlEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    endControl(event.pointerId);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { /* Capture may have been released by the platform. */ }
  };

  const handleControlKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, action: SpaceControlAction) => {
    const key = event.key.toLowerCase();
    const expected = action === "left" ? ["arrowleft", "a"] : action === "right" ? ["arrowright", "d"] : ["shift", "x"];
    if (!expected.includes(key)) return;
    event.preventDefault();
    if (event.repeat) return;
    beginControl(`keyboard:${action}`, action);
  };

  const handleControlClick = (event: ReactMouseEvent<HTMLButtonElement>, action: SpaceControlAction) => {
    // Pointer holds are handled by Pointer Events. A synthesized keyboard/switch click
    // should remain useful without creating an indefinitely-held steering direction.
    if (event.detail !== 0 || !canInteract()) return;
    if (action === "left" || action === "right") {
      const direction = action === "left" ? -1 : 1;
      worldRef.current.shipX = clampSpaceShipX(
        worldRef.current.shipX + direction * 52,
        worldRef.current.width,
        SHIP_RADIUS,
      );
      setStatusMessage(action === "left" ? "SHIP STEERED LEFT" : "SHIP STEERED RIGHT");
      return;
    }
    const id = "keyboard:boost";
    if (activeControlsRef.current.has(id)) endControl(id);
    else beginControl(id, action);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    try { setSound(next); } catch { /* Audio setting cannot block gameplay. */ }
    setSoundEnabled(next);
    playClick();
  };

  const restartMission = () => {
    cancelCountdown();
    clearActiveControls();
    clearPendingDirectionalTap();
    worldRef.current.projectiles.length = 0;
    worldRef.current.hazards.length = 0;
    worldRef.current.particles.length = 0;
    menuOpenRef.current = false;
    setMenuOpen(false);
    if (onRestartGame) onRestartGame();
    else {
      gameOverRef.current = false;
      setGameOver(false);
      setLives(difficultyRef.current ? SPACE_SHOOTER_DIFFICULTIES[difficultyRef.current].lives : 4);
      livesRef.current = SPACE_SHOOTER_DIFFICULTIES[difficultyRef.current].lives;
      setCombo(0);
      comboRef.current = 0;
      setMissionScore(0);
      missionScoreRef.current = 0;
      setPausedState(false, "MISSION RESTARTED");
    }
  };

  const choosePause = () => {
    if (pausedRef.current) {
      setPausedState(false, "Mission resumed.");
    } else if (canInteract()) {
      setPausedState(true, "Mission paused. Your quiz timer is frozen.");
    }
  };

  const handleChangeGame = () => {
    cancelCountdown();
    if (pausedRef.current) setPausedState(false, "Opening game selection.");
    latestPropsRef.current.onChangeGame?.();
  };

  const handleFinalSubmit = () => {
    const current = latestPropsRef.current;
    if (current.disabled || pausedRef.current || menuOpenRef.current || gameOverRef.current || finalSubmitInvokedRef.current || submittedRef.current) return;
    finalSubmitInvokedRef.current = true;
    submittedRef.current = true;
    clearPendingDirectionalTap();
    clearActiveControls();
    worldRef.current.projectiles.length = 0;
    worldRef.current.hazards.length = 0;
    playClick();
    try {
      const accepted = current.onFinalSubmit();
      if (accepted === false) {
        finalSubmitInvokedRef.current = false;
        submittedRef.current = false;
        setStatusMessage("TEST SUBMISSION BLOCKED · TRY AGAIN AFTER ANSWER FEEDBACK");
      }
    } catch {
      finalSubmitInvokedRef.current = false;
      submittedRef.current = false;
      setStatusMessage("TEST SUBMISSION FAILED · YOUR QUIZ IS STILL ACTIVE");
    }
  };

  const submissionBlocked = disabled || !!feedback || finalSubmitReady || submittedRef.current;
  const leaveBlocked = submissionBlocked || paused;
  const restartBlocked = disabled || !!feedback || submittedRef.current;
  const difficultyConfig = SPACE_SHOOTER_DIFFICULTIES[difficulty];
  const level = getSpaceShooterLevel(correctScore, difficulty);
  const boss = getSpaceShooterBossState(correctScore, difficulty);
  const targetCount = Math.max(1, options.length);

  return (
    <section
      className={`mcq-space-shell${paused || disabled || !!feedback || finalSubmitReady || submittedRef.current || finalSubmitInvokedRef.current ? " is-frozen" : ""}`}
      aria-label="Math Space Shooter"
    >
      <header className="mcq-space-topbar">
        <button
          type="button"
          className="mcq-space-icon-button"
          onClick={handleChangeGame}
          disabled={!onChangeGame || leaveBlocked}
          aria-label="Return to game selection"
        >
          <ArrowLeft size={19} aria-hidden="true" />
        </button>
        <div className="mcq-space-brand">
          <span className="mcq-space-brand-icon"><Rocket size={17} aria-hidden="true" /></span>
          <span>
            <strong>MATH SPACE SHOOTER</strong>
            <small>MISSION CONTROL</small>
          </span>
        </div>
        <div className="mcq-space-top-actions">
          <button
            type="button"
            className="mcq-space-submit"
            onClick={handleFinalSubmit}
            disabled={disabled || paused || menuOpen || gameOver || finalSubmitInvokedRef.current}
            aria-label="Submit complete test"
            data-testid="space-submit-test"
          >
            <Trophy size={15} aria-hidden="true" />
            <span>SUBMIT TEST</span>
          </button>
          <button
            type="button"
            className="mcq-space-icon-button"
            onClick={choosePause}
            disabled={menuOpen || gameOver || countdown !== null || (!paused && !canInteract())}
            aria-label={paused && !menuOpen && !gameOver ? "Resume game" : "Pause game"}
          >
            {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <section className="mcq-space-hud" aria-label="Mission status">
        <div className="mcq-space-question">
          <span className="mcq-space-eyebrow"><Zap size={12} aria-hidden="true" /> {difficultyConfig.label} · LEVEL {level}</span>
          <div className="mcq-space-question-label">{questionLabel}</div>
        </div>
        <div className="mcq-space-stats">
          <span className="mcq-space-stat mcq-space-stat--score" aria-label={`Mission score ${missionScore}`}>★ {missionScore}</span>
          <span className="mcq-space-stat mcq-space-stat--correct" aria-label={`${correctScore} correct answers`}><span aria-hidden="true">✓</span> {correctScore}</span>
          <span className="mcq-space-stat mcq-space-stat--wrong" aria-label={`${wrongScore} incorrect answers`}><span aria-hidden="true">×</span> {wrongScore}</span>
          <span className="mcq-space-stat mcq-space-stat--shield" aria-label={`${lives} shields remaining`}><Shield size={12} aria-hidden="true" /> {lives}</span>
          <span className="mcq-space-stat" aria-label={`Combo ${combo}`}>COMBO {combo}</span>
          {bestScore > 0 && <span className="mcq-space-stat" aria-label={`Best score ${bestScore}`}>BEST {bestScore}</span>}
          {progressLabel && <span className="mcq-space-stat" aria-label={`Question ${progressLabel}`}>{progressLabel}</span>}
          {timerLabel && <span className="mcq-space-stat mcq-space-stat--timer" aria-label={`Time remaining ${timerLabel}`}><Timer size={13} aria-hidden="true" /> {timerLabel}</span>}
        </div>
      </section>

      <div className="mcq-space-playfield" ref={playfieldRef} role="group" aria-label="Space battlefield">
        <canvas ref={canvasRef} className="mcq-space-canvas" aria-hidden="true" />
        <div className="mcq-space-playfield-overline" aria-hidden="true">
          <span>LEVEL {level}</span>
          {boss.active && <span className="mcq-space-boss-tag">BOSS · {boss.health}/{boss.maximumHealth} HP</span>}
        </div>
        <div className="mcq-space-target-grid" role="group" aria-label="Mathematical answer targets" style={{ gridTemplateColumns: `repeat(${targetCount}, minmax(0, 1fr))` }}>
          {options.map((option, index) => {
            const mapping = mappings[index];
            const feedbackClass = feedback && selectedOption === index
              ? (feedback === "correct" ? " is-destroyed" : " is-hit-wrong")
              : "";
            return (
              <button
                type="button"
                key={mapping?.gateId ?? `${String(questionKey)}-${index}`}
                ref={(element) => { targetRefs.current[index] = element; }}
                className={`mcq-space-target mcq-space-target--${index % 4}${selectedTargetIndex === index ? " is-aimed" : ""}${feedbackClass}`}
                onClick={() => selectAnswerTarget(index)}
                disabled={!canInteract()}
                aria-label={`Aim at answer ${index + 1}: ${String(option.value)}`}
                aria-pressed={selectedTargetIndex === index}
                aria-current={selectedTargetIndex === index ? "true" : undefined}
                data-target-id={mapping?.gateId}
                data-testid={`space-target-${index}`}
              >
                <span className="mcq-space-target-label">{option.label}</span>
                <span className="mcq-space-target-spark" aria-hidden="true">{feedback && selectedOption === index ? (feedback === "correct" ? "✓" : "×") : "✦"}</span>
              </button>
            );
          })}
        </div>
        <div className="mcq-space-status" role="status" aria-live="polite">{statusMessage}</div>
        {levelNotice !== null && !paused && !menuOpen && !gameOver && (
          <div className="mcq-space-level-notice" role="status" aria-live="polite">
            {levelNotice.includes("BOSS INCOMING") ? "⚠ " : ""}{levelNotice}
          </div>
        )}

        {rendererError && (
          <div className="mcq-space-renderer-error" role="alert">
            <Rocket size={30} aria-hidden="true" />
            <strong>Space graphics could not start</strong>
            <span>Retry the renderer or return to game selection. Your quiz progress is unchanged.</span>
            <button type="button" onClick={() => setRendererAttempt((attempt) => attempt + 1)}>Retry graphics</button>
            <button type="button" onClick={() => onChangeGame?.()} disabled={!onChangeGame}>Back to games</button>
          </div>
        )}
      </div>

      <footer className="mcq-space-controls" aria-label="Spacecraft controls">
        <div className="mcq-space-control-row">
          <button
            type="button"
            className={`mcq-space-move-button mcq-space-steer-button${heldControls.left ? " is-active" : ""}`}
            onPointerDown={(event) => handlePointerControlDown(event, "left")}
            onPointerUp={handlePointerControlEnd}
            onPointerCancel={handlePointerControlEnd}
            onLostPointerCapture={(event) => endControl(event.pointerId)}
            onKeyDown={(event) => handleControlKeyDown(event, "left")}
            onKeyUp={(event) => { const key = event.key.toLowerCase(); if (key === "arrowleft" || key === "a") endControl("keyboard:left"); }}
            onClick={(event) => handleControlClick(event, "left")}
            onContextMenu={(event) => event.preventDefault()}
            disabled={!canInteract()}
            aria-label="Steer spaceship left"
            aria-pressed={heldControls.left}
            data-testid="space-control-left"
          >◀ LEFT</button>
          <button
            type="button"
            className={`mcq-space-shoot-button`}
            onClick={fireProjectile}
            disabled={!canInteract()}
            aria-label="Fire laser at selected answer"
            data-testid="space-control-fire"
          ><span aria-hidden="true">✦</span> FIRE</button>
          <button
            type="button"
            className={`mcq-space-boost-button${heldControls.boost ? " is-active" : ""}`}
            onPointerDown={(event) => handlePointerControlDown(event, "boost")}
            onPointerUp={handlePointerControlEnd}
            onPointerCancel={handlePointerControlEnd}
            onLostPointerCapture={(event) => endControl(event.pointerId)}
            onKeyDown={(event) => handleControlKeyDown(event, "boost")}
            onKeyUp={(event) => { const key = event.key.toLowerCase(); if (key === "shift" || key === "x") endControl("keyboard:boost"); }}
            onClick={(event) => handleControlClick(event, "boost")}
            onContextMenu={(event) => event.preventDefault()}
            disabled={!canInteract()}
            aria-label="Hold to boost spaceship speed"
            aria-pressed={heldControls.boost}
            data-testid="space-control-boost"
          ><Zap size={17} aria-hidden="true" /><span>BOOST</span></button>
          <button
            type="button"
            className={`mcq-space-move-button mcq-space-steer-button${heldControls.right ? " is-active" : ""}`}
            onPointerDown={(event) => handlePointerControlDown(event, "right")}
            onPointerUp={handlePointerControlEnd}
            onPointerCancel={handlePointerControlEnd}
            onLostPointerCapture={(event) => endControl(event.pointerId)}
            onKeyDown={(event) => handleControlKeyDown(event, "right")}
            onKeyUp={(event) => { const key = event.key.toLowerCase(); if (key === "arrowright" || key === "d") endControl("keyboard:right"); }}
            onClick={(event) => handleControlClick(event, "right")}
            onContextMenu={(event) => event.preventDefault()}
            disabled={!canInteract()}
            aria-label="Steer spaceship right"
            aria-pressed={heldControls.right}
            data-testid="space-control-right"
          >RIGHT ▶</button>
        </div>
        <div className="mcq-space-controls-hint">
          <span>HOLD LEFT / RIGHT TO STEER</span><span aria-hidden="true">◆</span><span>HOLD BOOST TO ACCELERATE</span>
          {onRestartGame && (
            <button
              type="button"
              className="mcq-space-restart"
              onClick={restartMission}
              disabled={restartBlocked}
              aria-label="Restart mission"
            >
              <RotateCcw size={13} aria-hidden="true" /> Restart
            </button>
          )}
        </div>
      </footer>

      {menuOpen && (
        <div className="mcq-space-menu-scrim" role="dialog" aria-modal="true" aria-labelledby="mcq-space-menu-title">
          <div className="mcq-space-menu-card">
            <div className="mcq-space-menu-logo"><Rocket size={32} aria-hidden="true" /></div>
            <p className="mcq-space-menu-eyebrow">ARCADE MISSION SYSTEM</p>
            <h1 id="mcq-space-menu-title">MATH SPACE SHOOTER</h1>
            <p className="mcq-space-menu-subtitle">Lock on to the answer. Fire to solve. Defend your ship.</p>
            <div className="mcq-space-difficulty-picker" role="group" aria-label="Mission difficulty">
              {(["easy", "medium", "hard"] as const).map((levelChoice) => (
                <button key={levelChoice} type="button" className={`mcq-space-difficulty-button${difficulty === levelChoice ? " is-selected" : ""}`} aria-pressed={difficulty === levelChoice} onClick={() => handleDifficultySelect(levelChoice)} data-testid={`space-difficulty-${levelChoice}`}>
                  <strong>{levelChoice === "easy" ? "CADET" : levelChoice === "medium" ? "PILOT" : "ACE"}</strong>
                  <span>{levelChoice === "easy" ? "5 SHIELDS" : levelChoice === "medium" ? "4 SHIELDS" : "3 SHIELDS"}</span>
                </button>
              ))}
            </div>
            <div className="mcq-space-menu-stats">
              <span><Trophy size={15} aria-hidden="true" /> BEST {bestScore}</span>
              <span><Shield size={15} aria-hidden="true" /> {difficultyConfig.lives} SHIELDS</span>
              <span><Zap size={15} aria-hidden="true" /> {difficultyConfig.boostMultiplier.toFixed(2)}× BOOST</span>
            </div>
            {!showInstructions ? (
              <>
                <button type="button" className="mcq-space-menu-primary" onClick={startMission} disabled={disabled || !!feedback || finalSubmitReady} data-testid="space-start-mission"><Play size={20} aria-hidden="true" /> START MISSION</button>
                <button type="button" className="mcq-space-menu-secondary" onClick={() => setShowInstructions(true)}><BookOpen size={17} aria-hidden="true" /> HOW TO PLAY</button>
              </>
            ) : (
              <div className="mcq-space-instructions">
                <h2>HOW TO PLAY</h2>
                <p><strong>1.</strong> Choose an answer target or steer your spaceship left/right.</p>
                <p><strong>2.</strong> Tap <strong>FIRE</strong> to launch a laser. Only a real collision submits the active quiz answer.</p>
                <p><strong>3.</strong> Hold <strong>BOOST</strong> while steering. Asteroids and enemy ships damage shields.</p>
                <p><strong>4.</strong> Correct answers build score and combo. Reach level 3 for a boss encounter.</p>
                <button type="button" className="mcq-space-menu-secondary" onClick={() => setShowInstructions(false)}>BACK TO MISSION BRIEFING</button>
              </div>
            )}
            <button type="button" className="mcq-space-menu-secondary mcq-space-sound-toggle" onClick={toggleSound} aria-pressed={soundEnabled}>
              {soundEnabled ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />} SOUND {soundEnabled ? "ON" : "OFF"}
            </button>
            {onChangeGame && <button type="button" className="mcq-space-menu-exit" onClick={handleChangeGame}><ArrowLeft size={16} aria-hidden="true" /> BACK TO GAMES</button>}
          </div>
        </div>
      )}

      {(gameOver || (finalSubmitReady && !menuOpen)) && (
        <div className="mcq-space-menu-scrim" role="dialog" aria-modal="true" aria-labelledby="mcq-space-result-title">
          <div className="mcq-space-menu-card mcq-space-result-card">
            <div className="mcq-space-menu-logo">{gameOver ? <Shield size={30} aria-hidden="true" /> : <Trophy size={30} aria-hidden="true" />}</div>
            <p className="mcq-space-menu-eyebrow">{gameOver ? "MISSION FAILED" : "MISSION COMPLETE"}</p>
            <h2 id="mcq-space-result-title">{gameOver ? "SHIP DESTROYED" : "SECTOR CLEARED"}</h2>
            <div className="mcq-space-results-stats">
              <span>MISSION SCORE<strong>{missionScore}</strong></span>
              <span>COMBO<strong>{combo}</strong></span>
              <span>SHIELDS<strong>{lives}</strong></span>
              <span>BEST SCORE<strong>{bestScore}</strong></span>
            </div>
            <p>{gameOver ? "Your shields are depleted. Retry the mission or return to the game selector." : "Excellent work, pilot. Submit the quiz when you are ready."}</p>
            {onRestartGame && <button type="button" className="mcq-space-menu-primary" onClick={restartMission}><RotateCcw size={18} aria-hidden="true" /> RETRY MISSION</button>}
            {finalSubmitReady && <button type="button" className="mcq-space-menu-secondary" onClick={handleFinalSubmit}><Trophy size={17} aria-hidden="true" /> SUBMIT TEST</button>}
            {onChangeGame && <button type="button" className="mcq-space-menu-secondary" onClick={handleChangeGame} disabled={!!feedback || submittedRef.current}><ArrowLeft size={16} aria-hidden="true" /> BACK TO GAMES</button>}
          </div>
        </div>
      )}

      {countdown !== null && !menuOpen && !gameOver && (
        <div className="mcq-space-countdown-scrim" role="status" aria-label="Mission start countdown" aria-live="assertive">
          <div className="mcq-space-countdown-card">
            <span className="mcq-space-countdown-label">SYSTEMS ONLINE</span>
            <strong key={countdown}>{countdown === 0 ? "GO!" : countdown}</strong>
            <span className="mcq-space-countdown-subtitle">PREPARE FOR LAUNCH</span>
          </div>
        </div>
      )}

      {paused && !menuOpen && !gameOver && countdown === null && (
        <div className="mcq-space-pause-scrim">
          <section className="mcq-space-pause-card" role="dialog" aria-modal="true" aria-labelledby="mcq-space-paused-title">
            <span className="mcq-space-pause-icon"><Pause size={24} aria-hidden="true" /></span>
            <h2 id="mcq-space-paused-title">Mission paused</h2>
            <p>Your ship and quiz timer are safely paused.</p>
            <button type="button" className="mcq-space-resume" onClick={() => setPausedState(false, "Mission resumed.")}>
              <Play size={17} aria-hidden="true" /> Resume mission
            </button>
            {onRestartGame && (
              <button
                type="button"
                className="mcq-space-pause-secondary"
                onClick={() => onRestartGame()}
                disabled={restartBlocked}
              >
                <RotateCcw size={16} aria-hidden="true" /> Restart quiz
              </button>
            )}
            {onChangeGame && (
              <button
                type="button"
                className="mcq-space-pause-secondary"
                onClick={handleChangeGame}
                disabled={submissionBlocked}
              >
                <ArrowLeft size={16} aria-hidden="true" /> Back to game selection
              </button>
            )}
          </section>
        </div>
      )}
    </section>
  );
};

export default MCQSpaceShooter;
