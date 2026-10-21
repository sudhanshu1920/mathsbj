import { useEffect, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import { ArrowLeft, ArrowRight, CarFront } from "lucide-react";
import type { MCQGameValue } from "@/lib/mcqGame";
import "./mcq-game.css";

export interface MCQWithGameOption {
  value: MCQGameValue;
  label: ReactNode;
}

type GamePhase = "RUNNING" | "ANSWERING" | "FEEDBACK" | "PAUSED";

interface MCQWithGameProps {
  questionKey: string | number;
  options: MCQWithGameOption[];
  correctAnswer: MCQGameValue;
  feedback: "correct" | "wrong" | null;
  selectedOption: number | null;
  correctScore: number;
  wrongScore: number;
  durationMs: number;
  disabled?: boolean;
  onCollision: (laneIndex: number) => void;
}

const LANE_LABELS = ["A", "B", "C", "D"];

const MCQWithGame = ({
  questionKey,
  options,
  correctAnswer,
  feedback,
  selectedOption,
  correctScore,
  wrongScore,
  durationMs,
  disabled = false,
  onCollision,
}: MCQWithGameProps) => {
  const [lane, setLane] = useState(() => Math.floor(Math.random() * 4));
  const [phase, setPhase] = useState<GamePhase>("RUNNING");
  const roadRef = useRef<HTMLDivElement | null>(null);
  const gateRowRef = useRef<HTMLDivElement | null>(null);
  const laneRef = useRef(lane);
  const phaseRef = useRef<GamePhase>("RUNNING");
  const submittedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const onCollisionRef = useRef(onCollision);
  onCollisionRef.current = onCollision;

  const changeLane = (direction: -1 | 1) => {
    if (disabled || phaseRef.current !== "RUNNING" || submittedRef.current) return;
    const nextLane = Math.max(0, Math.min(3, laneRef.current + direction));
    laneRef.current = nextLane;
    setLane(nextLane);
  };

  useEffect(() => {
    let elapsed = 0;
    let lastTimestamp: number | null = null;
    const safeDuration = Number.isFinite(durationMs) ? Math.max(1200, durationMs) : 4800;
    submittedRef.current = false;
    const initiallyHidden = document.hidden;
    phaseRef.current = initiallyHidden ? "PAUSED" : "RUNNING";
    setPhase(initiallyHidden ? "PAUSED" : "RUNNING");
    if (gateRowRef.current) gateRowRef.current.style.transform = "translate3d(0, 0, 0)";

    const animate = (timestamp: number) => {
      frameRef.current = null;
      if (phaseRef.current !== "RUNNING") return;
      if (document.hidden) {
        lastTimestamp = null;
        frameRef.current = window.requestAnimationFrame(animate);
        return;
      }

      if (lastTimestamp !== null) elapsed += Math.min(50, Math.max(0, timestamp - lastTimestamp));
      lastTimestamp = timestamp;

      const progress = Math.min(1, elapsed / safeDuration);
      const roadHeight = roadRef.current?.clientHeight ?? 0;
      const gateHeight = gateRowRef.current?.offsetHeight ?? 0;
      const travel = Math.max(0, roadHeight - gateHeight - 50);
      if (gateRowRef.current) {
        gateRowRef.current.style.transform = "translate3d(0, " + String(progress * travel) + "px, 0)";
      }

      if (progress >= 1 && !submittedRef.current) {
        submittedRef.current = true;
        phaseRef.current = "ANSWERING";
        setPhase("ANSWERING");
        onCollisionRef.current(laneRef.current);
        return;
      }

      frameRef.current = window.requestAnimationFrame(animate);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (phaseRef.current === "RUNNING") {
          phaseRef.current = "PAUSED";
          setPhase("PAUSED");
        }
        if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        lastTimestamp = null;
        return;
      }

      if (phaseRef.current === "PAUSED" && !submittedRef.current) {
        phaseRef.current = "RUNNING";
        setPhase("RUNNING");
        lastTimestamp = null;
        frameRef.current = window.requestAnimationFrame(animate);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (!initiallyHidden) frameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [questionKey, durationMs]);

  useEffect(() => {
    if (!feedback) return;
    phaseRef.current = "FEEDBACK";
    setPhase("FEEDBACK");
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, [feedback]);

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

  const canSteer = !disabled && phase === "RUNNING" && !submittedRef.current;
  const correctLane = options.findIndex((option) => String(option.value) === String(correctAnswer));

  return (
    <section className="mcq-game-shell mt-4" aria-label="MCQ car game">
      <div className="mcq-game-hud">
        <span className="mcq-game-score">Score <strong>{correctScore}</strong></span>
        <span className="mcq-game-wrong">Wrong <strong>{wrongScore}</strong></span>
        <span className="mcq-game-instruction">Swipe or steer</span>
      </div>

      <div
        ref={roadRef}
        className="mcq-game-road"
        role="group"
        aria-label="Four answer lanes; swipe left or right to steer the car"
        tabIndex={0}
        data-swipe-ignore-app-section="true"
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
        <div className="mcq-game-road-surface" aria-hidden="true" />
        <div className="mcq-game-lane-dashes" aria-hidden="true" />
        <div className="mcq-game-lane-tracks" aria-hidden="true">
          {LANE_LABELS.map((label, index) => (
            <div
              key={label}
              className={[
                "mcq-game-lane-track",
                index === lane ? "mcq-game-lane-track--active" : "",
              ].filter(Boolean).join(" ")}
            />
          ))}
        </div>

        <div ref={gateRowRef} className="mcq-game-gate-row">
          {options.map((option, index) => {
            const isSelected = feedback !== null && selectedOption === index;
            const isCorrect = feedback !== null && correctLane === index;
            const gateClass = [
              "mcq-game-gate",
              index === lane && phase === "RUNNING" ? "mcq-game-gate--target" : "",
              isCorrect ? "mcq-game-gate--correct" : "",
              isSelected && feedback === "wrong" ? "mcq-game-gate--wrong" : "",
            ].filter(Boolean).join(" ");
            return (
              <div
                key={LANE_LABELS[index]}
                className={gateClass}
                aria-label={"Lane " + String(index + 1) + ", option " + String(option.value)}
              >
                <span className="mcq-game-gate-letter">{LANE_LABELS[index]}</span>
                <div className="mcq-game-gate-answer">{option.label}</div>
              </div>
            );
          })}
        </div>

        <div
          className="mcq-game-collision-line"
          aria-hidden="true"
        />
        <div
          className="mcq-game-car"
          style={{ left: String(((lane + 0.5) / 4) * 100) + "%" }}
          aria-label={"Car in lane " + String(lane + 1)}
        >
          <CarFront size={42} strokeWidth={2.4} />
        </div>

        <div className="mcq-game-lane-readout" aria-live="polite">
          Lane {lane + 1} · {LANE_LABELS[lane]}
        </div>
      </div>

      <div className="mcq-game-controls" aria-label="Car steering controls">
        <button type="button" onClick={() => changeLane(-1)} disabled={!canSteer} aria-label="Steer left">
          <ArrowLeft size={19} />
          Left
        </button>
        <span className="mcq-game-controls-hint">Touch the answer gate with your car</span>
        <button type="button" onClick={() => changeLane(1)} disabled={!canSteer} aria-label="Steer right">
          Right
          <ArrowRight size={19} />
        </button>
      </div>

      <p className="mcq-game-status" role="status" aria-live="polite">
        {feedback === "correct"
          ? "Correct lane!"
          : feedback === "wrong" && selectedOption !== null
            ? "Wrong lane · correct answer highlighted"
            : feedback === "wrong"
              ? "Time's up"
              : phase === "PAUSED"
                ? "Paused while the app is in the background"
                : phase === "ANSWERING"
                  ? "Answer submitted"
                  : "Choose a lane before the gate arrives"}
      </p>
    </section>
  );
};

export default MCQWithGame;
