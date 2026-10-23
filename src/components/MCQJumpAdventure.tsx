import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, Check, Gamepad2, Pause, Play, RotateCcw, Send, Sparkles, Timer, X } from "lucide-react";
import type { MCQGameValue } from "@/lib/mcqGame";
import { createMCQGateMappings } from "@/lib/mcqGamePhysics";
import { createJumpPlatforms, stepJumpPlayer, type JumpPlatform, type JumpPlayerState } from "@/lib/mcqJumpPhysics";
import { setGameImmersiveMode } from "@/lib/gameImmersiveMode";
import { playJump, playLanding } from "@/lib/sound";
import "./mcq-jump.css";

export interface MCQJumpOption {
  value: MCQGameValue;
  label: ReactNode;
}

export interface MCQJumpAdventureProps {
  questionKey: string | number;
  sessionKey?: string | number;
  questionLabel: ReactNode;
  options: MCQJumpOption[];
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

interface CanvasSize {
  width: number;
  height: number;
  worldWidth: number;
}

interface InputState {
  left: boolean;
  right: boolean;
  jumpQueued: boolean;
}

const safeNumber = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
};

const drawScene = (
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  platforms: readonly JumpPlatform[],
  player: JumpPlayerState,
  elapsed: number,
  cameraX: number,
  checkpointX: number,
) => {
  const width = size.width;
  const height = size.height;
  context.clearRect(0, 0, width, height);

  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#78d7ff");
  sky.addColorStop(0.56, "#c6f2ff");
  sky.addColorStop(1, "#efffc9");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(255, 244, 163, 0.96)";
  context.beginPath();
  context.arc(width * 0.82, height * 0.18, Math.max(24, width * 0.045), 0, Math.PI * 2);
  context.fill();

  for (let index = 0; index < 5; index += 1) {
    const cloudBase = width * (0.14 + index * 0.29) - (cameraX * (0.08 + (index % 2) * 0.025)) % (width * 1.4);
    const cloudX = ((cloudBase % (width * 1.5)) + width * 1.5) % (width * 1.5) - width * 0.12;
    const cloudY = height * (0.13 + (index % 3) * 0.075);
    context.fillStyle = "rgba(255, 255, 255, 0.75)";
    context.beginPath();
    context.ellipse(cloudX, cloudY, width * 0.075, height * 0.025, 0, 0, Math.PI * 2);
    context.ellipse(cloudX - width * 0.035, cloudY + height * 0.008, width * 0.04, height * 0.027, 0, 0, Math.PI * 2);
    context.ellipse(cloudX + width * 0.035, cloudY + height * 0.006, width * 0.045, height * 0.03, 0, 0, Math.PI * 2);
    context.fill();
  }

  const drawHill = (color: string, baseY: number, amplitude: number, shift: number) => {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, height);
    context.lineTo(0, baseY);
    for (let x = 0; x <= width + 20; x += 20) {
      const wave = Math.sin((x + cameraX * shift) / Math.max(95, width * 0.26)) * amplitude;
      context.lineTo(x, baseY + wave);
    }
    context.lineTo(width, height);
    context.closePath();
    context.fill();
  };
  drawHill("#8ce4b0", height * 0.56, height * 0.035, 0.16);
  drawHill("#54c98c", height * 0.64, height * 0.028, 0.32);

  platforms.forEach((platform, index) => {
    const x = platform.x - cameraX;
    if (x + platform.width < -40 || x > width + 40) return;
    context.fillStyle = "rgba(21, 100, 81, 0.13)";
    drawRoundedRect(context, x, platform.y + 6, platform.width, platform.height, 9);
    context.fill();
    context.fillStyle = index % 3 === 0 ? "#35b978" : index % 3 === 1 ? "#10b9b0" : "#6bca65";
    drawRoundedRect(context, x, platform.y, platform.width, platform.height, 9);
    context.fill();
    context.fillStyle = "rgba(255, 255, 255, 0.5)";
    drawRoundedRect(context, x + 5, platform.y + 2, Math.max(0, platform.width - 10), 3, 1.5);
    context.fill();

    if (platform.checkpoint) {
      context.fillStyle = "#fff7b2";
      context.beginPath();
      context.arc(x + platform.width * 0.78, platform.y - 13, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#f8b52d";
      context.beginPath();
      context.arc(x + platform.width * 0.78, platform.y - 13, 2.4, 0, Math.PI * 2);
      context.fill();
    }
  });

  const heroX = player.x - cameraX;
  const heroY = player.y;
  const heroW = player.width;
  const heroH = player.height;
  const bob = player.grounded ? Math.sin(elapsed * 0.011) * 1.1 : 0;
  const running = player.grounded && Math.abs(player.vx) > 1;
  const footSwing = running ? Math.sin(elapsed * 0.025) * heroW * 0.11 : 0;

  context.fillStyle = "rgba(22, 71, 83, 0.18)";
  context.beginPath();
  context.ellipse(heroX + heroW * 0.52, heroY + heroH + 3, heroW * 0.55, heroH * 0.095, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ff9e42";
  drawRoundedRect(context, heroX + heroW * 0.16, heroY + heroH * 0.48 + bob, heroW * 0.68, heroH * 0.45, heroW * 0.22);
  context.fill();

  context.fillStyle = "#2e8cff";
  drawRoundedRect(context, heroX + heroW * 0.08, heroY + heroH * 0.28 + bob, heroW * 0.84, heroH * 0.52, heroW * 0.27);
  context.fill();

  context.fillStyle = "#ffd5a4";
  context.beginPath();
  context.arc(heroX + heroW * 0.51, heroY + heroH * 0.27 + bob, heroW * 0.36, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#25334e";
  context.beginPath();
  context.arc(heroX + heroW * 0.40, heroY + heroH * 0.25 + bob, heroW * 0.045, 0, Math.PI * 2);
  context.arc(heroX + heroW * 0.62, heroY + heroH * 0.25 + bob, heroW * 0.045, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#ad5f37";
  context.lineWidth = Math.max(1.4, heroW * 0.035);
  context.lineCap = "round";
  context.beginPath();
  context.arc(heroX + heroW * 0.51, heroY + heroH * 0.30 + bob, heroW * 0.11, 0.15, Math.PI - 0.15);
  context.stroke();

  context.fillStyle = "#fff";
  drawRoundedRect(context, heroX + heroW * 0.18 + footSwing, heroY + heroH * 0.88, heroW * 0.27, heroH * 0.12, 4);
  context.fill();
  drawRoundedRect(context, heroX + heroW * 0.55 - footSwing, heroY + heroH * 0.88, heroW * 0.27, heroH * 0.12, 4);
  context.fill();

  context.fillStyle = "rgba(255,255,255,0.75)";
  context.font = "900 " + Math.max(12, Math.min(22, width * 0.045)) + "px system-ui, sans-serif";
  context.fillText("★", heroX + heroW * 0.24, heroY - 7);

  // A small progress ribbon follows the same world camera without controlling
  // the quiz answer mapping; the answer buttons remain explicit and accessible.
  const progress = clamp(player.x / Math.max(1, size.worldWidth - player.width), 0, 1);
  context.fillStyle = "rgba(13, 68, 74, 0.16)";
  drawRoundedRect(context, width * 0.22, height * 0.28, width * 0.56, 5, 3);
  context.fill();
  context.fillStyle = "#fff";
  drawRoundedRect(context, width * 0.22, height * 0.28, width * 0.56 * progress, 5, 3);
  context.fill();
  if (checkpointX > 0) {
    context.fillStyle = "rgba(255,255,255,0.5)";
    context.font = "700 11px system-ui, sans-serif";
    context.fillText("CHECKPOINT", 12, height * 0.42);
  }
};

const MCQJumpAdventure = ({
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
}: MCQJumpAdventureProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestPropsRef = useRef({
    questionKey,
    sessionKey,
    options,
    correctAnswer,
    feedback,
    selectedOption,
    disabled,
    finalSubmitReady,
    canFinalizeTest,
    onSelectOption,
    onFinalSubmit,
    onRestartGame,
    onPauseChange,
  });
  latestPropsRef.current = {
    questionKey,
    sessionKey,
    options,
    correctAnswer,
    feedback,
    selectedOption,
    disabled,
    finalSubmitReady,
    canFinalizeTest,
    onSelectOption,
    onFinalSubmit,
    onRestartGame,
    onPauseChange,
  };

  const [paused, setPaused] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Keep moving and jump between platforms!");
  const [rendererError, setRendererError] = useState(false);
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const submittedRef = useRef(false);
  const activeQuestionKeyRef = useRef(String(questionKey));
  const activeSessionKeyRef = useRef(String(sessionKey ?? "default"));
  const finalSubmitInvokedRef = useRef(false);
  const pausedRef = useRef(false);
  const inputRef = useRef<InputState>({ left: false, right: false, jumpQueued: false });
  const playerRef = useRef<JumpPlayerState | null>(null);
  const sizeRef = useRef<CanvasSize>({ width: 0, height: 0, worldWidth: 0 });
  const platformsRef = useRef<JumpPlatform[]>([]);
  const elapsedRef = useRef(0);

  const setPausedState = useCallback((nextPaused: boolean, message: string) => {
    const changed = pausedRef.current !== nextPaused;
    pausedRef.current = nextPaused;
    inputRef.current.left = false;
    inputRef.current.right = false;
    inputRef.current.jumpQueued = false;
    setPaused(nextPaused);
    setStatusMessage(message);
    if (changed) latestPropsRef.current.onPauseChange?.(nextPaused);
  }, []);

  const resetPlayerToStart = useCallback(() => {
    const size = sizeRef.current;
    const platform = platformsRef.current[0];
    const player = playerRef.current;
    if (size.width > 0 && platform && player) {
      const x = clamp(size.width * 0.12, 0, Math.max(0, size.worldWidth - player.width));
      const y = platform.y - player.height;
      playerRef.current = {
        ...player,
        x,
        y,
        vx: 0,
        vy: 0,
        grounded: true,
        checkpointX: x,
        checkpointY: y,
      };
    }
    inputRef.current.left = false;
    inputRef.current.right = false;
    inputRef.current.jumpQueued = false;
    elapsedRef.current = 0;
    submittedRef.current = false;
    finalSubmitInvokedRef.current = false;
  }, []);

  useEffect(() => {
    const nextKey = String(questionKey);
    const nextSession = String(sessionKey ?? "default");
    const questionChanged = activeQuestionKeyRef.current !== nextKey;
    const sessionChanged = activeSessionKeyRef.current !== nextSession;
    if (!questionChanged && !sessionChanged) return;

    activeQuestionKeyRef.current = nextKey;
    activeSessionKeyRef.current = nextSession;
    submittedRef.current = false;
    if (sessionChanged) {
      resetPlayerToStart();
      setPausedState(false, "New adventure ready. Keep moving and jump between platforms!");
    } else {
      setStatusMessage("New question! Choose an answer when you are ready.");
    }
  }, [questionKey, sessionKey, resetPlayerToStart, setPausedState]);

  useEffect(() => {
    const syncImmersiveMode = async () => {
      try {
        await setGameImmersiveMode(true);
      } catch {
        // Rendering must remain usable if the native immersive-mode bridge is absent.
      }
    };
    void syncImmersiveMode();
    return () => {
      if (pausedRef.current) {
        pausedRef.current = false;
        latestPropsRef.current.onPauseChange?.(false);
      }
      void setGameImmersiveMode(false).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) {
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.jumpQueued = false;
    }
  }, [paused]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setPausedState(true, "Paused while the app is in the background.");
      }
    };
    const handleWindowBlur = () => {
      setPausedState(true, "Paused after the app lost focus.");
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [setPausedState]);

  useEffect(() => {
    const clearInputs = () => {
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.jumpQueued = false;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPausedState(true, "Adventure paused.");
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("button, input, textarea, select, [contenteditable='true']")) return;

      const current = latestPropsRef.current;
      const inputAllowed = !pausedRef.current &&
        !current.disabled &&
        !current.feedback &&
        !current.finalSubmitReady &&
        !submittedRef.current;
      if (!inputAllowed) {
        clearInputs();
        return;
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        inputRef.current.left = true;
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        inputRef.current.right = true;
      } else if (event.code === "Space" || event.key === "ArrowUp") {
        event.preventDefault();
        inputRef.current.jumpQueued = true;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") inputRef.current.left = false;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") inputRef.current.right = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [setPausedState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) {
      setRendererError(true);
      setPausedState(true, "Graphics are unavailable. Retry or exit to game selection.");
      return;
    }
    setRendererError(false);

    let animationFrame: number | null = null;
    let lastTimestamp: number | null = null;
    let accumulator = 0;
    const fixedStep = 1 / 120;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(240, rect.width || window.innerWidth || 360);
      const height = Math.max(320, rect.height || window.innerHeight || 640);
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const oldSize = sizeRef.current;
      const oldPlayer = playerRef.current;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const nextSize: CanvasSize = { width, height, worldWidth: width * 3.95 };
      const nextPlatforms = createJumpPlatforms(width, height);
      sizeRef.current = nextSize;
      platformsRef.current = nextPlatforms;

      if (oldPlayer && oldSize.width > 0 && oldSize.height > 0) {
        const scaleX = width / oldSize.width;
        const scaleY = height / oldSize.height;
        playerRef.current = {
          ...oldPlayer,
          x: oldPlayer.x * scaleX,
          y: oldPlayer.y * scaleY,
          vx: oldPlayer.vx * scaleX,
          vy: oldPlayer.vy * scaleY,
          width: oldPlayer.width * scaleX,
          height: oldPlayer.height * scaleY,
          checkpointX: oldPlayer.checkpointX * scaleX,
          checkpointY: oldPlayer.checkpointY * scaleY,
        };
      } else {
        const playerHeight = clamp(width * 0.115, 35, 49);
        const playerWidth = playerHeight * 0.72;
        const firstPlatform = nextPlatforms[0];
        playerRef.current = {
          x: width * 0.12,
          y: firstPlatform.y - playerHeight,
          vx: 0,
          vy: 0,
          width: playerWidth,
          height: playerHeight,
          grounded: true,
          checkpointX: width * 0.12,
          checkpointY: firstPlatform.y - playerHeight,
        };
      }
      lastTimestamp = null;
      accumulator = 0;
    };

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(resize)
      : null;
    resizeObserver?.observe(canvas);
    window.addEventListener("resize", resize);
    resize();

    const frame = (timestamp: number) => {
      const size = sizeRef.current;
      let player = playerRef.current;
      const platforms = platformsRef.current;

      if (player && size.width > 0 && size.height > 0) {
        const elapsed = lastTimestamp === null ? 0 : clamp(timestamp - lastTimestamp, 0, 100);
        lastTimestamp = timestamp;

        if (!pausedRef.current) {
          elapsedRef.current += elapsed;
          accumulator += elapsed / 1000;
          let steps = 0;
          while (accumulator >= fixedStep && steps < 12) {
            const input = inputRef.current;
            const axis = Number(input.right) - Number(input.left);
            const wasGrounded = player.grounded;
            player = stepJumpPlayer(
              player,
              {
                axis,
                jump: input.jumpQueued,
                movementSpeed: Math.max(170, size.width * 0.72),
                gravity: size.height * 3.6,
                jumpImpulse: size.height * 1.4,
              },
              platforms,
              size.worldWidth,
              size.height,
              fixedStep,
            );
            if (!wasGrounded && player.grounded) {
              try { playLanding(); } catch { /* Audio must never interrupt physics. */ }
            }
            input.jumpQueued = false;
            accumulator -= fixedStep;
            steps += 1;
          }
          playerRef.current = player;
          const cameraX = clamp(player.x - size.width * 0.29, 0, size.worldWidth - size.width);
          drawScene(context, size, platforms, player, elapsedRef.current, cameraX, player.checkpointX);
        } else {
          accumulator = 0;
        }
      }
      animationFrame = window.requestAnimationFrame(frame);
    };

    animationFrame = window.requestAnimationFrame(frame);
    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.jumpQueued = false;
      playerRef.current = null;
    };
  }, [rendererAttempt, setPausedState]);

  const setMovement = useCallback((direction: "left" | "right", active: boolean) => {
    const current = latestPropsRef.current;
    if (pausedRef.current || current.disabled || current.feedback || current.finalSubmitReady || submittedRef.current) {
      inputRef.current[direction] = false;
      return;
    }
    inputRef.current[direction] = active;
  }, []);

  const queueJump = useCallback(() => {
    const current = latestPropsRef.current;
    if (pausedRef.current || current.disabled || current.feedback || current.finalSubmitReady || submittedRef.current) return;
    inputRef.current.jumpQueued = true;
    if (playerRef.current?.grounded) {
      try { playJump(); } catch { /* Audio must never interrupt input handling. */ }
    }
  }, []);

  const restartGame = useCallback(() => {
    const current = latestPropsRef.current;
    if (current.onRestartGame) {
      current.onRestartGame();
      return;
    }
    resetPlayerToStart();
    setPausedState(false, "Adventure restarted. Keep moving and jump between platforms!");
  }, [resetPlayerToStart, setPausedState]);

  const selectAnswer = useCallback((index: number) => {
    const current = latestPropsRef.current;
    const questionId = String(current.questionKey);
    const option = current.options[index];
    const mappings = createMCQGateMappings(current.questionKey, current.options.map((item) => item.value));
    const mapping = mappings[index];

    if (
      questionId !== activeQuestionKeyRef.current ||
      !option ||
      !mapping ||
      pausedRef.current ||
      current.disabled ||
      current.finalSubmitReady ||
      current.feedback ||
      current.selectedOption !== null ||
      submittedRef.current
    ) return;

    submittedRef.current = true;
    setStatusMessage("Answer selected. Checking with the Math Quiz Engine…");
    try {
      const accepted = current.onSelectOption(index, mapping.optionValue, mapping.gateId);
      if (accepted === false) {
        submittedRef.current = false;
        setStatusMessage("That answer could not be submitted. Please choose again.");
      }
    } catch (error) {
      submittedRef.current = false;
      setStatusMessage("That answer could not be submitted. Please try again.");
      throw error;
    }
  }, []);

  const submitWholeTest = useCallback(() => {
    const current = latestPropsRef.current;
    if (pausedRef.current || !current.canFinalizeTest || current.disabled || finalSubmitInvokedRef.current) return;
    finalSubmitInvokedRef.current = true;
    current.onFinalSubmit();
  }, []);

  const togglePause = useCallback(() => {
    const nextPaused = !pausedRef.current;
    setPausedState(nextPaused, nextPaused ? "Adventure paused." : "Adventure resumed. Have fun!");
  }, [setPausedState]);

  const correctIndex = options.findIndex((option) => String(option.value) === String(correctAnswer));

  return (
    <section className="mcq-jump-shell" aria-label="2D Math Jump Adventure" data-testid="mcq-jump-fullscreen">
      <canvas ref={canvasRef} className="mcq-jump-canvas" aria-label="Colorful 2D platform world with a jumping cartoon hero" />

      <header className="mcq-jump-topbar" aria-label="Quiz score and controls">
        <div className="mcq-jump-score mcq-jump-score--correct" aria-label={String(correctScore) + " correct answers"}>
          <Check size={18} aria-hidden="true" /><span>{correctScore}</span>
        </div>
        <span className="mcq-jump-divider" aria-hidden="true" />
        <div className="mcq-jump-score mcq-jump-score--wrong" aria-label={String(wrongScore) + " incorrect answers"}>
          <X size={18} aria-hidden="true" /><span>{wrongScore}</span>
        </div>
        <span className="mcq-jump-divider" aria-hidden="true" />
        <div className="mcq-jump-progress" aria-label={"Question " + (progressLabel || "—")}>{progressLabel || "—"}</div>
        {timerLabel && <div className="mcq-jump-timer"><Timer size={16} aria-hidden="true" />{timerLabel}</div>}
        <button type="button" className="mcq-jump-icon-button" onClick={togglePause} aria-label={paused ? "Resume adventure" : "Pause adventure"}>
          {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
        </button>
        <button type="button" className="mcq-jump-submit" data-testid="mcq-jump-submit" aria-label="Submit complete test" disabled={paused || disabled || !canFinalizeTest || finalSubmitInvokedRef.current} onClick={submitWholeTest}>
          <Send size={15} aria-hidden="true" /><span>Submit</span>
        </button>
      </header>

      <div className="mcq-jump-question" aria-label="Current math question">
        <span className="mcq-jump-question-kicker"><Sparkles size={14} aria-hidden="true" /> MATH CHALLENGE</span>
        <div className="mcq-jump-question-text">{questionLabel}</div>
      </div>

      {paused && (
        <div className="mcq-jump-paused-overlay" role="dialog" aria-modal="true" aria-label="Adventure paused">
          <div className="mcq-jump-paused-card">
            <Pause size={27} aria-hidden="true" />
            <strong>Adventure paused</strong>
            <span>Movement and the quiz timer are paused.</span>
            <button type="button" onClick={togglePause}><Play size={16} aria-hidden="true" /> Resume</button>
            <button type="button" onClick={restartGame}><RotateCcw size={16} aria-hidden="true" /> Restart quiz</button>
            {onChangeGame && (
              <button type="button" onClick={onChangeGame}><Gamepad2 size={16} aria-hidden="true" /> Exit to game selection</button>
            )}
          </div>
        </div>
      )}

      <div className="mcq-jump-answer-panel" role="group" aria-label="Choose your answer">
        <div className="mcq-jump-answer-heading">
          <span>Choose an answer</span>
          <span>Tap a tile to submit</span>
        </div>
        <div className="mcq-jump-answer-grid">
          {options.map((option, index) => {
            const isSelected = selectedOption === index;
            const isCorrect = !!feedback && index === correctIndex;
            const isWrong = feedback === "wrong" && isSelected;
            const classNames = [
              "mcq-jump-answer",
              isSelected ? "is-selected" : "",
              isCorrect ? "is-correct" : "",
              isWrong ? "is-wrong" : "",
            ].filter(Boolean).join(" ");
            return (
              <button
                type="button"
                key={String(option.value) + "-" + String(index)}
                className={classNames}
                aria-label={"Answer " + String(option.value)}
                data-option-index={index}
                disabled={paused || disabled || finalSubmitReady || !!feedback || selectedOption !== null}
                onClick={() => selectAnswer(index)}
              >
                <span className="mcq-jump-answer-icon" aria-hidden="true">{index + 1}</span>
                <span className="mcq-jump-answer-value">{option.label}</span>
                {isCorrect && <Check className="mcq-jump-answer-mark" size={17} aria-label="Correct answer" />}
                {isWrong && <X className="mcq-jump-answer-mark" size={17} aria-label="Selected incorrect answer" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mcq-jump-controls" role="group" aria-label="Character movement controls">
        <div className="mcq-jump-direction-controls">
          <button
            type="button"
            aria-label="Move left"
            className="mcq-jump-control-button"
            disabled={paused || disabled || !!feedback || finalSubmitReady || submittedRef.current}
            onPointerDown={(event) => { event.preventDefault(); setMovement("left", true); }}
            onPointerUp={() => setMovement("left", false)}
            onPointerLeave={() => setMovement("left", false)}
            onPointerCancel={() => setMovement("left", false)}
            onContextMenu={(event) => event.preventDefault()}
          ><ArrowLeft size={22} aria-hidden="true" /></button>
          <button
            type="button"
            aria-label="Move right"
            className="mcq-jump-control-button"
            disabled={paused || disabled || !!feedback || finalSubmitReady || submittedRef.current}
            onPointerDown={(event) => { event.preventDefault(); setMovement("right", true); }}
            onPointerUp={() => setMovement("right", false)}
            onPointerLeave={() => setMovement("right", false)}
            onPointerCancel={() => setMovement("right", false)}
            onContextMenu={(event) => event.preventDefault()}
          ><ArrowRight size={22} aria-hidden="true" /></button>
        </div>
        <span className="mcq-jump-control-hint">MOVE</span>
        <button
          type="button"
          className="mcq-jump-jump-button"
          aria-label="Jump"
          disabled={paused || disabled || !!feedback || finalSubmitReady || submittedRef.current}
          onClick={queueJump}
        ><ArrowDown className="mcq-jump-jump-icon" size={20} aria-hidden="true" /><span>JUMP</span></button>
        {onChangeGame && (
          <button
            type="button"
            className="mcq-jump-select-game"
            aria-label="Choose another game"
            disabled={paused || disabled || !!feedback || finalSubmitReady || submittedRef.current}
            onClick={onChangeGame}
          ><Gamepad2 size={17} aria-hidden="true" /></button>
        )}
        <button type="button" className="mcq-jump-restart-button" aria-label="Restart adventure" onClick={restartGame}>
          <RotateCcw size={17} aria-hidden="true" />
        </button>
      </div>

      {feedback && (
        <div className={"mcq-jump-feedback " + (feedback === "correct" ? "is-correct" : "is-wrong")} role="status" aria-live="polite">
          {feedback === "correct" ? <Check size={17} aria-hidden="true" /> : <X size={17} aria-hidden="true" />}
          <span>{feedback === "correct" ? "Great job! Correct answer." : "Not quite. Keep learning and try the next question."}</span>
        </div>
      )}
      <p className="mcq-jump-status" role="status" aria-live="polite">{statusMessage}</p>
      {rendererError && (
        <div className="mcq-jump-render-error" role="alert" aria-label="Game graphics unavailable">
          <div className="mcq-jump-render-error-card">
            <Sparkles size={27} aria-hidden="true" />
            <strong>Game graphics could not start</strong>
            <span>This device did not provide a 2D drawing context. Retry graphics or return to game selection.</span>
            <button
              type="button"
              onClick={() => {
                setRendererError(false);
                setRendererAttempt((attempt) => attempt + 1);
              }}
            >Retry graphics</button>
            {onChangeGame && <button type="button" onClick={onChangeGame}>Exit to game selection</button>}
          </div>
        </div>
      )}
    </section>
  );
};

export default MCQJumpAdventure;
