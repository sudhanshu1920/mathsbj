import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MCQSpaceShooter from "@/components/MCQSpaceShooter";

const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(window, "requestAnimationFrame");
const originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(window, "cancelAnimationFrame");
const originalPointerEvent = Object.getOwnPropertyDescriptor(window, "PointerEvent");

if (typeof window.PointerEvent === "undefined") {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  Object.defineProperty(window, "PointerEvent", { configurable: true, writable: true, value: TestPointerEvent });
}

vi.mock("@/lib/gameImmersiveMode", () => ({
  setGameImmersiveMode: vi.fn(async () => undefined),
}));
vi.mock("@/lib/sound", () => ({
  playClick: vi.fn(),
  playSwipe: vi.fn(),
  playSpaceLaser: vi.fn(),
  playSpaceExplosion: vi.fn(),
}));

function mockCanvasContext() {
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    setTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
}

function installFrameQueue() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: (callback: FrameRequestCallback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    writable: true,
    value: (id: number) => callbacks.delete(id),
  });
  return {
    advance(timestamp: number) {
      const item = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
      if (!item) return false;
      callbacks.delete(item[0]);
      act(() => item[1](timestamp));
      return true;
    },
    restore() {
      if (originalRequestAnimationFrame) Object.defineProperty(window, "requestAnimationFrame", originalRequestAnimationFrame);
      else Reflect.deleteProperty(window, "requestAnimationFrame");
      if (originalCancelAnimationFrame) Object.defineProperty(window, "cancelAnimationFrame", originalCancelAnimationFrame);
      else Reflect.deleteProperty(window, "cancelAnimationFrame");
    },
  };
}

const options = [
  { value: "26", label: "26" },
  { value: "28", label: "28" },
  { value: "22", label: "22" },
  { value: "33", label: "33" },
];

function shooterProps(overrides: Partial<ComponentProps<typeof MCQSpaceShooter>> = {}) {
  return {
    questionKey: "question-1",
    sessionKey: 1,
    questionLabel: <p>14 × 2 = ?</p>,
    options,
    correctAnswer: "28",
    feedback: null,
    selectedOption: null,
    correctScore: 0,
    wrongScore: 0,
    progressLabel: "1 / 10",
    finalSubmitReady: false,
    canFinalizeTest: false,
    onSelectOption: vi.fn(() => true),
    onFinalSubmit: vi.fn(),
    ...overrides,
  };
}

function startMission() {
  fireEvent.click(screen.getByTestId("space-start-mission"));
}

function mockLayout(view: ReturnType<typeof render>) {
  const playfield = screen.getByRole("group", { name: "Space battlefield" });
  vi.spyOn(playfield, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 600,
    width: 400, height: 600, toJSON: () => ({}),
  } as DOMRect);
  const target = screen.getByTestId("space-target-0");
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
    x: 130, y: 70, left: 130, top: 70, right: 270, bottom: 140,
    width: 140, height: 70, toJSON: () => ({}),
  } as DOMRect);
  fireEvent(window, new Event("resize"));
  return { playfield, target, container: view.container };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  try {
    window.localStorage.removeItem("math-space-shooter-best-v1");
    window.localStorage.removeItem("math-space-shooter-difficulty-v1");
  } catch { /* Storage is optional in restricted test environments. */ }
  if (originalRequestAnimationFrame) Object.defineProperty(window, "requestAnimationFrame", originalRequestAnimationFrame);
  else Reflect.deleteProperty(window, "requestAnimationFrame");
  if (originalCancelAnimationFrame) Object.defineProperty(window, "cancelAnimationFrame", originalCancelAnimationFrame);
  else Reflect.deleteProperty(window, "cancelAnimationFrame");
  if (originalPointerEvent) Object.defineProperty(window, "PointerEvent", originalPointerEvent);
});

