import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CarFront, X, Zap } from "lucide-react";
import type { MCQGameValue } from "@/lib/mcqGame";
import {
  MCQ_GAME_CAR_HALF_WIDTH,
  MCQ_GAME_COLLISION_Z,
  MCQ_GAME_GATE_HALF_WIDTH,
  MCQ_GAME_GATE_START_Z,
  MCQ_GAME_LANE_X,
  MCQ_GAME_TRAVEL_DISTANCE,
  createMCQGateMappings,
  detectSweptGateCollision,
} from "@/lib/mcqGamePhysics";
import {
  createMCQ3DScene,
  type MCQ3DScene,
  type MCQGateFeedback,
} from "@/lib/mcq3dRenderer";
import {
  enterGameImmersiveMode,
  exitGameImmersiveMode,
  requestBrowserFullscreenFromGesture,
} from "@/lib/gameImmersive";
import "./mcq-game.css";

export interface MCQWithGameOption {
  value: MCQGameValue;
  label: ReactNode;
}

type GamePhase =
  | "INITIALIZING"
  | "RUNNING"
  | "ANSWERING"
  | "FEEDBACK"
  | "PAUSED"
  | "FINISHED"
  | "ERROR";

interface MCQWithGameProps {
  questionKey: string | number;
  questionContent?: ReactNode;
  options: MCQWithGameOption[];
  correctAnswer: MCQGameValue;
  feedback: "correct" | "wrong" | null;
  selectedOption: number | null;
  correctScore: number;
  wrongScore: number;
  durationMs: number;
  progressLabel?: string;
  timerLabel?: string | null;
  disabled?: boolean;
  onExit?: () => void;
  onCollision: (laneIndex: number, optionValue: MCQGameValue, gateId: string) => void;
}

interface GameRuntime {
  activeQuestionKey: string;
  passElapsedMs: number;
  sessionElapsedMs: number;
  previousGateZ: number;
  lastGateZ: number;
  lastScrollOffset: number;
  lastTimestamp: number | null;
}

interface PointerGesture {
  pointerId: number;
  direction: -1 | 1;
  held: boolean;
}

const LANE_LABELS = ["A", "B", "C", "D"] as const;
const DEFAULT_PASS_DURATION_MS = 5200;
const HOLD_THRESHOLD_MS = 180;
const MAX_SPEED_MULTIPLIER = 2.25;
const MOVING_PHASES = new Set<GamePhase>(["RUNNING", "ANSWERING", "FEEDBACK"]);

