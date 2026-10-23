import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowLeft, CarFront, Check, Pause, Play, RotateCcw, Send, Timer, X } from "lucide-react";
import type { MCQGameValue } from "@/lib/mcqGame";
import {
  MCQ_GAME_CAR_HALF_WIDTH,
  MCQ_GAME_COLLISION_Z,
  MCQ_GAME_GATE_CLEARANCE_Z,
  MCQ_GAME_GATE_HALF_WIDTH,
  MCQ_GAME_GATE_START_Z,
  MCQ_GAME_TRAVEL_DISTANCE,
  MCQ_GAME_GESTURE_MOVE_TOLERANCE_PX,
  MCQ_GAME_HOLD_THRESHOLD_MS,
  MCQ_GAME_LANE_X,
  MCQ_GAME_ROAD_SCROLL_UNITS_PER_MS,
  MCQ_GAME_BASE_SPEED_MULTIPLIER,
  MCQ_GAME_MAX_SPEED_MULTIPLIER,
  advanceMCQGameSpeed,
  clampMCQGameLane,
  classifySteeringGesture,
  createMCQGateMappings,
  detectSweptGateCollision,
  resolveMCQGameGateTravelDurationMs,
} from "@/lib/mcqGamePhysics";
import {
  createMCQ3DScene,
  type MCQ3DScene,
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
  sessionKey?: string | number;
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
  finalSubmitReady: boolean;
  canFinalizeTest: boolean;
  onSelectOption: (laneIndex: number, optionValue: MCQGameValue, gateId: string, contactTimestampMs?: number) => boolean | void;
  onFinalSubmit: () => void;
  onChangeGame?: () => void;
  onRestartGame?: () => void;
  onPauseChange?: (paused: boolean) => void;
}

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
  sessionKey,
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
  finalSubmitReady,
  canFinalizeTest,
  onSelectOption,
  onFinalSubmit,
  onChangeGame,
  onRestartGame,
  onPauseChange,
}: MCQWithGameProps) => {
  const [lane, setLane] = useState(1);
  const [phase, setPhase] = useState<GamePhase>("INITIALIZING");
  const [showRestartConfirmation, setShowRestartConfirmation] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [rendererError, setRendererError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const questionPanelRef = useRef<HTMLDivElement | null>(null);
  const gateLabelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sceneRef = useRef<MCQ3DScene | null>(null);
  const racingAudioRef = useRef<RacingAudioController | null>(null);
  const frameRef = useRef<number | null>(null);
  const drawCurrentFrameRef = useRef<((timestamp?: number) => void) | null>(null);
  const scheduleFrameRef = useRef<(() => void) | null>(null);

  const laneRef = useRef(lane);
  const targetCarXRef = useRef<number>(MCQ_GAME_LANE_X[lane]);
  const carXRef = useRef<number>(MCQ_GAME_LANE_X[lane]);
  const submittedRef = useRef(false);
  const phaseRef = useRef<GamePhase>("INITIALIZING");
  const disabledRef = useRef(disabled);
  const feedbackRef = useRef(feedback);
  const selectedOptionRef = useRef(selectedOption);
  const onSelectOptionRef = useRef(onSelectOption);
  const onFinalSubmitRef = useRef(onFinalSubmit);
  const finalSubmitInvokedRef = useRef(false);
  const activeQuestionKeyRef = useRef(String(questionKey));
  const activeSessionKeyRef = useRef(String(sessionKey ?? "default"));
  const boostingRef = useRef(false);
  const speedMultiplierRef = useRef(MCQ_GAME_BASE_SPEED_MULTIPLIER);
  const touchGestureRef = useRef<SteeringPress | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const collisionPassConsumedRef = useRef(false);
  const questionPanelBottomRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const gateZRef = useRef<number>(MCQ_GAME_GATE_START_Z);
  const gateElapsedMsRef = useRef(0);
  const lastTimestampRef = useRef<number | null>(null);

  const latestPropsRef = useRef({
    questionKey: String(questionKey),
    sessionKey: String(sessionKey ?? "default"),
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
    finalSubmitReady,
    canFinalizeTest,
    onSelectOption,
    onFinalSubmit,
    onChangeGame,
    onRestartGame,
    onPauseChange,
  });
  latestPropsRef.current = {
    questionKey: String(questionKey),
    sessionKey: String(sessionKey ?? "default"),
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
    finalSubmitReady,
    canFinalizeTest,
    onSelectOption,
    onFinalSubmit,
    onChangeGame,
    onRestartGame,
    onPauseChange,
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

  // Lock driving and answer gates only after a finite test is fully answered.
  // Infinite sessions may offer whole-session Submit while gameplay is still live.
  disabledRef.current = disabled || finalSubmitReady;
  feedbackRef.current = feedback;
  selectedOptionRef.current = selectedOption;
  onSelectOptionRef.current = onSelectOption;
  onFinalSubmitRef.current = onFinalSubmit;

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

  const setPausedState = useCallback((nextPaused: boolean, force = false) => {
    const current = latestPropsRef.current;
    if (nextPaused && !force && (
      current.disabled ||
      current.feedback ||
      current.finalSubmitReady ||
      submittedRef.current ||
      phaseRef.current === "ANSWERING"
    )) return;

    const currentlyPaused = phaseRef.current === "PAUSED";
    if (currentlyPaused === nextPaused) return;

    if (nextPaused) {
      phaseRef.current = "PAUSED";
      setPhase("PAUSED");
      clearHoldTimer();
      touchGestureRef.current = null;
      endBoost();
      lastTimestampRef.current = null;
      racingAudioRef.current?.pause();
      if (frameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      current.onPauseChange?.(true);
      return;
    }

    if (document.hidden) return;
    const resumePhase: GamePhase = current.feedback
      ? "FEEDBACK"
      : submittedRef.current
        ? "ANSWERING"
        : "RUNNING";
    phaseRef.current = resumePhase;
    setPhase(resumePhase);
    lastTimestampRef.current = null;
    racingAudioRef.current?.resume();
    void setGameImmersiveMode(true);
    current.onPauseChange?.(false);
    scheduleFrameRef.current?.();
  }, [clearHoldTimer, endBoost]);

  const changeLane = useCallback((direction: -1 | 1) => {
    if (disabledRef.current || phaseRef.current !== "RUNNING" || submittedRef.current) return;
    const nextLane = clampMCQGameLane(laneRef.current, direction);
    if (nextLane === laneRef.current) return;
    laneRef.current = nextLane;
    targetCarXRef.current = MCQ_GAME_LANE_X[nextLane];
    setLane(nextLane);
  }, []);

  const selectLaneAnswer = useCallback((mappingIndex: number, contactTimestampMs?: number) => {
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
    // A gate selection is the per-question commit event. Lock synchronously
    // before the existing Quiz Engine callback runs so touch/collision races
    // cannot record the same answer twice.
    const questionKeyAtSelection = activeQuestionKeyRef.current;
    const previousPhase = phaseRef.current;
    collisionPassConsumedRef.current = true;
    selectedOptionRef.current = mapping.laneIndex;
    submittedRef.current = true;
    phaseRef.current = "ANSWERING";
    setPhase("ANSWERING");

    const releaseRejectedSelection = () => {
      if (activeQuestionKeyRef.current !== questionKeyAtSelection || feedbackRef.current) return;
      // A rejected engine commit must release both locks. Otherwise one stale
      // collision permanently disables automatic option contact for this question.
      collisionPassConsumedRef.current = false;
      submittedRef.current = false;
      selectedOptionRef.current = latestPropsRef.current.selectedOption;
      phaseRef.current = previousPhase;
      setPhase(previousPhase);
    };

    racingAudioRef.current?.unlock();
    playSwipe();
    try {
      const accepted = onSelectOptionRef.current(mapping.laneIndex, mapping.optionValue, mapping.gateId, contactTimestampMs);
      if (accepted === false) releaseRejectedSelection();
    } catch (error) {
      releaseRejectedSelection();
      throw error;
    }
  }, []);

  const submitWholeTest = useCallback(() => {
    const current = latestPropsRef.current;
    if (!current.canFinalizeTest || current.disabled || finalSubmitInvokedRef.current) return;

    // This control finalizes a whole session only; it never submits an answer.
    finalSubmitInvokedRef.current = true;
    racingAudioRef.current?.unlock();
    playClick();
    onFinalSubmitRef.current();
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
    const handleWindowBlur = () => setPausedState(true, true);
    const handleWindowFocus = () => {
      if (!document.hidden && phaseRef.current !== "PAUSED") racingAudioRef.current?.resume();
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setPausedState(true, true);
        return;
      }

      // Returning to the app never silently resumes the race. The player must
      // press Resume so the racing loop and quiz timer restart together.
      if (phaseRef.current !== "PAUSED") {
        void setGameImmersiveMode(true);
        racingAudioRef.current?.resume();
      }
    };
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void setGameImmersiveMode(true);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearHoldTimer();
      touchGestureRef.current = null;
      boostingRef.current = false;
      void setGameImmersiveMode(false);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [clearHoldTimer, setPausedState]);

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
      setRendererError("3D graphics are unavailable. Answer targets cannot be submitted without real car contact.");
      return;
    }

    sceneRef.current = scene;
    setRendererError(null);

    const prefersReducedMotion = typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderFrame = () => {
      const projections = scene.render({
        carX: carXRef.current,
        scrollOffset: scrollOffsetRef.current,
        gateZ: gateZRef.current,
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
        if (element.style.opacity !== "1") element.style.opacity = "1";
        if (element.style.pointerEvents !== "auto") element.style.pointerEvents = "auto";
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
      const frameElapsedMs = previousTimestamp === null
        ? 0
        : Math.max(0, timestamp - previousTimestamp);
      // Keep steering/boost simulation bounded after a slow frame, but let target
      // travel consume real active elapsed time so frame rate cannot change its deadline.
      const deltaMs = Math.min(100, frameElapsedMs);
      lastTimestampRef.current = timestamp;

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

      const previousCarX = carXRef.current;
      const targetX = targetCarXRef.current;
      const carAlpha = prefersReducedMotion ? 1 : 1 - Math.exp(-deltaMs / 62);
      const nextCarX = previousCarX + (targetX - previousCarX) * carAlpha;
      carXRef.current = nextCarX;

      const previousGateZ = gateZRef.current;
      const gateTravelDurationMs = resolveMCQGameGateTravelDurationMs(
        latestPropsRef.current.durationMs,
      );
      gateElapsedMsRef.current += frameElapsedMs;
      const nextGateZ = MCQ_GAME_GATE_START_Z +
        MCQ_GAME_TRAVEL_DISTANCE * (gateElapsedMsRef.current / gateTravelDurationMs);
      const gateTravelThisFrame = nextGateZ - previousGateZ;
      const gateCrossingFraction = gateTravelThisFrame > 0 &&
        previousGateZ < MCQ_GAME_COLLISION_Z &&
        nextGateZ >= MCQ_GAME_COLLISION_Z
        ? (MCQ_GAME_COLLISION_Z - previousGateZ) / gateTravelThisFrame
        : null;
      const carXAtGateContact = gateCrossingFraction === null
        ? nextCarX
        : previousCarX + (nextCarX - previousCarX) * gateCrossingFraction;
      const contactTimestampMs = gateCrossingFraction === null
        ? undefined
        : (previousTimestamp ?? timestamp) + frameElapsedMs * gateCrossingFraction;

      let collisionIndex = -1;
      let closestContactDistance = Number.POSITIVE_INFINITY;
      if (
        phaseRef.current === "RUNNING" &&
        !disabledRef.current &&
        !feedbackRef.current &&
        !submittedRef.current &&
        !collisionPassConsumedRef.current &&
        gateCrossingFraction !== null
      ) {
        for (const mapping of gateMappingsRef.current) {
          if (mapping.questionId !== activeQuestionKeyRef.current) continue;
          const hasWorldSpaceContact = detectSweptGateCollision({
            previousGateZ,
            gateZ: nextGateZ,
            collisionZ: MCQ_GAME_COLLISION_Z,
            previousCarX,
            carX: nextCarX,
            gateX: MCQ_GAME_LANE_X[mapping.laneIndex],
            carHalfWidth: MCQ_GAME_CAR_HALF_WIDTH,
            gateHalfWidth: MCQ_GAME_GATE_HALF_WIDTH,
          });
          if (!hasWorldSpaceContact) continue;

          // Wide sprites can graze two adjacent hitboxes at once near a lane
          // boundary. Resolve that rare ambiguity to the gate nearest the
          // car centre at the exact Z-plane crossing, then submit only once.
          const lateralDistance = Math.abs(carXAtGateContact - MCQ_GAME_LANE_X[mapping.laneIndex]);
          if (lateralDistance < closestContactDistance) {
            closestContactDistance = lateralDistance;
            collisionIndex = mapping.laneIndex;
          }
        }
      }

      // Gates and the road advance in the same forward simulation time. The
      // gate's screen-space label is projected from this exact world-space Z.
      gateZRef.current = nextGateZ;
      scrollOffsetRef.current =
        (scrollOffsetRef.current + advancedMs * MCQ_GAME_ROAD_SCROLL_UNITS_PER_MS) % 8;

      if (collisionIndex >= 0 && !submittedRef.current && !collisionPassConsumedRef.current) {
        const mapping = gateMappingsRef.current[collisionIndex];
        if (
          mapping &&
          mapping.questionId === activeQuestionKeyRef.current &&
          !disabledRef.current &&
          !feedbackRef.current
        ) {
          // A target contact is the only per-answer commit path. selectLaneAnswer
          // claims the current question synchronously before invoking Quiz Engine.
          selectLaneAnswer(mapping.laneIndex, contactTimestampMs);
        }
      }

      // Missing every gate does not answer the question. Once the row is fully
      // past the car, respawn the same question's targets at the far spawn plane
      // so the player gets another physical approach rather than a dead session.
      if (gateZRef.current > MCQ_GAME_COLLISION_Z + MCQ_GAME_GATE_CLEARANCE_Z) {
        gateElapsedMsRef.current = 0;
        gateZRef.current = MCQ_GAME_GATE_START_Z;
      }

      renderFrame();
      if (!document.hidden && typeof window.requestAnimationFrame === "function") {
        frameRef.current = window.requestAnimationFrame(animate);
      }
    };

    const scheduleFrame = () => {
      if (frameRef.current === null && !document.hidden &&
          phaseRef.current !== "PAUSED" &&
          typeof window.requestAnimationFrame === "function") {
        frameRef.current = window.requestAnimationFrame(animate);
      }
    };
    scheduleFrameRef.current = scheduleFrame;

    const initialPhase: GamePhase = document.hidden || phaseRef.current === "PAUSED"
      ? "PAUSED"
      : latestPropsRef.current.disabled
        ? (latestPropsRef.current.feedback ? "FEEDBACK" : "RUNNING")
        : "RUNNING";
    phaseRef.current = initialPhase;
    setPhase(initialPhase);
    if (initialPhase === "PAUSED") latestPropsRef.current.onPauseChange?.(true);
    renderFrame();
    scheduleFrame();

    return () => {
      clearHoldTimer();
      if (frameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      scene.dispose();
      if (sceneRef.current === scene) sceneRef.current = null;
      drawCurrentFrameRef.current = null;
      scheduleFrameRef.current = null;
      gateLabelRefs.current = [];
    };
  }, [clearHoldTimer, selectLaneAnswer, setPausedState]);

  useLayoutEffect(() => {
    const nextKey = String(questionKey);
    const nextSessionKey = String(sessionKey ?? "default");
    const questionChanged = activeQuestionKeyRef.current !== nextKey;
    const sessionChanged = activeSessionKeyRef.current !== nextSessionKey;
    if (!questionChanged && !sessionChanged) return;

    activeQuestionKeyRef.current = nextKey;
    // Each question/session receives a fresh gate wave. No old target's world
    // position can leak into the next question even though the WebGL scene stays mounted.
    gateZRef.current = MCQ_GAME_GATE_START_Z;
    gateElapsedMsRef.current = 0;
    if (sessionChanged) {
      activeSessionKeyRef.current = nextSessionKey;
      setShowRestartConfirmation(false);
      clearHoldTimer();
      touchGestureRef.current = null;
      laneRef.current = 1;
      targetCarXRef.current = MCQ_GAME_LANE_X[1];
      carXRef.current = MCQ_GAME_LANE_X[1];
      setLane(1);
      speedMultiplierRef.current = MCQ_GAME_BASE_SPEED_MULTIPLIER;
      boostingRef.current = false;
      setBoosting(false);
      scrollOffsetRef.current = 0;
      lastTimestampRef.current = null;
    }

    submittedRef.current = false;
    finalSubmitInvokedRef.current = false;
    selectedOptionRef.current = latestPropsRef.current.selectedOption;
    collisionPassConsumedRef.current = false;

    // Question changes preserve the race. A genuinely new quiz session resets
    // the car, boost, speed and road phase without recreating the WebGL scene.
    const nextPhase: GamePhase = document.hidden || phaseRef.current === "PAUSED"
      ? "PAUSED"
      : latestPropsRef.current.feedback
        ? "FEEDBACK"
        : "RUNNING";
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    drawCurrentFrameRef.current?.();
    scheduleFrameRef.current?.();
  }, [questionKey, sessionKey, clearHoldTimer]);

  useEffect(() => {
    if (!feedback) return;
    submittedRef.current = true;
    if (phaseRef.current !== "PAUSED") {
      phaseRef.current = "FEEDBACK";
      setPhase("FEEDBACK");
    }
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
          } else if (event.key === "Escape") {
            event.preventDefault();
            setPausedState(phaseRef.current !== "PAUSED");
          }
        }}
      >
        {rendererError ? (
          <div className="mcq-game-renderer-fallback">
            <div className="mcq-game-fallback-message" role="alert">
              <CarFront size={22} aria-hidden="true" />
              <span>{rendererError}</span>
            </div>
            <div className="mcq-game-fallback-options" role="list" aria-label="Unavailable answer targets">
              {gateMappings.map((mapping, index) => {
                const isSelected = selectedOption === index;
                const isCorrect = feedback !== null && correctLane === index;
                return (
                  <div
                    key={mapping.laneId}
                    className={[
                      "mcq-game-fallback-option",
                      isSelected && !feedback ? "is-selected" : "",
                      isSelected && feedback === "correct" ? "is-correct" : "",
                      isSelected && feedback === "wrong" ? "is-wrong" : "",
                      isCorrect ? "is-answer" : "",
                    ].filter(Boolean).join(" ")}
                    role="listitem"
                    aria-label={"Answer target " + String(mapping.optionValue) + " unavailable"}
                    aria-disabled="true"
                    data-option-id={mapping.optionId}
                    data-lane-id={mapping.laneId}
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onPointerCancel={(event) => event.stopPropagation()}
                  >
                    <span className="mcq-game-gate-answer">{options[index]?.label ?? String(mapping.optionValue)}</span>
                  </div>
                );
              })}
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
                  >
                    <span className="mcq-game-gate-answer">{options[index]?.label ?? String(mapping.optionValue)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {onChangeGame && (
          <button
            type="button"
            className="mcq-game-select-to-picker"
            aria-label="Choose another game"
            disabled={disabled || finalSubmitReady}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onPointerCancel={(event) => event.stopPropagation()}
            onClick={onChangeGame}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Choose game</span>
          </button>
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
            className="mcq-game-pause"
            aria-label={phase === "PAUSED" ? "Resume game" : "Pause game"}
            disabled={phase !== "PAUSED" && (
              disabled || finalSubmitReady || !!feedback ||
              phase === "ANSWERING" || submittedRef.current
            )}
            onClick={() => setPausedState(phaseRef.current !== "PAUSED")}
          >
            {phase === "PAUSED"
              ? <Play size={18} aria-hidden="true" />
              : <Pause size={18} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="mcq-game-submit"
            aria-label="Submit complete test"
            data-testid="mcq-game-submit"
            disabled={disabled || !canFinalizeTest || finalSubmitInvokedRef.current}
            onClick={submitWholeTest}
          >
            <Send size={19} fill="currentColor" strokeWidth={1.8} aria-hidden="true" />
            <span>Submit test</span>
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
          <div className="mcq-game-question-heading" aria-hidden="true">
            <CarFront size={15} strokeWidth={2.6} />
            <span>NEON NITRO</span>
            <span className="mcq-game-question-heading-divider">/</span>
            <span className="mcq-game-question-heading-caption">MATH RACING</span>
          </div>
          <div className="mcq-game-question-content">{questionLabel}</div>
          {feedback && (
            <div className={"mcq-game-feedback mcq-game-feedback--" + (feedback === "correct" ? "correct" : selectedOption === null ? "timeout" : "wrong")} role="status">
              {feedback === "correct"
                ? <Check size={15} strokeWidth={3} aria-hidden="true" />
                : selectedOption === null
                  ? <Timer size={15} strokeWidth={2.6} aria-hidden="true" />
                  : <X size={15} strokeWidth={3} aria-hidden="true" />}
              <span>{feedback === "correct" ? "CORRECT ANSWER" : selectedOption === null ? "TIME'S UP" : "INCORRECT ANSWER"}</span>
            </div>
          )}
        </div>
        {phase === "PAUSED" && (
          <div
            className="mcq-game-paused-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={showRestartConfirmation ? "Restart race confirmation" : "Race paused"}
          >
            <div className="mcq-game-paused-card">
              {showRestartConfirmation ? (
                <>
                  <RotateCcw size={28} aria-hidden="true" />
                  <strong>Restart race?</strong>
                  <span>Restarting starts a fresh quiz session and resets progress in this run. Your unrelated saved app progress remains unchanged.</span>
                  <button
                    type="button"
                    className="mcq-game-paused-action mcq-game-paused-action--secondary"
                    onClick={() => setShowRestartConfirmation(false)}
                  >
                    Keep race paused
                  </button>
                  <button
                    type="button"
                    className="mcq-game-paused-action"
                    onClick={() => {
                      setShowRestartConfirmation(false);
                      setPausedState(false);
                      latestPropsRef.current.onRestartGame?.();
                    }}
                  >
                    <RotateCcw size={17} aria-hidden="true" /> Confirm restart
                  </button>
                </>
              ) : (
                <>
                  <Pause size={28} aria-hidden="true" />
                  <strong>Race paused</strong>
                  <span>The car, road animation, and quiz timer are paused.</span>
                  <button
                    type="button"
                    className="mcq-game-paused-action"
                    onClick={() => {
                      setShowRestartConfirmation(false);
                      setPausedState(false);
                    }}
                  >
                    <Play size={17} aria-hidden="true" /> Resume race
                  </button>
                  {onRestartGame && (
                    <button
                      type="button"
                      className="mcq-game-paused-action mcq-game-paused-action--secondary"
                      onClick={() => setShowRestartConfirmation(true)}
                    >
                      <RotateCcw size={17} aria-hidden="true" /> Restart quiz
                    </button>
                  )}
                  {onChangeGame && (
                    <button
                      type="button"
                      className="mcq-game-paused-action mcq-game-paused-action--secondary"
                      onClick={() => {
                        setShowRestartConfirmation(false);
                        setPausedState(false);
                        latestPropsRef.current.onChangeGame?.();
                      }}
                    >
                      <ArrowLeft size={17} aria-hidden="true" /> Return to game selection
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        <span className="mcq-game-lane-readout sr-only" data-testid="mcq-game-lane-readout" aria-live="polite">{laneAnnouncement}</span>
        <p className="mcq-game-status sr-only" role="status" aria-live="polite">{phaseStatus}</p>
      </div>
    </section>
  );
};

export default MCQWithGame;
