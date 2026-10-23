import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, Pause, Play, RotateCcw, Rocket, Timer, Trophy, Zap } from "lucide-react";
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

interface SpaceWorld {
  width: number;
  height: number;
  pixelRatio: number;
  shipX: number;
  heldDirection: -1 | 0 | 1;
  stars: SpaceStar[];
  projectiles: SpaceProjectile[];
  particles: SpaceParticle[];
  nextProjectileId: number;
  lastTimestamp: number | null;
}

const PROJECTILE_SPEED = 690;
const PROJECTILE_LIFETIME_MS = 1500;
const DOUBLE_TAP_WINDOW_MS = 280;
const MAX_PARTICLES = 48;
const SHIP_RADIUS = 24;

const createWorld = (): SpaceWorld => ({
  width: 0,
  height: 0,
  pixelRatio: 1,
  shipX: 0,
  heldDirection: 0,
  stars: [],
  projectiles: [],
  particles: [],
  nextProjectileId: 1,
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
}: MCQSpaceShooterProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playfieldRef = useRef<HTMLDivElement | null>(null);
  const targetRefs = useRef<Array<HTMLDivElement | null>>([]);
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
  };

  const mappings = useMemo(
    () => createMCQGateMappings(questionKey, options.map((option) => option.value)),
    [questionKey, options],
  );
  const mappingsRef = useRef(mappings);
  mappingsRef.current = mappings;

  const [selectedTargetIndex, setSelectedTargetIndex] = useState<number | null>(options.length > 0 ? 0 : null);
  const [paused, setPaused] = useState(false);
  const [statusMessage, setStatusMessage] = useState("SINGLE TAP LEFT/RIGHT TO AIM · DOUBLE TAP TO FIRE");
  const [rendererError, setRendererError] = useState(false);
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const pausedRef = useRef(false);
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
      !current.disabled &&
      !current.feedback &&
      !current.finalSubmitReady &&
      !submittedRef.current &&
      !finalSubmitInvokedRef.current &&
      activeQuestionKeyRef.current === String(current.questionKey)
    );
  }, []);

  const setPausedState = useCallback((nextPaused: boolean, message: string, force = false) => {
    if (nextPaused && !force) {
      const current = latestPropsRef.current;
      if (current.disabled || current.feedback || current.finalSubmitReady || submittedRef.current) return;
    }
    if (pausedRef.current === nextPaused) return;
    pausedRef.current = nextPaused;
    clearPendingDirectionalTap();
    worldRef.current.heldDirection = 0;
    worldRef.current.lastTimestamp = null;
    setPaused(nextPaused);
    setStatusMessage(message);
    latestPropsRef.current.onPauseChange?.(nextPaused);
  }, [clearPendingDirectionalTap]);

  const moveAim = useCallback((direction: -1 | 1) => {
    const current = latestPropsRef.current;
    const count = current.options.length;
    if (!canInteract() || count === 0) return;
    const previous = selectedTargetRef.current;
    const next = previous === null
      ? (direction > 0 ? 0 : count - 1)
      : Math.max(0, Math.min(count - 1, previous + direction));
    if (next === previous) {
      setStatusMessage(direction < 0 ? "LEFT EDGE REACHED" : "RIGHT EDGE REACHED");
      return;
    }
    if (!mappingsRef.current[next]) return;
    selectedTargetRef.current = next;
    setSelectedTargetIndex(next);
    setStatusMessage("AIM LOCKED · TARGET " + String(next + 1) + " OF " + String(count));
  }, [canInteract]);

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

  const handleDirectionalTap = useCallback((direction: -1 | 1) => {
    if (!canInteract()) return;
    const pending = pendingDirectionalTapRef.current;
    if (pending) {
      clearTimeout(pending.timer);
      pendingDirectionalTapRef.current = null;
      if (pending.direction === direction) {
        // Cancel the deferred single tap so one double tap fires only once.
        fireProjectile();
        return;
      }
      moveAim(pending.direction);
    }
    const timer = setTimeout(() => {
      if (pendingDirectionalTapRef.current?.timer !== timer) return;
      pendingDirectionalTapRef.current = null;
      moveAim(direction);
    }, DOUBLE_TAP_WINDOW_MS);
    pendingDirectionalTapRef.current = { direction, timer };
  }, [canInteract, fireProjectile, moveAim]);

  const handleAimControlKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") {
      event.preventDefault();
      clearPendingDirectionalTap();
      moveAim(-1);
    } else if (key === "arrowright" || key === "d") {
      event.preventDefault();
      clearPendingDirectionalTap();
      moveAim(1);
    } else if (event.code === "Space" || event.key === "Enter") {
      event.preventDefault();
      clearPendingDirectionalTap();
      fireProjectile();
    }
  };

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
    worldRef.current.projectiles.length = 0;
    setStatusMessage("DIRECT HIT · ASTEROID DESTROYED · CHECKING ANSWER");
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
    submittedRef.current = false;
    worldRef.current.projectiles.length = 0;
    worldRef.current.particles.length = 0;
    worldRef.current.heldDirection = 0;
    worldRef.current.shipX = worldRef.current.width / 2;
    selectedTargetRef.current = options.length > 0 ? 0 : null;
    setSelectedTargetIndex(options.length > 0 ? 0 : null);
    if (sessionChanged) finalSubmitInvokedRef.current = false;
    if (pausedRef.current) setPausedState(false, "Mission resumed.");
    else setStatusMessage("NEW TARGETS ACQUIRED · TAP LEFT/RIGHT ONCE TO AIM");
  }, [questionKey, sessionKey, setPausedState, clearPendingDirectionalTap, options.length]);

  useEffect(() => {
    if (!feedback) return;
    worldRef.current.projectiles.length = 0;
    worldRef.current.heldDirection = 0;
    setStatusMessage(feedback === "correct" ? "Correct hit! Excellent piloting." : "Target hit. Review the answer feedback.");
  }, [feedback]);

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

      if (!pausedRef.current) {
        for (const star of world.stars) {
          star.y += star.speed * elapsedSeconds;
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

        if (
          !current.disabled &&
          !current.feedback &&
          !current.finalSubmitReady &&
          !submittedRef.current &&
          activeQuestionKeyRef.current === String(current.questionKey)
        ) {
          world.shipX = clampSpaceShipX(
            world.shipX + world.heldDirection * 265 * elapsedSeconds,
            world.width,
            SHIP_RADIUS,
          );

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
    const stopMovement = () => {
      worldRef.current.heldDirection = 0;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("button, input, textarea, select, [contenteditable='true']")) return;
      if (!canInteract()) return;
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        moveAim(-1);
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        moveAim(1);
      } else if (event.code === "Space") {
        event.preventDefault();
        fireProjectile();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key.toLowerCase() === "a" ||
        event.key.toLowerCase() === "d"
      ) stopMovement();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        stopMovement();
        setPausedState(true, "Paused while the app is in the background.", true);
      }
    };
    const onWindowBlur = () => {
      stopMovement();
      setPausedState(true, "Paused after the app lost focus.", true);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopMovement();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [canInteract, fireProjectile, moveAim, setPausedState]);

  const choosePause = () => {
    if (pausedRef.current) {
      setPausedState(false, "Mission resumed.");
    } else if (canInteract()) {
      setPausedState(true, "Mission paused. Your quiz timer is frozen.");
    }
  };

  const handleChangeGame = () => {
    if (pausedRef.current) setPausedState(false, "Opening game selection.");
    latestPropsRef.current.onChangeGame?.();
  };

  const handleFinalSubmit = () => {
    const current = latestPropsRef.current;
    if (current.disabled || finalSubmitInvokedRef.current || submittedRef.current) return;
    finalSubmitInvokedRef.current = true;
    submittedRef.current = true;
    clearPendingDirectionalTap();
    worldRef.current.heldDirection = 0;
    worldRef.current.projectiles.length = 0;
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
            disabled={disabled || finalSubmitInvokedRef.current}
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
            disabled={!paused && !canInteract()}
            aria-label={paused ? "Resume game" : "Pause game"}
          >
            {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <section className="mcq-space-hud" aria-label="Mission status">
        <div className="mcq-space-question">
          <span className="mcq-space-eyebrow"><Zap size={12} aria-hidden="true" /> TARGET QUESTION</span>
          <div className="mcq-space-question-label">{questionLabel}</div>
        </div>
        <div className="mcq-space-stats">
          <span className="mcq-space-stat mcq-space-stat--correct" aria-label={`${correctScore} correct answers`}>
            <span aria-hidden="true">✓</span> {correctScore}
          </span>
          <span className="mcq-space-stat mcq-space-stat--wrong" aria-label={`${wrongScore} incorrect answers`}>
            <span aria-hidden="true">×</span> {wrongScore}
          </span>
          {progressLabel && <span className="mcq-space-stat" aria-label={`Question ${progressLabel}`}>{progressLabel}</span>}
          {timerLabel && <span className="mcq-space-stat mcq-space-stat--timer" aria-label={`Time remaining ${timerLabel}`}><Timer size={13} aria-hidden="true" /> {timerLabel}</span>}
        </div>
      </section>

      <div className="mcq-space-playfield" ref={playfieldRef} role="group" aria-label="Space battlefield">
        <canvas ref={canvasRef} className="mcq-space-canvas" aria-hidden="true" />
        <button
          type="button"
          className="mcq-space-touch-zone mcq-space-touch-zone--left"
          onPointerUp={(event) => { event.preventDefault(); event.currentTarget.blur(); handleDirectionalTap(-1); }}
          onContextMenu={(event) => event.preventDefault()}
          disabled={!canInteract()}
          aria-label="Left touch zone: single tap moves aim left, double tap fires at aimed target"
          onKeyDown={handleAimControlKeyDown}
          data-testid="space-touch-left"
        />
        <button
          type="button"
          className="mcq-space-touch-zone mcq-space-touch-zone--right"
          onPointerUp={(event) => { event.preventDefault(); event.currentTarget.blur(); handleDirectionalTap(1); }}
          onContextMenu={(event) => event.preventDefault()}
          disabled={!canInteract()}
          aria-label="Right touch zone: single tap moves aim right, double tap fires at aimed target"
          onKeyDown={handleAimControlKeyDown}
          data-testid="space-touch-right"
        />
        <div className="mcq-space-target-grid" role="group" aria-label="Mathematical answer targets" style={{ gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))` }}>
          {options.map((option, index) => {
            const mapping = mappings[index];
            return (
              <div
                key={mapping?.gateId ?? `${String(questionKey)}-${index}`}
                ref={(element) => { targetRefs.current[index] = element; }}
                className={`mcq-space-target mcq-space-target--${index % 4}${selectedTargetIndex === index ? " is-aimed" : ""}`}
                role="img"
                aria-label={`Answer target ${index + 1}: ${String(option.value)}${selectedTargetIndex === index ? ", aim locked" : ""}`}
                aria-current={selectedTargetIndex === index ? "true" : undefined}
                data-target-id={mapping?.gateId}
                data-testid={`space-target-${index}`}
              >
                <span className="mcq-space-target-label">{option.label}</span>
                <span className="mcq-space-target-spark" aria-hidden="true">✦</span>
              </div>
            );
          })}
        </div>
        <div className="mcq-space-status" role="status" aria-live="polite">{statusMessage}</div>

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

      <footer className="mcq-space-controls">
        <div className="mcq-space-controls-hint">
          <span>SINGLE TAP · MOVE AIM</span><span aria-hidden="true">◆</span>
          <span>DOUBLE TAP · FIRE LASER</span>
          {onRestartGame && (
            <button
              type="button"
              className="mcq-space-restart"
              onClick={() => onRestartGame()}
              disabled={restartBlocked}
              aria-label="Restart quiz"
            >
              <RotateCcw size={13} aria-hidden="true" /> Restart
            </button>
          )}
        </div>
      </footer>

      {paused && (
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
