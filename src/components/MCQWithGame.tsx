import { useCallback, useEffect, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import { ArrowLeft, ArrowRight, CarFront, RotateCcw } from "lucide-react";
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
import "./mcq-game.css";

export interface MCQWithGameOption {
  value: MCQGameValue;
  label: ReactNode;
}

type GamePhase = "INITIALIZING" | "RUNNING" | "ANSWERING" | "FEEDBACK" | "PAUSED" | "ERROR";

interface MCQWithGameProps {
  questionKey: string | number;
  options: MCQWithGameOption[];
  correctAnswer: MCQGameValue;
  feedback: "correct" | "wrong" | null;
  selectedOption: number | null;
  correctScore: number;
  wrongScore: number;
  durationMs: number;
  progressLabel?: string;
  disabled?: boolean;
  onCollision: (laneIndex: number, optionValue: MCQGameValue, gateId: string) => void;
}

const LANE_LABELS = ["A", "B", "C", "D"] as const;
const DEFAULT_PASS_DURATION_MS = 5200;

const MCQWithGame = ({
  questionKey,
  options,
  correctAnswer,
  feedback,
  selectedOption,
  correctScore,
  wrongScore,
  durationMs,
  progressLabel,
  disabled = false,
  onCollision,
}: MCQWithGameProps) => {
  const [lane, setLane] = useState(1);
  const [phase, setPhase] = useState<GamePhase>("INITIALIZING");
  const [rendererError, setRendererError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gateLabelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sceneRef = useRef<MCQ3DScene | null>(null);
  const frameRef = useRef<number | null>(null);
  const drawCurrentFrameRef = useRef<(() => void) | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const laneRef = useRef(lane);
  const targetCarXRef = useRef<number>(MCQ_GAME_LANE_X[lane]);
  const carXRef = useRef<number>(MCQ_GAME_LANE_X[lane]);
  const submittedRef = useRef(false);
  const phaseRef = useRef<GamePhase>("INITIALIZING");
  const disabledRef = useRef(disabled);
  const feedbackRef = useRef(feedback);
  const selectedOptionRef = useRef(selectedOption);
  const correctLaneRef = useRef(-1);
  const onCollisionRef = useRef(onCollision);

  disabledRef.current = disabled;
  feedbackRef.current = feedback;
  selectedOptionRef.current = selectedOption;
  correctLaneRef.current = options.findIndex((option) => String(option.value) === String(correctAnswer));
  onCollisionRef.current = onCollision;

  const gateMappingsRef = useRef<ReturnType<typeof createMCQGateMappings>>([]);
  const mappingsNeedRefresh =
    gateMappingsRef.current.length !== Math.min(4, options.length) ||
    gateMappingsRef.current[0]?.questionId !== String(questionKey) ||
    gateMappingsRef.current.some((mapping, index) => !Object.is(mapping.optionValue, options[index]?.value));
  if (mappingsNeedRefresh) {
    gateMappingsRef.current = createMCQGateMappings(questionKey, options.map((option) => option.value));
  }
  const gateMappings = gateMappingsRef.current;

  const changeLane = useCallback((direction: -1 | 1) => {
    if (disabledRef.current || phaseRef.current !== "RUNNING" || submittedRef.current) return;
    const nextLane = Math.max(0, Math.min(3, laneRef.current + direction));
    laneRef.current = nextLane;
    targetCarXRef.current = MCQ_GAME_LANE_X[nextLane];
    setLane(nextLane);
  }, []);

  const submitFallbackAnswer = useCallback((mappingIndex: number) => {
    const mapping = gateMappings[mappingIndex];
    if (!mapping || disabledRef.current || submittedRef.current || feedbackRef.current) return;
    submittedRef.current = true;
    phaseRef.current = "ANSWERING";
    setPhase("ANSWERING");
    onCollisionRef.current(mapping.laneIndex, mapping.optionValue, mapping.gateId);
  }, [gateMappings]);

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartXRef.current = null;
    if (startX === null || endX === undefined) return;
    const delta = endX - startX;
    if (Math.abs(delta) < 28) return;
    changeLane(delta < 0 ? -1 : 1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let scene: MCQ3DScene;
    try {
      scene = createMCQ3DScene(canvas);
    } catch {
      phaseRef.current = "ERROR";
      setPhase("ERROR");
      setRendererError("3D graphics could not start on this device. Choose an answer below to continue this quiz.");
      return;
    }

    sceneRef.current = scene;
    setRendererError(null);

    const safeDuration = Number.isFinite(durationMs) && durationMs > 0
      ? Math.max(1200, durationMs)
      : DEFAULT_PASS_DURATION_MS;
    const prefersReducedMotion = typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let lastTimestamp: number | null = null;
    let passElapsedMs = 0;
    let sessionElapsedMs = 0;
    let previousGateZ = MCQ_GAME_GATE_START_Z;
    let lastGateZ = MCQ_GAME_GATE_START_Z;
    let lastScrollOffset = 0;

    const renderFrame = () => {
      const gateFeedback: MCQGateFeedback[] = gateMappings.map((mapping) => {
        const currentFeedback = feedbackRef.current;
        if (currentFeedback === "correct" && mapping.laneIndex === correctLaneRef.current) return "correct";
        if (currentFeedback === "wrong" && mapping.laneIndex === selectedOptionRef.current) return "wrong";
        if (currentFeedback === "wrong" && selectedOptionRef.current === null &&
            mapping.laneIndex === correctLaneRef.current) return "correct";
        return "normal";
      });
      const projections = scene.render({
        carX: carXRef.current,
        gateZ: lastGateZ,
        scrollOffset: lastScrollOffset,
        gateFeedback,
      });

      projections.forEach((projection, index) => {
        const element = gateLabelRefs.current[index];
        if (!element) return;
        element.style.display = projection.visible ? "flex" : "none";
        element.style.left = String(projection.x) + "px";
        element.style.top = String(projection.y) + "px";
        element.style.width = String(projection.width) + "px";
        element.style.height = String(projection.height) + "px";
        element.style.fontSize = String(projection.fontSize) + "px";
      });
    };
    drawCurrentFrameRef.current = renderFrame;

    phaseRef.current = document.hidden ? "PAUSED" : "RUNNING";
    setPhase(phaseRef.current);
    renderFrame();

    const animate = (timestamp: number) => {
      frameRef.current = null;
      if (phaseRef.current !== "RUNNING" || disabledRef.current || submittedRef.current) return;
      if (document.hidden) {
        lastTimestamp = null;
        return;
      }

      const deltaMs = lastTimestamp === null ? 0 : Math.min(50, Math.max(0, timestamp - lastTimestamp));
      lastTimestamp = timestamp;
      passElapsedMs += deltaMs;
      sessionElapsedMs += deltaMs;

      const progress = Math.min(1.25, passElapsedMs / safeDuration);
      const nextGateZ = MCQ_GAME_GATE_START_Z + MCQ_GAME_TRAVEL_DISTANCE * progress;
      const previousCarX = carXRef.current;
      const targetX = targetCarXRef.current;
      const carAlpha = prefersReducedMotion ? 1 : 1 - Math.exp(-deltaMs / 62);
      const nextCarX = previousCarX + (targetX - previousCarX) * carAlpha;
      carXRef.current = nextCarX;

      let collisionIndex = -1;
      for (const mapping of gateMappings) {
        if (detectSweptGateCollision({
          previousGateZ,
          gateZ: nextGateZ,
          collisionZ: MCQ_GAME_COLLISION_Z,
          previousCarX,
          carX: nextCarX,
          gateX: MCQ_GAME_LANE_X[mapping.laneIndex],
          carHalfWidth: MCQ_GAME_CAR_HALF_WIDTH,
          gateHalfWidth: MCQ_GAME_GATE_HALF_WIDTH,
        })) {
          collisionIndex = mapping.laneIndex;
          break;
        }
      }

      lastScrollOffset = (sessionElapsedMs * MCQ_GAME_TRAVEL_DISTANCE / safeDuration) % 8;
      lastGateZ = nextGateZ;

      if (collisionIndex >= 0) {
        const mapping = gateMappings[collisionIndex];
        if (mapping && !submittedRef.current) {
          submittedRef.current = true;
          phaseRef.current = "ANSWERING";
          setPhase("ANSWERING");
          renderFrame();
          onCollisionRef.current(mapping.laneIndex, mapping.optionValue, mapping.gateId);
          return;
        }
      }

      if (nextGateZ >= MCQ_GAME_COLLISION_Z + 0.8) {
        // A missed gate is not an answer. Let another real gate pass arrive;
        // the existing quiz timer remains the authority for timeout handling.
        passElapsedMs = 0;
        previousGateZ = MCQ_GAME_GATE_START_Z;
        lastGateZ = MCQ_GAME_GATE_START_Z;
      } else {
        previousGateZ = nextGateZ;
      }

      renderFrame();
      if (typeof window.requestAnimationFrame === "function") {
        frameRef.current = window.requestAnimationFrame(animate);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (phaseRef.current === "RUNNING") {
          phaseRef.current = "PAUSED";
          setPhase("PAUSED");
        }
        if (frameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(frameRef.current);
        }
        frameRef.current = null;
        lastTimestamp = null;
        return;
      }

      if (phaseRef.current === "PAUSED" && !submittedRef.current && !disabledRef.current) {
        phaseRef.current = "RUNNING";
        setPhase("RUNNING");
        lastTimestamp = null;
        if (typeof window.requestAnimationFrame === "function") {
          frameRef.current = window.requestAnimationFrame(animate);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (!document.hidden && !disabledRef.current && typeof window.requestAnimationFrame === "function") {
      frameRef.current = window.requestAnimationFrame(animate);
    }

    return () => {
      if (frameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      scene.dispose();
      if (sceneRef.current === scene) sceneRef.current = null;
      drawCurrentFrameRef.current = null;
      gateLabelRefs.current = [];
    };
  }, [questionKey, durationMs, gateMappings]);

  useEffect(() => {
    if (!feedback) return;
    submittedRef.current = true;
    phaseRef.current = "FEEDBACK";
    setPhase("FEEDBACK");
    if (frameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = null;
    drawCurrentFrameRef.current?.();
  }, [feedback]);

  useEffect(() => {
    if (!disabled || feedback || submittedRef.current) return;
    if (phaseRef.current === "RUNNING") {
      phaseRef.current = "PAUSED";
      setPhase("PAUSED");
      if (frameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
    }
  }, [disabled, feedback]);

  const correctLane = options.findIndex((option) => String(option.value) === String(correctAnswer));
  const canSteer = !disabled && !submittedRef.current && phase === "RUNNING";
  const laneMessage = phase === "PAUSED"
    ? "Paused while the app is in the background"
    : phase === "ANSWERING"
      ? "Gate collision detected · answer submitted"
      : phase === "FEEDBACK"
        ? feedback === "correct" ? "Correct gate!" : "Wrong gate · correct answer highlighted"
        : "Steer into an answer gate as it reaches the car";

  return (
    <section className="mcq-game-shell mt-4" aria-label="MCQ 3D car racing game">
      <div className="mcq-game-hud">
        <span className="mcq-game-score">Correct <strong>{correctScore}</strong></span>
        <span className="mcq-game-wrong">Wrong <strong>{wrongScore}</strong></span>
        <span className="mcq-game-progress">{progressLabel || "4 ANSWER GATES"}</span>
      </div>

      <div
        className="mcq-game-stage"
        role="group"
        aria-label="Four answer lanes; steer the 3D car left or right to collide with an answer gate"
        tabIndex={0}
        data-swipe-ignore-app-section="true"
        data-swipe-ignore-back="true"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            changeLane(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            changeLane(1);
          }
        }}
      >
        {rendererError ? (
          <div className="mcq-game-renderer-fallback">
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
                    feedback && selectedOption === index ? feedback === "correct" ? "is-correct" : "is-wrong" : "",
                    feedback && correctLane === index ? "is-answer" : "",
                  ].filter(Boolean).join(" ")}
                  aria-label={"Lane " + String(index + 1) + ", answer " + String(mapping.optionValue)}
                  disabled={disabled || submittedRef.current || !!feedback}
                  onClick={() => submitFallbackAnswer(index)}
                >
                  <span className="mcq-game-gate-letter">{LANE_LABELS[index]}</span>
                  <span className="mcq-game-gate-answer">{mapping.optionValue === options[index]?.value ? options[index]?.label : String(mapping.optionValue)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              className="mcq-game-canvas"
              aria-label="Interactive 3D road, low-poly car and four answer gates"
            />
            <div className="mcq-game-gate-overlay" aria-label="Four answer gates">
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
                    data-gate-id={mapping.gateId}
                    data-option-id={mapping.optionId}
                    data-lane-id={mapping.laneId}
                    aria-label={"Lane " + String(index + 1) + ", answer " + String(mapping.optionValue)}
                  >
                    <span className="mcq-game-gate-letter">{LANE_LABELS[index]}</span>
                    <span className="mcq-game-gate-answer">{options[index]?.label ?? String(mapping.optionValue)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mcq-game-lane-readout" aria-live="polite">
              Lane {lane + 1} · {LANE_LABELS[lane]}
            </div>
            <div className="mcq-game-steering-hint" aria-hidden="true">
              <CarFront size={16} /> 3D RACING · HIT THE ANSWER GATE
            </div>
          </>
        )}
      </div>

      {!rendererError && (
        <div className="mcq-game-controls" aria-label="Car steering controls">
          <button type="button" onClick={() => changeLane(-1)} disabled={!canSteer} aria-label="Steer left">
            <ArrowLeft size={19} />
            Left
          </button>
          <span className="mcq-game-controls-hint">
            <RotateCcw size={13} aria-hidden="true" /> One lane per swipe
          </span>
          <button type="button" onClick={() => changeLane(1)} disabled={!canSteer} aria-label="Steer right">
            Right
            <ArrowRight size={19} />
          </button>
        </div>
      )}

      <p className="mcq-game-status" role="status" aria-live="polite">
        {feedback === "correct"
          ? "Correct · score updated by the quiz engine"
          : feedback === "wrong" && selectedOption !== null
            ? "Wrong · repetition and scoring handled by the quiz engine"
            : feedback === "wrong"
              ? "Time's up · existing quiz timer applied"
              : rendererError
                ? "Accessibility fallback active; your quiz configuration is preserved"
                : phase === "PAUSED"
                  ? "Paused while the app is in the background"
                  : phase === "ANSWERING"
                    ? "Gate collision detected · answer submitted"
                    : laneMessage}
      </p>
    </section>
  );
};

export default MCQWithGame;
