import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowLeft, CarFront, Check, Pause, Play, RotateCcw, Send, Timer, X } from "lucide-react";
import type { MCQGameValue } from "@/lib/mcqGame";
import {
  hasActiveMCQDrivingPointer,
  hasActiveMCQSpeedBoost,
  resolveMCQSteeringDirection,
  type MCQSteeringPointer,
} from "@/lib/mcqGameControls";
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
  createMCQGateApproachStartZs,
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
  const topbarRef = useRef<HTMLDivElement | null>(null);
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
  // Pointer IDs and hold timers are independent: lifting one finger cannot release another.
  const activePointersRef = useRef<Map<number, MCQSteeringPointer>>(new Map());
  const holdTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const pointerActivationOrderRef = useRef(0);
  const speedDisplayRef = useRef<HTMLSpanElement | null>(null);
  const speedLinesRef = useRef<HTMLDivElement | null>(null);

  const collisionPassConsumedRef = useRef(false);
  const questionPanelBottomRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  // The row clock is retained for diagnostics; each answer gate owns its depth and pass state.
  const gateZRef = useRef<number>(MCQ_GAME_GATE_START_Z);
  const gateStartZsRef = useRef(createMCQGateApproachStartZs(questionKey, Math.min(4, options.length)));
  const gateZsRef = useRef<number[]>([...gateStartZsRef.current]);
  const gateActiveRef = useRef<boolean[]>(Array.from({ length: 4 }, (_, index) => index < options.length));
  const gatePassedRef = useRef<boolean[]>([false, false, false, false]);
  const steerAngleRef = useRef(0);
  const gateElapsedMsRef = useRef(0);
  const activeRaceElapsedMsRef = useRef(0);
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

  const clearHoldTimer = useCallback((pointerId?: number) => {
    if (pointerId !== undefined) {
      const timer = holdTimersRef.current.get(pointerId);
      if (timer !== undefined) clearTimeout(timer);
      holdTimersRef.current.delete(pointerId);
      return;
    }
    for (const timer of holdTimersRef.current.values()) clearTimeout(timer);
    holdTimersRef.current.clear();
  }, []);

  const syncBoostState = useCallback(() => {
    const nextBoosting = hasActiveMCQSpeedBoost(activePointersRef.current);
    if (boostingRef.current !== nextBoosting) {
      boostingRef.current = nextBoosting;
      setBoosting(nextBoosting);
    }
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
      activePointersRef.current.clear();
      syncBoostState();
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
  }, [clearHoldTimer, syncBoostState]);

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

    // Stop every gameplay pointer on answer commit so a held finger cannot
    // keep accelerating while the Quiz Engine transitions to feedback.
    clearHoldTimer();
    activePointersRef.current.clear();
    syncBoostState();

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
  }, [clearHoldTimer, syncBoostState]);

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
        disabledRef.current || phaseRef.current !== "RUNNING" || submittedRef.current) return;
    const pointerId = Number.isFinite(event.pointerId) ? event.pointerId : 1;
    if (activePointersRef.current.has(pointerId)) return;
    const startX = Number.isFinite(event.clientX) ? event.clientX : 0;
    if ((event.target as HTMLElement | null)?.closest?.(".mcq-game-topbar, .mcq-game-question-panel, .mcq-game-gate-label, .mcq-game-fallback-option, .mcq-game-paused-overlay")) return;

    // Resume Web Audio directly in the trusted gesture on mobile.
    racingAudioRef.current?.unlock();
    const rect = event.currentTarget.getBoundingClientRect();
    const direction: -1 | 1 = startX < rect.left + rect.width / 2 ? -1 : 1;
    const previousDirection = resolveMCQSteeringDirection(activePointersRef.current);
    const press: MCQSteeringPointer = {
      pointerId,
      direction,
      startedAt: performance.now(),
      activationOrder: ++pointerActivationOrderRef.current,
      startX,
      startY: Number.isFinite(event.clientY) ? event.clientY : 0,
      movementExceeded: false,
      boostTriggered: false,
      laneMoveApplied: false,
    };
    activePointersRef.current.set(pointerId, press);

    // When a second finger changes direction, the newest direction takes
    // control immediately. Same-direction extra fingers do not cause a double lane jump.
    if (previousDirection !== null) {
      if (previousDirection !== direction) changeLane(direction);
      press.laneMoveApplied = true;
    }

    try {
      event.currentTarget.setPointerCapture(pointerId);
    } catch {
      // Pointer capture is unavailable in some test browsers; IDs remain isolated in our active-pointer map.
    }

    clearHoldTimer(pointerId);
    const timer = setTimeout(() => {
      if (holdTimersRef.current.get(pointerId) === timer) holdTimersRef.current.delete(pointerId);
      const activePress = activePointersRef.current.get(pointerId);
      if (!activePress || activePress !== press ||
          phaseRef.current !== "RUNNING" || disabledRef.current || submittedRef.current ||
          document.hidden || activePress.movementExceeded) return;
      activePress.boostTriggered = true;
      if (!activePress.laneMoveApplied) {
        changeLane(activePress.direction);
        activePress.laneMoveApplied = true;
      }
      syncBoostState();
    }, MCQ_GAME_HOLD_THRESHOLD_MS);
    holdTimersRef.current.set(pointerId, timer);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const eventPointerId = Number.isFinite(event.pointerId)
      ? event.pointerId
      : null;
    let press = eventPointerId === null ? undefined : activePointersRef.current.get(eventPointerId);
    const identityIsReliable = event.pointerType === "touch" || event.pointerType === "pen";
    if (!press && !identityIsReliable && activePointersRef.current.size === 1) {
      press = activePointersRef.current.values().next().value as MCQSteeringPointer | undefined;
    }
    if (!press || press.movementExceeded) return;

    const x = Number.isFinite(event.clientX) ? event.clientX : press.startX;
    const y = Number.isFinite(event.clientY) ? event.clientY : press.startY;
    const dx = x - press.startX;
    const dy = y - press.startY;
    if (dx * dx + dy * dy <= MCQ_GAME_GESTURE_MOVE_TOLERANCE_PX ** 2) return;

    press.movementExceeded = true;
    clearHoldTimer(press.pointerId);
    syncBoostState();
  };

  const releasePointer = (pointerId: number, allowTap: boolean) => {
    const press = activePointersRef.current.get(pointerId);
    if (!press) return;
    const directionBeforeRelease = resolveMCQSteeringDirection(activePointersRef.current);
    clearHoldTimer(pointerId);
    activePointersRef.current.delete(pointerId);

    const duration = Math.max(0, performance.now() - press.startedAt);
    if (allowTap && !press.movementExceeded && !press.boostTriggered &&
        duration < MCQ_GAME_HOLD_THRESHOLD_MS && !press.laneMoveApplied) {
      changeLane(press.direction);
      press.laneMoveApplied = true;
    }

    // If the newest direction was lifted, hand control back to the most recently
    // activated remaining pointer. Its prior hold/speed state is not reset.
    const resumedDirection = resolveMCQSteeringDirection(activePointersRef.current);
    if (directionBeforeRelease === press.direction && resumedDirection !== null &&
        resumedDirection !== directionBeforeRelease) {
      const resumedPress = [...activePointersRef.current.values()]
        .filter((candidate) => !candidate.movementExceeded)
        .reduce<MCQSteeringPointer | null>(
          (latest, candidate) => !latest || candidate.activationOrder > latest.activationOrder ? candidate : latest,
          null,
        );
      changeLane(resumedDirection);
      if (resumedPress) resumedPress.laneMoveApplied = true;
    }
    syncBoostState();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const eventPointerId = Number.isFinite(event.pointerId)
      ? event.pointerId
      : null;
    const identityIsReliable = event.pointerType === "touch" || event.pointerType === "pen";
    let pointerId = eventPointerId;
    if (pointerId === null || !activePointersRef.current.has(pointerId)) {
      // Synthetic test events may omit pointer identity; only a single active
      // pointer can be safely resolved without it.
      if (!identityIsReliable && activePointersRef.current.size === 1) {
        pointerId = activePointersRef.current.keys().next().value as number;
      } else {
        return;
      }
    }
    releasePointer(pointerId, true);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const eventPointerId = Number.isFinite(event.pointerId)
      ? event.pointerId
      : null;
    const identityIsReliable = event.pointerType === "touch" || event.pointerType === "pen";
    let pointerId = eventPointerId;
    if (pointerId === null || !activePointersRef.current.has(pointerId)) {
      if (!identityIsReliable && activePointersRef.current.size === 1) {
        pointerId = activePointersRef.current.keys().next().value as number;
      } else {
        return;
      }
    }
    releasePointer(pointerId, false);
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
      activePointersRef.current.clear();
      boostingRef.current = false;
      void setGameImmersiveMode(false);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [clearHoldTimer, setPausedState]);

  useEffect(() => {
    const panel = questionPanelRef.current;
    const topbar = topbarRef.current;
    const stage = stageRef.current;
    if (!panel || !topbar || !stage) return;

    // Keep the question anchored to the *actual* HUD height. The HUD wraps on
    // small phones, so a fixed top offset can put the question underneath it.
    const measureLayout = () => {
      const topbarBottom = topbar.getBoundingClientRect().bottom;
      const questionGap = window.innerHeight <= 520 ? 8 : 12;
      stage.style.setProperty(
        "--mcq-game-question-top",
        `${Math.ceil(topbarBottom + questionGap)}px`,
      );
      questionPanelBottomRef.current = panel.getBoundingClientRect().bottom + 8;
    };
    measureLayout();

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measureLayout);
      observer.observe(topbar);
      observer.observe(panel);
    }
    window.addEventListener("resize", measureLayout);
    window.addEventListener("orientationchange", measureLayout);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureLayout);
      window.removeEventListener("orientationchange", measureLayout);
      stage.style.removeProperty("--mcq-game-question-top");
    };
  }, []);

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
      const actualSpeed = speedMultiplierRef.current;
      const speedDisplay = speedDisplayRef.current;
      if (speedDisplay) {
        const speedText = Math.round(actualSpeed * 100) + "%";
        if (speedDisplay.textContent !== speedText) speedDisplay.textContent = speedText;
      }
      const speedLines = speedLinesRef.current;
      if (speedLines) {
        const intensity = Math.max(0, Math.min(0.56,
          ((actualSpeed - MCQ_GAME_BASE_SPEED_MULTIPLIER) /
            (MCQ_GAME_MAX_SPEED_MULTIPLIER - MCQ_GAME_BASE_SPEED_MULTIPLIER)) * 0.56,
        ));
        const opacity = String(intensity);
        if (speedLines.style.opacity !== opacity) speedLines.style.opacity = opacity;
        const duration = Math.max(0.22, 1.25 / actualSpeed);
        const animationDuration = String(duration) + "s";
        if (speedLines.style.getPropertyValue("--mcq-game-speed-streak-duration") !== animationDuration) {
          speedLines.style.setProperty("--mcq-game-speed-streak-duration", animationDuration);
        }
      }

      const projections = scene.render({
        carX: carXRef.current,
        steerAngle: steerAngleRef.current,
        scrollOffset: scrollOffsetRef.current,
        gateZ: gateZRef.current,
        gateZs: gateZsRef.current,
        gateActive: gateActiveRef.current,
        activeElapsedMs: activeRaceElapsedMsRef.current,
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
        updatePx("fontSize", projection.fontSize * 1.06);
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
      activeRaceElapsedMsRef.current += frameElapsedMs;
      lastTimestampRef.current = timestamp;

      const previousSpeedMultiplier = speedMultiplierRef.current;
      const nextSpeedMultiplier = advanceMCQGameSpeed(
        previousSpeedMultiplier,
        deltaMs,
        hasActiveMCQDrivingPointer(activePointersRef.current),
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
      const desiredSteerAngle = deltaMs > 0
        ? Math.max(-0.22, Math.min(0.22, (nextCarX - previousCarX) * -0.12))
        : 0;
      steerAngleRef.current += (desiredSteerAngle - steerAngleRef.current) * (1 - Math.exp(-deltaMs / 75));

      const gateTravelDurationMs = resolveMCQGameGateTravelDurationMs(
        latestPropsRef.current.durationMs,
      );
      // A shared time-based clock moves all targets at one world speed, but each
      // gate has its own initial depth and therefore its own physical contact time.
      // This preserves frame-rate-independent travel and current hold-to-accelerate behavior.
      const nextGateElapsedMs = gateElapsedMsRef.current + frameElapsedMs * speedMultiplier;
      const previousGateZs = gateZsRef.current;
      const nextGateZs = gateStartZsRef.current.map(
        (startZ) => startZ + MCQ_GAME_TRAVEL_DISTANCE * (nextGateElapsedMs / gateTravelDurationMs),
      );
      const crossingFractions = nextGateZs.map((nextZ, index) => {
        const previousZ = previousGateZs[index] ?? MCQ_GAME_GATE_START_Z;
        const gateTravel = nextZ - previousZ;
        return gateTravel > 0 && previousZ < MCQ_GAME_COLLISION_Z && nextZ >= MCQ_GAME_COLLISION_Z
          ? (MCQ_GAME_COLLISION_Z - previousZ) / gateTravel
          : null;
      });

      let collisionIndex = -1;
      let collisionContactTimestampMs: number | undefined;
      let earliestContactFraction = Number.POSITIVE_INFINITY;
      let closestContactDistance = Number.POSITIVE_INFINITY;
      if (
        phaseRef.current === "RUNNING" &&
        !disabledRef.current &&
        !feedbackRef.current &&
        !submittedRef.current &&
        !collisionPassConsumedRef.current
      ) {
        for (const mapping of gateMappingsRef.current) {
          const laneIndex = mapping.laneIndex;
          const crossingFraction = crossingFractions[laneIndex];
          if (
            mapping.questionId !== activeQuestionKeyRef.current ||
            gatePassedRef.current[laneIndex] ||
            crossingFraction === null ||
            crossingFraction === undefined
          ) continue;
          const hasWorldSpaceContact = detectSweptGateCollision({
            previousGateZ: previousGateZs[laneIndex] ?? MCQ_GAME_GATE_START_Z,
            gateZ: nextGateZs[laneIndex],
            collisionZ: MCQ_GAME_COLLISION_Z,
            previousCarX,
            carX: nextCarX,
            gateX: MCQ_GAME_LANE_X[laneIndex],
            carHalfWidth: MCQ_GAME_CAR_HALF_WIDTH,
            gateHalfWidth: MCQ_GAME_GATE_HALF_WIDTH,
          });
          if (!hasWorldSpaceContact) continue;

          // If a dropped frame spans multiple gates, first actual contact wins;
          // lateral distance only breaks an exact-time tie.
          const carXAtContact = previousCarX + (nextCarX - previousCarX) * crossingFraction;
          const lateralDistance = Math.abs(carXAtContact - MCQ_GAME_LANE_X[laneIndex]);
          if (crossingFraction < earliestContactFraction - 1e-6 ||
              (Math.abs(crossingFraction - earliestContactFraction) <= 1e-6 && lateralDistance < closestContactDistance)) {
            earliestContactFraction = crossingFraction;
            closestContactDistance = lateralDistance;
            collisionIndex = laneIndex;
            collisionContactTimestampMs = (previousTimestamp ?? timestamp) + frameElapsedMs * crossingFraction;
          }
        }
      }

      // Consume each gate independently. Near misses do not submit, and even a
      // dropped frame crossing several targets can only commit the earliest actual contact.
      crossingFractions.forEach((fraction, laneIndex) => {
        if (fraction === null || fraction === undefined) return;
        gatePassedRef.current[laneIndex] = true;
        if (laneIndex !== collisionIndex) gateActiveRef.current[laneIndex] = false;
      });

      gateElapsedMsRef.current = nextGateElapsedMs;
      gateZRef.current = MCQ_GAME_GATE_START_Z +
        MCQ_GAME_TRAVEL_DISTANCE * (nextGateElapsedMs / gateTravelDurationMs);
      gateZsRef.current = nextGateZs;
      scrollOffsetRef.current =
        (scrollOffsetRef.current + advancedMs * MCQ_GAME_ROAD_SCROLL_UNITS_PER_MS) % 8;

      if (collisionIndex >= 0 && !submittedRef.current && !collisionPassConsumedRef.current) {
        const mapping = gateMappingsRef.current.find((candidate) => candidate.laneIndex === collisionIndex);
        if (
          mapping &&
          mapping.questionId === activeQuestionKeyRef.current &&
          !disabledRef.current &&
          !feedbackRef.current
        ) {
          // Only the existing Quiz Engine callback commits an answer.
          selectLaneAnswer(mapping.laneIndex, collisionContactTimestampMs);
        }
      }

      // Recycle only after every answer target has crossed and cleared the car plane.
      const allTargetsPassed = gateMappingsRef.current.length > 0 && gateMappingsRef.current.every(
        (mapping) => gatePassedRef.current[mapping.laneIndex] &&
          nextGateZs[mapping.laneIndex] >= MCQ_GAME_COLLISION_Z + MCQ_GAME_GATE_CLEARANCE_Z,
      );
      if (allTargetsPassed && phaseRef.current === "RUNNING" && !submittedRef.current) {
        gateElapsedMsRef.current = 0;
        gateZRef.current = MCQ_GAME_GATE_START_Z;
        gateZsRef.current = [...gateStartZsRef.current];
        gateActiveRef.current = Array.from({ length: 4 }, (_, index) => index < gateMappingsRef.current.length);
        gatePassedRef.current = [false, false, false, false];
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
    // Each question/session receives a fresh depth-staggered wave and collision state.
    gateZRef.current = MCQ_GAME_GATE_START_Z;
    gateStartZsRef.current = createMCQGateApproachStartZs(nextKey, gateMappingsRef.current.length);
    gateZsRef.current = [...gateStartZsRef.current];
    gateActiveRef.current = Array.from({ length: 4 }, (_, index) => index < gateMappingsRef.current.length);
    gatePassedRef.current = [false, false, false, false];
    gateElapsedMsRef.current = 0;
    if (sessionChanged) {
      activeSessionKeyRef.current = nextSessionKey;
      setShowRestartConfirmation(false);
      clearHoldTimer();
      activePointersRef.current.clear();
      syncBoostState();
      laneRef.current = 1;
      targetCarXRef.current = MCQ_GAME_LANE_X[1];
      carXRef.current = MCQ_GAME_LANE_X[1];
      setLane(1);
      speedMultiplierRef.current = MCQ_GAME_BASE_SPEED_MULTIPLIER;
      steerAngleRef.current = 0;
      boostingRef.current = false;
      setBoosting(false);
      scrollOffsetRef.current = 0;
      activeRaceElapsedMsRef.current = 0;
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
  }, [questionKey, sessionKey, clearHoldTimer, syncBoostState]);

  useEffect(() => {
    if (feedback || disabled || finalSubmitReady) {
      clearHoldTimer();
      activePointersRef.current.clear();
      syncBoostState();
    }
    if (!feedback) return;
    submittedRef.current = true;
    if (phaseRef.current !== "PAUSED") {
      phaseRef.current = "FEEDBACK";
      setPhase("FEEDBACK");
    }
    drawCurrentFrameRef.current?.();
  }, [feedback, disabled, finalSubmitReady, clearHoldTimer, syncBoostState]);

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
            <div ref={speedLinesRef} className="mcq-game-speed-lines" aria-hidden="true" />
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

        <div
          ref={topbarRef}
          className="mcq-game-topbar"
          role="group"
          aria-label="Quiz status and submission"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onPointerCancel={(event) => event.stopPropagation()}
        >
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
          <div className="mcq-game-topbar-stat mcq-game-topbar-stat--speed" aria-label="Actual driving speed">
            <span aria-hidden="true">SPD</span>
            <span ref={speedDisplayRef}>100%</span>
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
