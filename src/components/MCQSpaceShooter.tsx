import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Rocket, Timer, Trophy, Zap } from "lucide-react";
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
import { playClick, playSwipe } from "@/lib/sound";
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
  onFinalSubmit: () => void;
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
const MAX_ACTIVE_PROJECTILES = 6;
const MAX_PARTICLES = 36;
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
  const colors = ["#8df7ff", "#75a7ff", "#ffe18a", "#ff8fca"];
  for (let i = 0; i < 12 && world.particles.length < MAX_PARTICLES; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    const speed = 38 + (i % 4) * 18;
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      ageMs: 0,
      lifetimeMs: 250 + (i % 5) * 55,
      radius: 1.8 + (i % 3) * 0.7,
      color: colors[i % colors.length]!,
    });
  }
}

function drawSpaceFrame(context: CanvasRenderingContext2D, world: SpaceWorld): void {
  const { width, height } = world;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#061329";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(34, 91, 177, 0.12)";
  context.beginPath();
  context.ellipse(width * 0.18, height * 0.27, width * 0.42, height * 0.34, -0.4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(122, 42, 171, 0.10)";
  context.beginPath();
  context.ellipse(width * 0.87, height * 0.5, width * 0.33, height * 0.4, 0.3, 0, Math.PI * 2);
  context.fill();

  for (const star of world.stars) {
    context.globalAlpha = star.alpha;
    context.fillStyle = "#d9f8ff";
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  for (const projectile of world.projectiles) {
    context.save();
    context.lineCap = "round";
    context.strokeStyle = "rgba(74, 225, 255, 0.42)";
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(projectile.x - projectile.vx * 0.032, projectile.y - projectile.vy * 0.032);
    context.lineTo(projectile.x, projectile.y);
    context.stroke();
    context.shadowColor = "#63efff";
    context.shadowBlur = 12;
    context.strokeStyle = "#bafaff";
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(projectile.x - projectile.vx * 0.018, projectile.y - projectile.vy * 0.018);
    context.lineTo(projectile.x, projectile.y);
    context.stroke();
    context.restore();
  }

  for (const particle of world.particles) {
    context.globalAlpha = Math.max(0, 1 - particle.ageMs / particle.lifetimeMs);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  const shipY = Math.max(34, height - 42);
  const shipX = clampSpaceShipX(world.shipX, width, SHIP_RADIUS);
  context.save();
  context.translate(shipX, shipY);
  if (world.heldDirection !== 0) {
    context.fillStyle = "#ffae5b";
    context.beginPath();
    context.moveTo(-7, 15);
    context.lineTo(0, 29 + Math.sin((world.lastTimestamp ?? 0) / 45) * 3);
    context.lineTo(7, 15);
    context.closePath();
    context.fill();
    context.fillStyle = "#fff0a7";
    context.beginPath();
    context.moveTo(-3, 15);
    context.lineTo(0, 23);
    context.lineTo(3, 15);
    context.closePath();
    context.fill();
  }
  context.shadowColor = "#5edfff";
  context.shadowBlur = 18;
  context.fillStyle = "#55bfff";
  context.beginPath();
  context.moveTo(0, -23);
  context.lineTo(20, 13);
  context.lineTo(7, 9);
  context.lineTo(0, 15);
  context.lineTo(-7, 9);
  context.lineTo(-20, 13);
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = "#d7fbff";
  context.beginPath();
  context.moveTo(0, -15);
  context.lineTo(6, 5);
  context.lineTo(0, 2);
  context.lineTo(-6, 5);
  context.closePath();
  context.fill();
  context.fillStyle = "#ffb36c";
  context.beginPath();
  context.ellipse(-14, 10, 3.5, 6.5, -0.4, 0, Math.PI * 2);
  context.ellipse(14, 10, 3.5, 6.5, 0.4, 0, Math.PI * 2);
  context.fill();
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

  const [selectedTargetIndex, setSelectedTargetIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Tap an answer target to aim, then fire the laser.");
  const [rendererError, setRendererError] = useState(false);
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const pausedRef = useRef(false);
  const submittedRef = useRef(false);
  const finalSubmitInvokedRef = useRef(false);
  const activeQuestionKeyRef = useRef(String(questionKey));
  const activeSessionKeyRef = useRef(String(sessionKey ?? "default"));
  const selectedTargetRef = useRef<number | null>(null);

  const canInteract = useCallback(() => {
    const current = latestPropsRef.current;
    return (
      !pausedRef.current &&
      !current.disabled &&
      !current.feedback &&
      !current.finalSubmitReady &&
      !submittedRef.current &&
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
    worldRef.current.heldDirection = 0;
    worldRef.current.lastTimestamp = null;
    setPaused(nextPaused);
    setStatusMessage(message);
    latestPropsRef.current.onPauseChange?.(nextPaused);
  }, []);

  const selectTarget = useCallback((index: number) => {
    if (!canInteract() || !mappingsRef.current[index] || !latestPropsRef.current.options[index]) return;
    selectedTargetRef.current = index;
    setSelectedTargetIndex(index);
    setStatusMessage("Target locked. Fire when you are ready.");
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
    if (world.projectiles.length >= MAX_ACTIVE_PROJECTILES) {
      setStatusMessage("Laser bank is recharging. Try again in a moment.");
      return;
    }
    if (world.projectiles.some((projectile) => projectile.targetId === mapping.gateId)) {
      setStatusMessage("A laser is already travelling toward that target.");
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
    playClick();
    setStatusMessage("Laser fired. Track the shot to its target.");
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
    worldRef.current.projectiles.length = 0;
    setStatusMessage("Direct hit! Checking the answer with the Math Quiz Engine…");
    playSwipe();

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
    submittedRef.current = false;
    worldRef.current.projectiles.length = 0;
    worldRef.current.particles.length = 0;
    worldRef.current.heldDirection = 0;
    worldRef.current.shipX = worldRef.current.width / 2;
    selectedTargetRef.current = null;
    setSelectedTargetIndex(null);
    if (sessionChanged) finalSubmitInvokedRef.current = false;
    if (pausedRef.current) setPausedState(false, "Mission resumed.");
    else setStatusMessage("New question acquired. Tap a target to aim.");
  }, [questionKey, sessionKey, setPausedState]);

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

    context.imageSmoothingEnabled = true;
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
      if (pausedRef.current) latestPropsRef.current.onPauseChange?.(false);
      void setGameImmersiveMode(false).catch(() => undefined);
    };
  }, []);

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
        worldRef.current.heldDirection = -1;
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        worldRef.current.heldDirection = 1;
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
  }, [canInteract, fireProjectile, setPausedState]);

  const handleMoveDown = (direction: -1 | 1, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!canInteract()) return;
    event.preventDefault();
    worldRef.current.heldDirection = direction;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional; pointer cancellation and lifecycle handlers still clear movement.
    }
  };
  const handleMoveUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    worldRef.current.heldDirection = 0;
  };

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
    if (!current.canFinalizeTest || current.disabled || finalSubmitInvokedRef.current) return;
    finalSubmitInvokedRef.current = true;
    playClick();
    current.onFinalSubmit();
  };

  const submissionBlocked = disabled || !!feedback || finalSubmitReady || submittedRef.current;
  const leaveBlocked = submissionBlocked || paused;
  const restartBlocked = disabled || !!feedback || submittedRef.current;

  return (
    <section className="mcq-space-shell" aria-label="Math Space Shooter">
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
          {canFinalizeTest && (
            <button
              type="button"
              className="mcq-space-submit"
              onClick={handleFinalSubmit}
              disabled={disabled || finalSubmitInvokedRef.current}
              aria-label="Submit complete test"
            >
              <Trophy size={15} aria-hidden="true" />
              <span>Submit</span>
            </button>
          )}
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
        <div className="mcq-space-target-grid" role="group" aria-label="Mathematical answer targets">
          {options.map((option, index) => {
            const mapping = mappings[index];
            return (
              <button
                key={mapping?.gateId ?? `${String(questionKey)}-${index}`}
                ref={(element) => { targetRefs.current[index] = element; }}
                type="button"
                className={`mcq-space-target mcq-space-target--${index % 4}${selectedTargetIndex === index ? " is-aimed" : ""}`}
                onClick={() => selectTarget(index)}
                disabled={submissionBlocked || paused}
                aria-label={`Aim at answer ${String(option.value)}`}
                aria-pressed={selectedTargetIndex === index}
                data-target-id={mapping?.gateId}
                data-testid={`space-target-${index}`}
              >
                <span className="mcq-space-target-mark" aria-hidden="true">{index + 1}</span>
                <span className="mcq-space-target-label">{option.label}</span>
                <span className="mcq-space-target-spark" aria-hidden="true">✦</span>
              </button>
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
        <div className="mcq-space-control-row">
          <button
            type="button"
            className="mcq-space-move-button"
            onPointerDown={(event) => handleMoveDown(-1, event)}
            onPointerUp={handleMoveUp}
            onPointerCancel={handleMoveUp}
            onLostPointerCapture={handleMoveUp}
            onContextMenu={(event) => event.preventDefault()}
            disabled={!canInteract()}
            aria-label="Move spaceship left"
          >
            <ChevronLeft size={25} aria-hidden="true" />
            <span>LEFT</span>
          </button>
          <button
            type="button"
            className="mcq-space-fire-button"
            onClick={fireProjectile}
            disabled={!canInteract() || selectedTargetIndex === null}
            aria-label="Fire laser at selected answer"
            data-testid="space-fire"
          >
            <Zap size={22} aria-hidden="true" />
            <span>FIRE</span>
          </button>
          <button
            type="button"
            className="mcq-space-move-button"
            onPointerDown={(event) => handleMoveDown(1, event)}
            onPointerUp={handleMoveUp}
            onPointerCancel={handleMoveUp}
            onLostPointerCapture={handleMoveUp}
            onContextMenu={(event) => event.preventDefault()}
            disabled={!canInteract()}
            aria-label="Move spaceship right"
          >
            <ChevronRight size={25} aria-hidden="true" />
            <span>RIGHT</span>
          </button>
        </div>
        <div className="mcq-space-controls-hint">
          <span>Tap target to aim</span><span aria-hidden="true">·</span><span>Hold LEFT / RIGHT to move</span><span aria-hidden="true">·</span><span>FIRE to answer</span>
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
