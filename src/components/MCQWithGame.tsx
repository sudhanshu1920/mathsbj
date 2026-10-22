import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CarFront, Check, Send, Timer, X } from "lucide-react";
import type { MCQGameValue } from "@/lib/mcqGame";
import {
  MCQ_GAME_CAR_HALF_WIDTH,
  MCQ_GAME_COLLISION_Z,
  MCQ_GAME_GATE_HALF_WIDTH,
  MCQ_GAME_GATE_START_Z,
  MCQ_GAME_GESTURE_MOVE_TOLERANCE_PX,
  MCQ_GAME_HOLD_THRESHOLD_MS,
  MCQ_GAME_LANE_X,
  MCQ_GAME_ROAD_SCROLL_UNITS_PER_MS,
  MCQ_GAME_TRAVEL_DISTANCE,
  MCQ_GAME_BASE_SPEED_MULTIPLIER,
  MCQ_GAME_MAX_SPEED_MULTIPLIER,
  advanceMCQGameSpeed,
  clampMCQGameLane,
  classifySteeringGesture,
  createMCQGateMappings,
  detectSweptGateCollision,
} from "@/lib/mcqGamePhysics";
import {
  createMCQ3DScene,
  type MCQ3DScene,
  type MCQGateFeedback,
} from "@/lib/mcq3dRenderer";
import { setGameImmersiveMode } from "@/lib/gameImmersiveMode";
import { createRacingAudioController, playClick, playSwipe, type RacingAudioController } from "@/lib/sound";
import "./mcq-game.css";

export interface MCQWithGameOption {
  value: MCQGameValue;
  label: ReactNode;
}

type GamePhase = "INITIALIZING" | "RUNNING" | "ANSWERING" | "FEEDBACK" | "PAUSED" | "ERROR";

interface MCQWithGameProps {
  questionKey: string | number;
  questionLabel: ReactNode;
  options: MCQWithGameOption[];
  correctAnswer: MCQGameValue;
  feedback: "correct" | "wrong" | null;
  selectedOption: number | null;
  correctScore: number;
  wrongScore: number;
  durationMs: number;
  progressLabel?: string;
  timerLabel?: string;
  disabled?: boolean;
  onSelectOption: (laneIndex: number, optionValue: MCQGameValue, gateId: string) => void;
  onSubmitAnswer: (laneIndex: number, optionValue: MCQGameValue, gateId: string) => void;
}

const DEFAULT_PASS_DURATION_MS = 5200;

interface SteeringPress {
  pointerId: number;
  direction: -1 | 1;
  startedAt: number;
  startX: number;
  startY: number;
  movementExceeded: boolean;
  boostTriggered: boolean;
}