const MCQWithGame = ({
  questionKey,
  questionContent,
  options,
  correctAnswer,
  feedback,
  selectedOption,
  correctScore,
  wrongScore,
  durationMs,
  progressLabel,
  timerLabel,
  disabled = false,
  onExit,
  onCollision,
}: MCQWithGameProps) => {
  const [lane, setLane] = useState(1);
  const [phase, setPhase] = useState<GamePhase>("INITIALIZING");
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [isBoosting, setIsBoosting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gateLabelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sceneRef = useRef<MCQ3DScene | null>(null);
  const frameRef = useRef<number | null>(null);
  const renderFrameRef = useRef<(() => void) | null>(null);
  const animationLoopRef = useRef<FrameRequestCallback | null>(null);
  const scheduleFrameRef = useRef<(() => void) | null>(null);

  const laneRef = useRef(lane);
  const targetCarXRef = useRef<number>(MCQ_GAME_LANE_X[lane]);
  const carXRef = useRef<number>(MCQ_GAME_LANE_X[lane]);
  const submittedRef = useRef(false);
  const phaseRef = useRef<GamePhase>("INITIALIZING");
  const phaseBeforePauseRef = useRef<GamePhase>("RUNNING");
  const disabledRef = useRef(disabled);
  const feedbackRef = useRef(feedback);
  const selectedOptionRef = useRef(selectedOption);
  const correctLaneRef = useRef(-1);
  const onCollisionRef = useRef(onCollision);
  const durationMsRef = useRef(durationMs);
  const rendererErrorRef = useRef<string | null>(null);
  const pointerGestureRef = useRef<PointerGesture | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const speedBoostRef = useRef(false);
  const speedMultiplierRef = useRef(1);

  const runtimeRef = useRef<GameRuntime>({
    activeQuestionKey: String(questionKey),
    passElapsedMs: 0,
    sessionElapsedMs: 0,
    previousGateZ: MCQ_GAME_GATE_START_Z,
    lastGateZ: MCQ_GAME_GATE_START_Z,
    lastScrollOffset: 0,
    lastTimestamp: null,
  });

  disabledRef.current = disabled;
  feedbackRef.current = feedback;
  selectedOptionRef.current = selectedOption;
  correctLaneRef.current = options.findIndex(
    (option) => String(option.value) === String(correctAnswer),
  );
  onCollisionRef.current = onCollision;
  durationMsRef.current = durationMs;
  rendererErrorRef.current = rendererError;

  const gateMappingsRef = useRef<ReturnType<typeof createMCQGateMappings>>([]);
  const shouldRefreshMappings =
    gateMappingsRef.current.length !== Math.min(4, options.length) ||
    gateMappingsRef.current[0]?.questionId !== String(questionKey) ||
    gateMappingsRef.current.some(
      (mapping, index) => !Object.is(mapping.optionValue, options[index]?.value),
    );

  if (shouldRefreshMappings) {
    gateMappingsRef.current = createMCQGateMappings(
      questionKey,
      options.map((option) => option.value),
    );
  }
  const gateMappings = gateMappingsRef.current;

  const changeLane = useCallback((direction: -1 | 1) => {
    if (disabledRef.current || phaseRef.current !== "RUNNING" || submittedRef.current) return;
    const nextLane = Math.max(0, Math.min(MCQ_GAME_LANE_X.length - 1, laneRef.current + direction));
    laneRef.current = nextLane;
    targetCarXRef.current = MCQ_GAME_LANE_X[nextLane];
    setLane(nextLane);
  }, []);

  const clearActiveGesture = useCallback((updateUi = true) => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    pointerGestureRef.current = null;
    speedBoostRef.current = false;
    speedMultiplierRef.current = 1;
    if (updateUi) setIsBoosting(false);
  }, []);

  const submitFallbackAnswer = useCallback((mappingIndex: number) => {
    const mapping = gateMappingsRef.current[mappingIndex];
    if (
      !mapping ||
      disabledRef.current ||
      submittedRef.current ||
      feedbackRef.current
    ) return;

    submittedRef.current = true;
    phaseRef.current = "ANSWERING";
    setPhase("ANSWERING");
    onCollisionRef.current(mapping.laneIndex, mapping.optionValue, mapping.gateId);
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      disabledRef.current ||
      phaseRef.current !== "RUNNING" ||
      submittedRef.current ||
      rendererErrorRef.current ||
      pointerGestureRef.current
    ) return;

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("[data-game-no-steer], button, input, textarea, select, a")
    ) return;

    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const midpoint = bounds.width > 0
      ? bounds.left + bounds.width / 2
      : window.innerWidth / 2;
    const direction: -1 | 1 = event.clientX < midpoint ? -1 : 1;
    const gesture: PointerGesture = {
      pointerId: event.pointerId,
      direction,
      held: false,
    };
    pointerGestureRef.current = gesture;

    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is optional on older WebViews; the stage still handles release.
    }

    holdTimerRef.current = window.setTimeout(() => {
      const activeGesture = pointerGestureRef.current;
      holdTimerRef.current = null;
      if (
        !activeGesture ||
        activeGesture.pointerId !== gesture.pointerId ||
        disabledRef.current ||
        phaseRef.current !== "RUNNING" ||
        submittedRef.current
      ) return;

      activeGesture.held = true;
      speedBoostRef.current = true;
      setIsBoosting(true);
    }, HOLD_THRESHOLD_MS);

    // Fullscreen APIs on desktop/mobile browsers require a real user gesture.
    requestBrowserFullscreenFromGesture();
  };

  const finishPointerGesture = (
    event: ReactPointerEvent<HTMLDivElement>,
    cancelled = false,
  ) => {
    const gesture = pointerGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    pointerGestureRef.current = null;

    if (speedBoostRef.current) {
      speedBoostRef.current = false;
      setIsBoosting(false);
    } else if (!cancelled && phaseRef.current === "RUNNING" && !disabledRef.current) {
      // Short taps steer once on release; hold gestures never also turn the car.
      changeLane(gesture.direction);
    }
  };

  useEffect(() => {
    document.documentElement.classList.add("mcq-game-immersive-active");
    void enterGameImmersiveMode();

    return () => {
      document.documentElement.classList.remove("mcq-game-immersive-active");
      clearActiveGesture(false);
      void exitGameImmersiveMode();
    };
  }, [clearActiveGesture]);

  // The WebGL scene and its animation loop intentionally live for the whole
  // question sequence. A new question resets gate state, not the renderer.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let scene: MCQ3DScene;
    try {
      scene = createMCQ3DScene(canvas);
    } catch {
      phaseRef.current = "ERROR";
      setPhase("ERROR");
      setRendererError(
        "3D graphics could not start on this device. Choose an answer below to continue this quiz.",
      );
      return;
    }

    sceneRef.current = scene;
    setRendererError(null);

    const renderCurrentFrame = () => {
      const activeScene = sceneRef.current;
      if (!activeScene) return;

      const currentFeedback: MCQGateFeedback[] = gateMappingsRef.current.map((mapping) => {
        const feedbackValue = feedbackRef.current;
        if (
          feedbackValue === "correct" &&
          mapping.laneIndex === correctLaneRef.current
        ) return "correct";
        if (
          feedbackValue === "wrong" &&
          selectedOptionRef.current !== null &&
          mapping.laneIndex === selectedOptionRef.current
        ) return "wrong";
        if (
          feedbackValue === "wrong" &&
          selectedOptionRef.current === null &&
          mapping.laneIndex === correctLaneRef.current
        ) return "correct";
        return "normal";
      });

      const projections = activeScene.render({
        carX: carXRef.current,
        gateZ: runtimeRef.current.lastGateZ,
        scrollOffset: runtimeRef.current.lastScrollOffset,
        gateFeedback: currentFeedback,
      });

      projections.forEach((projection, index) => {
        const element = gateLabelRefs.current[index];
        if (!element) return;
        element.style.display = projection.visible && index < gateMappingsRef.current.length
          ? "flex"
          : "none";
        element.style.left = String(projection.x) + "px";
        element.style.top = String(projection.y) + "px";
        element.style.width = String(projection.width) + "px";
        element.style.height = String(projection.height) + "px";
        element.style.fontSize = String(projection.fontSize) + "px";
      });
    };
    renderFrameRef.current = renderCurrentFrame;

    const scheduleNextFrame = () => {
      if (
        frameRef.current === null &&
        typeof window.requestAnimationFrame === "function" &&
        MOVING_PHASES.has(phaseRef.current) &&
        !document.hidden
      ) {
        frameRef.current = window.requestAnimationFrame(animate);
      }
    };

    const animate = (timestamp: number) => {
      frameRef.current = null;
      const currentPhase = phaseRef.current;
      if (!MOVING_PHASES.has(currentPhase)) return;
      if (document.hidden) {
        runtimeRef.current.lastTimestamp = null;
        return;
      }

      const runtime = runtimeRef.current;
      const deltaMs = runtime.lastTimestamp === null
        ? 0
        : Math.min(50, Math.max(0, timestamp - runtime.lastTimestamp));
      runtime.lastTimestamp = timestamp;

      const targetSpeed = speedBoostRef.current ? MAX_SPEED_MULTIPLIER : 1;
      const easeDuration = speedBoostRef.current ? 90 : 145;
      const speedAlpha = 1 - Math.exp(-deltaMs / easeDuration);
      speedMultiplierRef.current +=
        (targetSpeed - speedMultiplierRef.current) * speedAlpha;
      const movementDeltaMs = deltaMs * speedMultiplierRef.current;

      runtime.passElapsedMs += movementDeltaMs;
      runtime.sessionElapsedMs += movementDeltaMs;

      const activeDuration = Number.isFinite(durationMsRef.current) && durationMsRef.current > 0
        ? Math.max(1200, durationMsRef.current)
        : DEFAULT_PASS_DURATION_MS;
      const progress = Math.min(1.25, runtime.passElapsedMs / activeDuration);
      const nextGateZ = MCQ_GAME_GATE_START_Z + MCQ_GAME_TRAVEL_DISTANCE * progress;

      const previousCarX = carXRef.current;
      const targetX = targetCarXRef.current;
      const carAlpha = 1 - Math.exp(-deltaMs / 62);
      const nextCarX = previousCarX + (targetX - previousCarX) * carAlpha;
      carXRef.current = nextCarX;

      let collidedMapping: (typeof gateMappings)[number] | null = null;
      if (
        currentPhase === "RUNNING" &&
        !disabledRef.current &&
        !submittedRef.current
      ) {
        for (const mapping of gateMappingsRef.current) {
          const collided = detectSweptGateCollision({
            previousGateZ: runtime.previousGateZ,
            gateZ: nextGateZ,
            collisionZ: MCQ_GAME_COLLISION_Z,
            previousCarX,
            carX: nextCarX,
            gateX: MCQ_GAME_LANE_X[mapping.laneIndex],
            carHalfWidth: MCQ_GAME_CAR_HALF_WIDTH,
            gateHalfWidth: MCQ_GAME_GATE_HALF_WIDTH,
          });
          if (collided) {
            collidedMapping = mapping;
            break;
          }
        }
      }

      runtime.lastScrollOffset =
        (runtime.sessionElapsedMs * MCQ_GAME_TRAVEL_DISTANCE / activeDuration) % 8;
      runtime.lastGateZ = nextGateZ;

      if (collidedMapping && !submittedRef.current) {
        // Lock before calling quiz code so even re-entrant callbacks cannot
        // submit the same gate twice. The quiz engine remains the score owner.
        submittedRef.current = true;
        phaseRef.current = "ANSWERING";
        setPhase("ANSWERING");
        runtime.previousGateZ = nextGateZ;
        renderCurrentFrame();
        onCollisionRef.current(
          collidedMapping.laneIndex,
          collidedMapping.optionValue,
          collidedMapping.gateId,
        );
      } else {
        if (nextGateZ >= MCQ_GAME_COLLISION_Z + 0.8) {
          // A miss advances to a fresh physical gate pass; it is not an answer.
          runtime.passElapsedMs = 0;
          runtime.previousGateZ = MCQ_GAME_GATE_START_Z;
          runtime.lastGateZ = MCQ_GAME_GATE_START_Z;
        } else {
          runtime.previousGateZ = nextGateZ;
        }
        renderCurrentFrame();
      }

      scheduleNextFrame();
    };

    animationLoopRef.current = animate;
    scheduleFrameRef.current = scheduleNextFrame;

    phaseRef.current = document.hidden || disabledRef.current ? "PAUSED" : "RUNNING";
    phaseBeforePauseRef.current = "RUNNING";
    setPhase(phaseRef.current);
    renderCurrentFrame();
    scheduleNextFrame();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (MOVING_PHASES.has(phaseRef.current)) {
          phaseBeforePauseRef.current = phaseRef.current;
          phaseRef.current = "PAUSED";
          setPhase("PAUSED");
        }
        if (frameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(frameRef.current);
        }
        frameRef.current = null;
        runtimeRef.current.lastTimestamp = null;
        return;
      }

      if (phaseRef.current === "PAUSED" && !rendererErrorRef.current) {
        const restoredPhase: GamePhase = submittedRef.current
          ? feedbackRef.current ? "FEEDBACK" : "ANSWERING"
          : disabledRef.current ? "PAUSED" : "RUNNING";
        phaseRef.current = restoredPhase;
        setPhase(restoredPhase);
        runtimeRef.current.lastTimestamp = null;
        scheduleNextFrame();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (frameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      scene.dispose();
      if (sceneRef.current === scene) sceneRef.current = null;
      renderFrameRef.current = null;
      animationLoopRef.current = null;
      scheduleFrameRef.current = null;
      gateLabelRefs.current = [];
    };
  }, []);

  useEffect(() => {
    const key = String(questionKey);
    const runtime = runtimeRef.current;
    if (runtime.activeQuestionKey === key) return;

    runtime.activeQuestionKey = key;
    runtime.passElapsedMs = 0;
    runtime.previousGateZ = MCQ_GAME_GATE_START_Z;
    runtime.lastGateZ = MCQ_GAME_GATE_START_Z;
    runtime.lastTimestamp = null;
    submittedRef.current = false;
    speedMultiplierRef.current = 1;
    clearActiveGesture();

    if (rendererErrorRef.current) {
      phaseRef.current = "ERROR";
      setPhase("ERROR");
      return;
    }

    const nextPhase: GamePhase = document.hidden || disabledRef.current ? "PAUSED" : "RUNNING";
    phaseRef.current = nextPhase;
    phaseBeforePauseRef.current = "RUNNING";
    setPhase(nextPhase);
    renderFrameRef.current?.();
    if (nextPhase === "RUNNING") scheduleFrameRef.current?.();
  }, [questionKey, clearActiveGesture]);

  useEffect(() => {
    if (!feedback) return;
    submittedRef.current = true;
    if (phaseRef.current === "PAUSED") {
      phaseBeforePauseRef.current = "FEEDBACK";
    } else {
      phaseRef.current = "FEEDBACK";
      setPhase("FEEDBACK");
    }
    renderFrameRef.current?.();
  }, [feedback]);

  useEffect(() => {
    if (disabled && !feedback && phaseRef.current === "RUNNING") {
      phaseBeforePauseRef.current = "RUNNING";
      phaseRef.current = "PAUSED";
      setPhase("PAUSED");
      if (frameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      runtimeRef.current.lastTimestamp = null;
      clearActiveGesture();
      return;
    }

    if (
      !disabled &&
      phaseRef.current === "PAUSED" &&
      !document.hidden &&
      !submittedRef.current &&
      !rendererErrorRef.current
    ) {
      phaseRef.current = "RUNNING";
      setPhase("RUNNING");
      runtimeRef.current.lastTimestamp = null;
      scheduleFrameRef.current?.();
    }
  }, [disabled, feedback, clearActiveGesture]);

  const correctLane = options.findIndex(
    (option) => String(option.value) === String(correctAnswer),
  );

  return createPortal(
    <section
      className="mcq-game-shell"
      aria-label="MCQ 3D car racing game"
      data-game-phase={phase}
    >
      <div className="mcq-game-hud" data-game-no-steer="true">
        <div className="mcq-game-scores">
          <span className="mcq-game-score" aria-label={"Correct answers: " + String(correctScore)}>
            <span aria-hidden="true">✓</span>
            <strong>{correctScore}</strong>
          </span>
          <span className="mcq-game-wrong" aria-label={"Wrong answers: " + String(wrongScore)}>
            <span aria-hidden="true">×</span>
            <strong>{wrongScore}</strong>
          </span>
          {timerLabel ? <span className="mcq-game-timer">{timerLabel}</span> : null}
          {isBoosting ? <Zap className="mcq-game-boost-indicator" size={17} aria-label="Speed boost active" /> : null}
        </div>
        <div className="mcq-game-hud-actions">
          <span className="mcq-game-progress" aria-label="Quiz progress">
            {progressLabel || "4"}
          </span>
          <button
            type="button"
            className="mcq-game-exit"
            aria-label="Exit quiz"
            onClick={() => onExit?.()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className="mcq-game-stage"
        role="group"
        aria-label="Four answer lanes; tap the left or right side to steer"
        tabIndex={0}
        data-lane-index={lane}
        data-swipe-ignore-app-section="true"
        data-swipe-ignore-back="true"
        onPointerDown={handlePointerDown}
        onPointerUp={(event) => finishPointerGesture(event)}
        onPointerCancel={(event) => finishPointerGesture(event, true)}
        onLostPointerCapture={(event) => finishPointerGesture(event, true)}
        onKeyDown={(event) => {
          if (event.repeat) return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            changeLane(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            changeLane(1);
          }
        }}
      >
        <canvas
          ref={canvasRef}
          className="mcq-game-canvas"
          aria-label="Interactive 3D road, car and four answer gates"
        />

        <div
          className="mcq-game-question"
          data-game-no-steer="true"
          aria-label="Current question"
        >
          <div className="mcq-game-question-content">{questionContent}</div>
          {feedback ? (
            <span className={"mcq-game-feedback mcq-game-feedback--" + feedback}>
              {feedback === "correct" ? "✓" : selectedOption === null ? "Time" : "×"}
            </span>
          ) : null}
        </div>

        {rendererError ? (
          <div className="mcq-game-renderer-fallback" role="group" aria-label="Answer choices">
            <div className="mcq-game-fallback-message" role="alert">
              <CarFront size={22} aria-hidden="true" />
              <span>{rendererError}</span>
            </div>
            <div className="mcq-game-fallback-options">
              {gateMappings.map((mapping, index) => (
                <button
                  type="button"
                  key={mapping.gateId}
                  className={[
                    "mcq-game-fallback-option",
                    feedback && selectedOption === index
                      ? feedback === "correct" ? "is-correct" : "is-wrong"
                      : "",
                    feedback && correctLane === index ? "is-answer" : "",
                  ].filter(Boolean).join(" ")}
                  aria-label={"Lane " + String(index + 1) + ", answer " + String(mapping.optionValue)}
                  disabled={disabled || submittedRef.current || !!feedback}
                  onClick={() => submitFallbackAnswer(index)}
                >
                  <span className="mcq-game-gate-letter">{LANE_LABELS[index]}</span>
                  <span className="mcq-game-gate-answer">
                    {mapping.optionValue === options[index]?.value
                      ? options[index]?.label
                      : String(mapping.optionValue)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mcq-game-gate-overlay" role="list" aria-label="Four answer gates">
            {gateMappings.map((mapping, index) => {
              const isSelected = feedback !== null && selectedOption === index;
              const isCorrect = feedback !== null && correctLane === index;
              const className = [
                "mcq-game-gate-label",
                isSelected && feedback === "correct" ? "mcq-game-gate--correct" : "",
                isCorrect ? "mcq-game-gate--correct" : "",
                isSelected && feedback === "wrong" ? "mcq-game-gate--wrong" : "",
              ].filter(Boolean).join(" ");

              return (
                <div
                  key={mapping.gateId}
                  ref={(element) => { gateLabelRefs.current[index] = element; }}
                  className={className}
                  role="listitem"
                  data-gate-id={mapping.gateId}
                  data-option-id={mapping.optionId}
                  data-lane-id={mapping.laneId}
                  data-game-no-steer="true"
                  aria-label={"Lane " + String(index + 1) + ", answer " + String(mapping.optionValue)}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <span className="mcq-game-gate-letter">{LANE_LABELS[index]}</span>
                  <span className="mcq-game-gate-answer">
                    {options[index]?.label ?? String(mapping.optionValue)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {isBoosting ? (
          <div className="mcq-game-boost-flare" aria-hidden="true">
            <Zap size={22} />
          </div>
        ) : null}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {feedback === "correct"
          ? "Correct answer. Score updated by the quiz engine."
          : feedback === "wrong" && selectedOption !== null
            ? "Wrong answer. Repetition and scoring are handled by the quiz engine."
            : feedback === "wrong"
              ? "Time expired. Existing quiz timer applied."
              : rendererError
                ? "Accessibility fallback active."
                : phase === "PAUSED"
                  ? "Game paused."
                  : phase === "ANSWERING"
                    ? "Answer submitted."
                    : "Tap a side to steer. Hold to accelerate."}
      </p>
    </section>,
    document.body,
  );
};

export default MCQWithGame;