describe("Math Space Shooter mission", () => {
  it("shows a working mission briefing, difficulty picker, instructions, sound and exit controls", () => {
    mockCanvasContext();
    const onStartMission = vi.fn(() => true);
    const onChangeGame = vi.fn();
    render(<MCQSpaceShooter {...shooterProps({ onStartMission, onChangeGame })} />);

    expect(screen.getByRole("dialog", { name: "MATH SPACE SHOOTER" })).toBeInTheDocument();
    expect(screen.getByTestId("space-difficulty-medium")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /continue mission/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("space-difficulty-hard"));
    expect(screen.getByTestId("space-difficulty-hard")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /how to play/i }));
    expect(screen.getByRole("heading", { name: "HOW TO PLAY" })).toBeInTheDocument();
    expect(screen.getByText(/only a real collision submits/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back to mission briefing/i }));
    const soundButton = screen.getByRole("button", { name: /sound (on|off)/i });
    const previousSoundState = soundButton.getAttribute("aria-pressed");
    fireEvent.click(soundButton);
    expect(screen.getByRole("button", { name: /sound (on|off)/i })).not.toHaveAttribute("aria-pressed", previousSoundState ?? "false");
    fireEvent.click(screen.getByRole("button", { name: /sound (on|off)/i }));
    expect(screen.getByRole("button", { name: /sound (on|off)/i })).toHaveAttribute("aria-pressed", previousSoundState ?? "false");

    startMission();
    expect(onStartMission).toHaveBeenCalledOnce();
    expect(onStartMission).toHaveBeenCalledWith("hard");
    expect(screen.queryByRole("dialog", { name: "MATH SPACE SHOOTER" })).not.toBeInTheDocument();
    expect(screen.getByTestId("space-control-fire")).toBeEnabled();
    expect(onChangeGame).not.toHaveBeenCalled();
  });

  it("renders real answer targets and four explicit movement, fire and boost controls", () => {
    mockCanvasContext();
    render(<MCQSpaceShooter {...shooterProps()} />);

    expect(screen.getByRole("group", { name: "Mathematical answer targets" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aim at answer 2: 28" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Steer spaceship left" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Steer spaceship right" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fire laser at selected answer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hold to boost spaceship speed" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pause game" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit complete test" })).toBeDisabled();
    expect(screen.getByTestId("space-start-mission")).toBeEnabled();
  });

  it("selecting a target does not submit; only a swept laser collision calls the shared quiz callback once", () => {
    mockCanvasContext();
    const frames = installFrameQueue();
    const onSelectOption = vi.fn(() => true);
    const view = render(<MCQSpaceShooter {...shooterProps({ onSelectOption })} />);
    startMission();
    mockLayout(view);

    fireEvent.click(screen.getByTestId("space-target-0"));
    expect(onSelectOption).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByTestId("space-control-fire"), { pointerId: 77 });
    fireEvent.pointerUp(screen.getByTestId("space-control-fire"), { pointerId: 77 });
    expect(onSelectOption).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("space-control-fire"));
    for (let frame = 0; frame < 38; frame += 1) frames.advance(frame * 40);
    expect(onSelectOption).toHaveBeenCalledTimes(1);
    expect(onSelectOption).toHaveBeenCalledWith(0, "26", expect.stringContaining("question-1"));

    fireEvent.click(screen.getByTestId("space-control-fire"));
    expect(onSelectOption).toHaveBeenCalledTimes(1);
    frames.restore();
  });

  it("keeps simultaneous pointer controls independent across pointer-up, cancel and capture loss", () => {
    mockCanvasContext();
    render(<MCQSpaceShooter {...shooterProps()} />);
    startMission();
    const left = screen.getByTestId("space-control-left");
    const right = screen.getByTestId("space-control-right");
    const boost = screen.getByTestId("space-control-boost");

    fireEvent.pointerDown(left, { pointerId: 101 });
    fireEvent.pointerDown(right, { pointerId: 202 });
    fireEvent.pointerDown(boost, { pointerId: 303 });
    expect(left).toHaveAttribute("aria-pressed", "true");
    expect(right).toHaveAttribute("aria-pressed", "true");
    expect(boost).toHaveAttribute("aria-pressed", "true");

    fireEvent.pointerUp(left, { pointerId: 101 });
    expect(left).toHaveAttribute("aria-pressed", "false");
    expect(right).toHaveAttribute("aria-pressed", "true");
    expect(boost).toHaveAttribute("aria-pressed", "true");

    fireEvent.lostPointerCapture(right, { pointerId: 202 });
    expect(right).toHaveAttribute("aria-pressed", "false");
    expect(boost).toHaveAttribute("aria-pressed", "true");

    fireEvent.pointerCancel(boost, { pointerId: 303 });
    expect(boost).toHaveAttribute("aria-pressed", "false");
  });

  it("pauses on focus loss, clears all held controls and informs the quiz timer", () => {
    mockCanvasContext();
    const onPauseChange = vi.fn();
    render(<MCQSpaceShooter {...shooterProps({ onPauseChange })} />);
    startMission();

    fireEvent.pointerDown(screen.getByTestId("space-control-left"), { pointerId: 1 });
    fireEvent.pointerDown(screen.getByTestId("space-control-boost"), { pointerId: 2 });
    fireEvent.blur(window);
    expect(screen.getByRole("dialog", { name: "Mission paused" })).toBeInTheDocument();
    expect(screen.getByTestId("space-control-left")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("space-control-boost")).toHaveAttribute("aria-pressed", "false");
    expect(onPauseChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Resume mission" }));
    expect(screen.queryByRole("dialog", { name: "Mission paused" })).not.toBeInTheDocument();
    expect(onPauseChange).toHaveBeenLastCalledWith(false);
  });

  it("discards an in-flight laser when the question identity changes", () => {
    mockCanvasContext();
    const frames = installFrameQueue();
    const onSelectOption = vi.fn(() => true);
    const view = render(<MCQSpaceShooter {...shooterProps({ onSelectOption })} />);
    startMission();
    mockLayout(view);

    fireEvent.click(screen.getByTestId("space-target-0"));
    fireEvent.click(screen.getByTestId("space-control-fire"));
    frames.advance(0);
    view.rerender(<MCQSpaceShooter {...shooterProps({ questionKey: "question-2", onSelectOption })} />);
    for (let frame = 1; frame < 38; frame += 1) frames.advance(frame * 40);
    expect(onSelectOption).not.toHaveBeenCalled();
    frames.restore();
  });

  it("awards the score and combo exactly once per accepted correct-answer event", () => {
    mockCanvasContext();
    const view = render(<MCQSpaceShooter {...shooterProps()} />);
    startMission();

    const correct = shooterProps({ feedback: "correct", selectedOption: 1 });
    view.rerender(<MCQSpaceShooter {...correct} />);
    expect(screen.getByLabelText("Mission score 100")).toBeInTheDocument();
    expect(screen.getByLabelText("Combo 1")).toBeInTheDocument();
    view.rerender(<MCQSpaceShooter {...correct} />);
    expect(screen.getByLabelText("Mission score 100")).toBeInTheDocument();
    expect(screen.getByLabelText("Combo 1")).toBeInTheDocument();
  });

  it("applies one shield penalty to one wrong-answer event and resets combo", () => {
    mockCanvasContext();
    const view = render(<MCQSpaceShooter {...shooterProps()} />);
    startMission();
    view.rerender(<MCQSpaceShooter {...shooterProps({ feedback: "correct", selectedOption: 1 })} />);
    expect(screen.getByLabelText("Combo 1")).toBeInTheDocument();
    view.rerender(<MCQSpaceShooter {...shooterProps()} />);

    view.rerender(<MCQSpaceShooter {...shooterProps({ feedback: "wrong", selectedOption: 0 })} />);
    expect(screen.getByLabelText("3 shields remaining")).toBeInTheDocument();
    expect(screen.getByLabelText("Combo 0")).toBeInTheDocument();
    view.rerender(<MCQSpaceShooter {...shooterProps({ feedback: "wrong", selectedOption: 0 })} />);
    expect(screen.getByLabelText("3 shields remaining")).toBeInTheDocument();
  });

  it("guards manual submit against duplicate taps and keeps it separate from firing", () => {
    mockCanvasContext();
    const onSelectOption = vi.fn(() => true);
    const onFinalSubmit = vi.fn();
    render(<MCQSpaceShooter {...shooterProps({ onSelectOption, onFinalSubmit })} />);
    startMission();

    const submit = screen.getByRole("button", { name: "Submit complete test" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(onFinalSubmit).toHaveBeenCalledTimes(1);
    expect(onSelectOption).not.toHaveBeenCalled();
  });
});