const MCQWithGame = ({
  questionKey,
  questionLabel,
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
  onSelectOption,
  onSubmitAnswer,
}: MCQWithGameProps) => {
  const [lane, setLane] = useState(1);
  const [phase, setPhase] = useState<GamePhase>("INITIALIZING");
  const [boosting, setBoosting] = useState(false);
  const [rendererError, setRendererError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const questionPanelRef = useRef<HTMLDivElement | null>(null);
  const gateLabelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sceneRef = useRef<MCQ3DScene | null>(null);
  const racingAudioRef = useRef<RacingAudioController | null>(null);
  const frameRef = useRef<number | null>(null);
  const drawCurrentFrameRef = useRef<(() => void) | null>(null);
  const scheduleFrameRef = useRef<(() => void) | null>(null);

  const laneRef = useRef(lane);
  const targetCarXRef = useRef<number>(MCQ_GAME_LANE_X[lane]);
  const carXRef = useRef<number>(MCQ_GAME_LANE_X[lane]);
  const submittedRef = useRef(false);
  const phaseRef = useRef<GamePhase>("INITIALIZING");
  const disabledRef = useRef(disabled);
  const feedbackRef = useRef(feedback);
  const selectedOptionRef = useRef(selectedOption);
  const correctLaneRef = useRef(-1);
  const onSelectOptionRef = useRef(onSelectOption);
  const onSubmitAnswerRef = useRef(onSubmitAnswer);
  const activeQuestionKeyRef = useRef(String(questionKey));
  const boostingRef = useRef(false);
  const speedMultiplierRef = useRef(MCQ_GAME_BASE_SPEED_MULTIPLIER);
  const touchGestureRef = useRef<SteeringPress | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const passElapsedMsRef = useRef(0);
  const collisionPassConsumedRef = useRef(false);
  const questionPanelBottomRef = useRef(0);
  const previousGateZRef = useRef(MCQ_GAME_GATE_START_Z);
  const gateZRef = useRef(MCQ_GAME_GATE_START_Z);
  const scrollOffsetRef = useRef(0);
  const lastTimestampRef = useRef<number | null>(null);

  const latestPropsRef = useRef({
    questionKey: String(questionKey),
    questionLabel,
    options,
    correctAnswer,
    feedback,
    selectedOption,
    correctScore,
    wrongScore,
    durationMs,
    progressLabel,
    timerLabel,
    disabled,
    onSelectOption,
    onSubmitAnswer,
  });
  latestPropsRef.current = {
    questionKey: String(questionKey),
    questionLabel,
    options,
    correctAnswer,
    feedback,
    selectedOption,
    correctScore,
    wrongScore,
    durationMs,
    progressLabel,
    timerLabel,
    disabled,
    onSelectOption,
    onSubmitAnswer,
  };

  const nextMappings = createMCQGateMappings(questionKey, options.map((option) => option.value));
  const gateMappingsRef = useRef(nextMappings);
  const mappingsHaveChanged =
    gateMappingsRef.current.length !== nextMappings.length ||
    gateMappingsRef.current.some((mapping, index) =>
      mapping.gateId !== nextMappings[index]?.gateId ||
      !Object.is(mapping.optionValue, nextMappings[index]?.optionValue),
    );
  if (mappingsHaveChanged) gateMappingsRef.current = nextMappings;
  const gateMappings = gateMappingsRef.current;

  disabledRef.current = disabled;
  feedbackRef.current = feedback;
  selectedOptionRef.current = selectedOption;
  correctLaneRef.current = options.findIndex((option) => String(option.value) === String(correctAnswer));
  onSelectOptionRef.current = onSelectOption;
  onSubmitAnswerRef.current = onSubmitAnswer;

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const endBoost = useCallback(() => {
    boostingRef.current = false;
    setBoosting(false);
  }, []);

  const changeLane = useCallback((direction: -1 | 1) => {
    if (disabledRef.current || phaseRef.current !== "RUNNING" || submittedRef.current) return;
    const nextLane = clampMCQGameLane(laneRef.current, direction);
    if (nextLane === laneRef.current) return;
    laneRef.current = nextLane;
    targetCarXRef.current = MCQ_GAME_LANE_X[nextLane];
    setLane(nextLane);
  }, []);

  const selectLaneAnswer = useCallback((mappingIndex: number) => {
    const mapping = gateMappingsRef.current[mappingIndex];
    const phaseAllowsSelection = phaseRef.current === "RUNNING" || phaseRef.current === "ERROR";
    if (
      !mapping ||
      mapping.questionId !== activeQuestionKeyRef.current ||
      !phaseAllowsSelection ||
      disabledRef.current ||
      submittedRef.current ||
      feedbackRef.current
    ) return;

    if (selectedOptionRef.current === mapping.laneIndex) return;
    // Consume this approaching gate pass so a later physical crossing cannot
    // overwrite an intentional touch selection from the same pass.
    collisionPassConsumedRef.current = true;
    // Publish selection before invoking React state so a rapid next action
    // cannot read an old lane while the parent rerender is still pending.
    selectedOptionRef.current = mapping.laneIndex;
    // Play once only when a different option becomes selected.
    racingAudioRef.current?.unlock();
    playSwipe();
    onSelectOptionRef.current(mapping.laneIndex, mapping.optionValue, mapping.gateId);
  }, []);

  const submitLaneAnswer = useCallback(() => {
    const selectedIndex = selectedOptionRef.current;
    const mapping = selectedIndex === null ? undefined : gateMappingsRef.current[selectedIndex];
    const phaseAllowsSubmission = phaseRef.current === "RUNNING" || phaseRef.current === "ERROR";
    if (
      !mapping ||
      !Number.isInteger(selectedIndex) ||
      mapping.questionId !== activeQuestionKeyRef.current ||
      !phaseAllowsSubmission ||
      disabledRef.current ||
      submittedRef.current ||
      feedbackRef.current
    ) return;

    // Lock synchronously before entering the heavier existing Quiz Engine path.
    // Immediate button click cue; correctness tones remain owned by the Quiz Engine.
    racingAudioRef.current?.unlock();
    playClick();
    submittedRef.current = true;
    phaseRef.current = "ANSWERING";
    setPhase("ANSWERING");
    onSubmitAnswerRef.current(mapping.laneIndex, mapping.optionValue, mapping.gateId);
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((typeof event.button === "number" && event.button !== 0) ||
        disabledRef.current || phaseRef.current !== "RUNNING" || submittedRef.current ||
        touchGestureRef.current) return;
    const pointerId = Number.isFinite(event.pointerId) ? event.pointerId : 1;
    const startX = Number.isFinite(event.clientX) ? event.clientX : 0;
    if ((event.target as HTMLElement | null)?.closest?.(".mcq-game-topbar, .mcq-game-question-panel, .mcq-game-gate-label, .mcq-game-fallback-option")) return;

    // AudioContext must be resumed directly from a trusted gesture on mobile.
    racingAudioRef.current?.unlock();
    const rect = event.currentTarget.getBoundingClientRect();
    const direction: -1 | 1 = startX < rect.left + rect.width / 2 ? -1 : 1;
    clearHoldTimer();
    touchGestureRef.current = {
      pointerId,
      direction,
      startedAt: performance.now(),
      startX,
      startY: Number.isFinite(event.clientY) ? event.clientY : 0,
      movementExceeded: false,
      boostTriggered: false,
    };

    try {
      event.currentTarget.setPointerCapture(pointerId);
    } catch {
      // Pointer capture is unavailable in some test browsers; window-level interaction state still works.
    }

    holdTimerRef.current = setTimeout(() => {
      const press = touchGestureRef.current;
      if (!press || press.pointerId !== pointerId ||
          phaseRef.current === "PAUSED" || phaseRef.current === "ERROR" || document.hidden ||
          press.movementExceeded) return;
      // A hold may cross a question boundary: keep accelerating until the
      // physical pointer is released, even while that answer is being processed.
      press.boostTriggered = true;
      boostingRef.current = true;
      setBoosting(true);
    }, MCQ_GAME_HOLD_THRESHOLD_MS);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const press = touchGestureRef.current;
    const eventPointerId = Number.isFinite(event.pointerId) ? event.pointerId : null;
    if (!press || (eventPointerId !== null && eventPointerId > 0 && eventPointerId !== press.pointerId)) return;
    if (press.movementExceeded) return;

    const x = Number.isFinite(event.clientX) ? event.clientX : press.startX;
    const y = Number.isFinite(event.clientY) ? event.clientY : press.startY;
    const dx = x - press.startX;
    const dy = y - press.startY;
    if (dx * dx + dy * dy <= MCQ_GAME_GESTURE_MOVE_TOLERANCE_PX ** 2) return;

    press.movementExceeded = true;
    clearHoldTimer();
    if (press.boostTriggered) endBoost();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const press = touchGestureRef.current;
    const eventPointerId = Number.isFinite(event.pointerId) ? event.pointerId : null;
    // Some DOM test environments synthesize pointerup with an ID unrelated
    // to the pointerdown when PointerEvent is unsupported. Real browsers fill
    // pointerType on both events, so enforce identity whenever it is reliable.
    const identityIsReliable = event.pointerType === "touch" || event.pointerType === "pen";
    if (!press || (identityIsReliable && eventPointerId !== null && eventPointerId > 0 &&
        press.pointerId !== eventPointerId)) return;

    clearHoldTimer();
    touchGestureRef.current = null;
    const duration = Math.max(0, performance.now() - press.startedAt);
    const result = classifySteeringGesture(duration, press.direction);

    if (press.movementExceeded) {
      endBoost();
      return;
    }
    if (press.boostTriggered || result.kind === "boost") {
      endBoost();
      return;
    }
    // Side and direction are fixed on pointer-down; release coordinates are
    // deliberately irrelevant so small touch jitter never drops a short tap.
    endBoost();
    changeLane(result.direction);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const eventPointerId = Number.isFinite(event.pointerId) ? event.pointerId : null;
    const activePointerId = touchGestureRef.current?.pointerId;
    const identityIsReliable = event.pointerType === "touch" || event.pointerType === "pen";
    if (!touchGestureRef.current || (identityIsReliable && eventPointerId !== null && eventPointerId > 0 &&
        activePointerId !== eventPointerId)) return;
    clearHoldTimer();
    touchGestureRef.current = null;
    endBoost();
  };

  useEffect(() => {
    const controller = createRacingAudioController(MCQ_GAME_BASE_SPEED_MULTIPLIER, MCQ_GAME_MAX_SPEED_MULTIPLIER);
    racingAudioRef.current = controller;
    return () => {
      controller.dispose();
      if (racingAudioRef.current === controller) racingAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    const handleWindowBlur = () => {
      clearHoldTimer();
      touchGestureRef.current = null;
      endBoost();
      racingAudioRef.current?.pause();
    };
    const handleWindowFocus = () => {
      if (!document.hidden) racingAudioRef.current?.resume();
    };
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    void setGameImmersiveMode(true);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      clearHoldTimer();
      touchGestureRef.current = null;
      boostingRef.current = false;
      void setGameImmersiveMode(false);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [clearHoldTimer]);

  useEffect(() => {
    const panel = questionPanelRef.current;
    if (!panel) return;

    const measurePanel = () => {
      questionPanelBottomRef.current = panel.getBoundingClientRect().bottom + 8;
    };
    measurePanel();

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measurePanel);
      observer.observe(panel);
    }
    window.addEventListener("resize", measurePanel);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measurePanel);
    };
  }, [questionKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let scene: MCQ3DScene;
    try {
      scene = createMCQ3DScene(canvas);
    } catch {
      phaseRef.current = "ERROR";
      setPhase("ERROR");
      setRendererError("3D graphics are unavailable. Select an answer to continue.");
      return;
    }

    sceneRef.current = scene;
    setRendererError(null);

    const prefersReducedMotion = typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderFrame = () => {
      const current = latestPropsRef.current;
      const mappings = gateMappingsRef.current;
      const gateFeedback: MCQGateFeedback[] = mappings.map((mapping) => {
        if (current.feedback === "correct" && mapping.laneIndex === correctLaneRef.current) return "correct";
        if (current.feedback === "wrong" && mapping.laneIndex === selectedOptionRef.current) return "wrong";
        if (current.feedback === "wrong" && current.selectedOption === null &&
            mapping.laneIndex === correctLaneRef.current) return "correct";
        return "normal";
      });
      const projections = scene.render({
        carX: carXRef.current,
        gateZ: gateZRef.current,
        scrollOffset: scrollOffsetRef.current,
        gateFeedback,
      });

      const panelBottom = questionPanelBottomRef.current;
      projections.forEach((projection, index) => {
        const element = gateLabelRefs.current[index];
        if (!element) return;
        const belowHud = projection.y - projection.height / 2 > panelBottom;
        const display = projection.visible && belowHud ? "flex" : "none";
        if (element.style.display !== display) element.style.display = display;

        const updatePx = (
          property: "left" | "top" | "width" | "height" | "fontSize",
          value: number,
        ) => {
          const previous = Number.parseFloat(element.style[property]);
          if (!Number.isFinite(previous) || Math.abs(previous - value) > 0.25) {
            element.style[property] = String(value) + "px";
          }
        };
        updatePx("left", projection.x);
        updatePx("top", projection.y);
        updatePx("width", projection.width);
        updatePx("height", projection.height);
        updatePx("fontSize", projection.fontSize);
      });
    };
    drawCurrentFrameRef.current = renderFrame;

    const animate = (timestamp: number) => {
      frameRef.current = null;
      if (phaseRef.current === "PAUSED" || phaseRef.current === "ERROR" || document.hidden) {
        lastTimestampRef.current = null;
        return;
      }

      const previousTimestamp = lastTimestampRef.current;
      const deltaMs = previousTimestamp === null
        ? 0
        : Math.min(100, Math.max(0, timestamp - previousTimestamp));
      lastTimestampRef.current = timestamp;

      const current = latestPropsRef.current;
      const previousSpeedMultiplier = speedMultiplierRef.current;
      const nextSpeedMultiplier = advanceMCQGameSpeed(
        previousSpeedMultiplier,
        deltaMs,
        boostingRef.current,
      );
      speedMultiplierRef.current = nextSpeedMultiplier;
      racingAudioRef.current?.update(nextSpeedMultiplier, boostingRef.current);
      // Average speed over the frame keeps motion aligned with the updated curve.
      const speedMultiplier = (previousSpeedMultiplier + nextSpeedMultiplier) / 2;
      const advancedMs = deltaMs * speedMultiplier;

      const safeDuration = Number.isFinite(current.durationMs) && current.durationMs > 0
        ? Math.max(350, current.durationMs)
        : DEFAULT_PASS_DURATION_MS;
      passElapsedMsRef.current += advancedMs;
      const progress = Math.min(1.3, passElapsedMsRef.current / safeDuration);
      const nextGateZ = MCQ_GAME_GATE_START_Z + MCQ_GAME_TRAVEL_DISTANCE * progress;

      const previousCarX = carXRef.current;
      const targetX = targetCarXRef.current;
      const carAlpha = prefersReducedMotion ? 1 : 1 - Math.exp(-deltaMs / 62);
      const nextCarX = previousCarX + (targetX - previousCarX) * carAlpha;
      carXRef.current = nextCarX;

      let collisionIndex = -1;
      if (
        phaseRef.current === "RUNNING" &&
        !disabledRef.current &&
        !feedbackRef.current &&
        !submittedRef.current &&
        !collisionPassConsumedRef.current
      ) {
        for (const mapping of gateMappingsRef.current) {
          if (mapping.questionId !== activeQuestionKeyRef.current) continue;
          if (detectSweptGateCollision({
            previousGateZ: previousGateZRef.current,
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
      }

      // Keep the road's world-distance phase continuous between questions;
      // only the current gate travel uses the configured question duration.
      scrollOffsetRef.current =
        (scrollOffsetRef.current + advancedMs * MCQ_GAME_ROAD_SCROLL_UNITS_PER_MS) % 8;
      gateZRef.current = nextGateZ;

      if (collisionIndex >= 0 && !submittedRef.current && !collisionPassConsumedRef.current) {
        const mapping = gateMappingsRef.current[collisionIndex];
        if (
          mapping &&
          mapping.questionId === activeQuestionKeyRef.current &&
          !disabledRef.current &&
          !feedbackRef.current
        ) {
          // Gate contact only selects. Quiz scoring/persistence runs on Submit.
          collisionPassConsumedRef.current = true;
          if (selectedOptionRef.current !== mapping.laneIndex) {
            selectedOptionRef.current = mapping.laneIndex;
            racingAudioRef.current?.unlock();
            playSwipe();
            onSelectOptionRef.current(mapping.laneIndex, mapping.optionValue, mapping.gateId);
          }
        }
      }

      if (nextGateZ >= MCQ_GAME_COLLISION_Z + 0.8) {
        passElapsedMsRef.current = 0;
        collisionPassConsumedRef.current = false;
        previousGateZRef.current = MCQ_GAME_GATE_START_Z;
        gateZRef.current = MCQ_GAME_GATE_START_Z;
      } else {
        previousGateZRef.current = nextGateZ;
      }

      renderFrame();
      if (!document.hidden && typeof window.requestAnimationFrame === "function") {
        frameRef.current = window.requestAnimationFrame(animate);
      }
    };

    const scheduleFrame = () => {
      if (frameRef.current === null && !document.hidden && typeof window.requestAnimationFrame === "function") {
        frameRef.current = window.requestAnimationFrame(animate);
      }
    };
    scheduleFrameRef.current = scheduleFrame;

    const initialPhase: GamePhase = document.hidden
      ? "PAUSED"
      : latestPropsRef.current.disabled
        ? (latestPropsRef.current.feedback ? "FEEDBACK" : "RUNNING")
        : "RUNNING";
    phaseRef.current = initialPhase;
    setPhase(initialPhase);
    renderFrame();
    scheduleFrame();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        phaseRef.current = "PAUSED";
        setPhase("PAUSED");
        clearHoldTimer();
        touchGestureRef.current = null;
        boostingRef.current = false;
        setBoosting(false);
        racingAudioRef.current?.pause();
        if (frameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(frameRef.current);
        }
        frameRef.current = null;
        lastTimestampRef.current = null;
        return;
      }

      const current = latestPropsRef.current;
      void setGameImmersiveMode(true);
      racingAudioRef.current?.resume();
      const resumePhase: GamePhase = current.feedback
        ? "FEEDBACK"
        : submittedRef.current
          ? "ANSWERING"
          : "RUNNING";
      phaseRef.current = resumePhase;
      setPhase(resumePhase);
      lastTimestampRef.current = null;
      scheduleFrame();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearHoldTimer();
      if (frameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      scene.dispose();
      if (sceneRef.current === scene) sceneRef.current = null;
      drawCurrentFrameRef.current = null;
      scheduleFrameRef.current = null;
      gateLabelRefs.current = [];
    };
  }, [clearHoldTimer]);

  useEffect(() => {
    const nextKey = String(questionKey);
    if (activeQuestionKeyRef.current === nextKey) return;
    activeQuestionKeyRef.current = nextKey;

    submittedRef.current = false;
    selectedOptionRef.current = latestPropsRef.current.selectedOption;
    collisionPassConsumedRef.current = false;
    // Keep gate travel and road distance on the same continuous timeline. Only
    // the authoritative question/option IDs change; meshes and lane positions stay put.

    const nextPhase: GamePhase = document.hidden
      ? "PAUSED"
      : latestPropsRef.current.feedback
        ? "FEEDBACK"
        : "RUNNING";
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    drawCurrentFrameRef.current?.();
    scheduleFrameRef.current?.();
  }, [questionKey]);

  useEffect(() => {
    if (!feedback) return;
    submittedRef.current = true;
    phaseRef.current = "FEEDBACK";
    setPhase("FEEDBACK");
    drawCurrentFrameRef.current?.();
  }, [feedback]);

  const correctLane = options.findIndex((option) => String(option.value) === String(correctAnswer));
  const laneAnnouncement = "Lane " + String(lane + 1);
  const phaseStatus = phase === "PAUSED"
    ? "Paused"
    : phase === "ANSWERING"
      ? "Answer submitted"
      : feedback === "correct"
        ? "Correct"
        : feedback === "wrong"
          ? selectedOption === null ? "Time's up" : "Wrong answer"
          : selectedOption !== null
            ? "Answer selected"
            : boosting
              ? "Speed boost active"
              : "Racing";

  return (
    <section className="mcq-game-shell" aria-label="Full-screen 3D car racing quiz" data-testid="mcq-game-fullscreen">
      <div
        ref={stageRef}
        className="mcq-game-stage"
        role="group"
        aria-label="Four answer lanes; tap the left or right side to steer and hold either side to accelerate"
        tabIndex={0}
        data-swipe-ignore-app-section="true"
        data-swipe-ignore-back="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(event) => event.preventDefault()}
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
                  key={mapping.laneId}
                  className={[
                    "mcq-game-fallback-option",
                    selectedOption === index && !feedback ? "is-selected" : "",
                    feedback && selectedOption === index ? feedback === "correct" ? "is-correct" : "is-wrong" : "",
                    feedback && correctLane === index ? "is-answer" : "",
                  ].filter(Boolean).join(" ")}
                  aria-label={"Answer " + String(mapping.optionValue)}
                  data-option-id={mapping.optionId}
                  data-lane-id={mapping.laneId}
                  disabled={disabled || submittedRef.current || !!feedback}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={() => selectLaneAnswer(index)}
                >
                  <span className="mcq-game-gate-answer">{options[index]?.label ?? String(mapping.optionValue)}</span>
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
            <div className="mcq-game-gate-overlay" role="list" aria-label="Four answer gates">
              {gateMappings.map((mapping, index) => {
                const isSelected = selectedOption === index;
                const isCorrect = feedback !== null && correctLane === index;
                const className = [
                  "mcq-game-gate-label",
                  isSelected && !feedback ? "mcq-game-gate--selected" : "",
                  isSelected && feedback === "correct" ? "mcq-game-gate--correct" : "",
                  isCorrect ? "mcq-game-gate--correct" : "",
                  isSelected && feedback === "wrong" ? "mcq-game-gate--wrong" : "",
                ].filter(Boolean).join(" ");
                return (
                  <div
                    key={mapping.laneId}
                    ref={(element) => { gateLabelRefs.current[index] = element; }}
                    className={className}
                    role="listitem"
                    data-gate-id={mapping.gateId}
                    data-option-id={mapping.optionId}
                    data-lane-id={mapping.laneId}
                    aria-label={"Answer " + String(mapping.optionValue)}
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onPointerCancel={(event) => event.stopPropagation()}
                    onClick={() => selectLaneAnswer(index)}
                  >
                    <span className="mcq-game-gate-answer">{options[index]?.label ?? String(mapping.optionValue)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div
          className="mcq-game-topbar"
          role="group"
          aria-label="Quiz status and submission"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onPointerCancel={(event) => event.stopPropagation()}
        >
          <div className="mcq-game-topbar-stat mcq-game-topbar-stat--correct" aria-label={String(correctScore) + " correct answers"}>
            <Check size={21} strokeWidth={3.2} aria-hidden="true" />
            <span>{correctScore}</span>
          </div>
          <span className="mcq-game-topbar-divider" aria-hidden="true" />
          <div className="mcq-game-topbar-stat mcq-game-topbar-stat--wrong" aria-label={String(wrongScore) + " incorrect answers"}>
            <X size={21} strokeWidth={3.2} aria-hidden="true" />
            <span>{wrongScore}</span>
          </div>
          <span className="mcq-game-topbar-divider" aria-hidden="true" />
          <div className="mcq-game-topbar-stat mcq-game-topbar-stat--progress" aria-label={"Question " + (progressLabel || "—")}>
            <span>{progressLabel || "—"}</span>
          </div>
          {timerLabel && (
            <>
              <span className="mcq-game-topbar-divider mcq-game-topbar-divider--timer" aria-hidden="true" />
              <div
                className={["mcq-game-topbar-stat", "mcq-game-topbar-stat--timer", timerLabel.startsWith("00:") || timerLabel === "0s" ? "is-low-time" : ""].filter(Boolean).join(" ")}
                aria-label={"Time remaining " + timerLabel}
              >
                <Timer size={20} strokeWidth={2.6} aria-hidden="true" />
                <span>{timerLabel}</span>
              </div>
            </>
          )}
          <button
            type="button"
            className="mcq-game-submit"
            aria-label="Submit selected answer"
            data-testid="mcq-game-submit"
            disabled={disabled || (phase !== "RUNNING" && phase !== "ERROR") || selectedOption === null || submittedRef.current || !!feedback}
            onClick={() => submitLaneAnswer()}
          >
            <Send size={19} fill="currentColor" strokeWidth={1.8} aria-hidden="true" />
            <span>Submit</span>
          </button>
        </div>

        <div
          className={["mcq-game-question-panel", boosting ? "mcq-game-question-panel--boost" : ""].join(" ")}
          ref={questionPanelRef}
          aria-label="Current quiz question"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onPointerCancel={(event) => event.stopPropagation()}
        >
          <div className="mcq-game-question-content">{questionLabel}</div>
        </div>
        <span className="mcq-game-lane-readout sr-only" data-testid="mcq-game-lane-readout" aria-live="polite">{laneAnnouncement}</span>
        <p className="mcq-game-status sr-only" role="status" aria-live="polite">{phaseStatus}</p>
      </div>
    </section>
  );
};

export default MCQWithGame;
