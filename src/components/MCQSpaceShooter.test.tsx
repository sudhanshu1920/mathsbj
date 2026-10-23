import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MCQSpaceShooter from "@/components/MCQSpaceShooter";

const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(window, "requestAnimationFrame");
const originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(window, "cancelAnimationFrame");

vi.mock("@/lib/gameImmersiveMode", () => ({
  setGameImmersiveMode: vi.fn(async () => undefined),
}));
vi.mock("@/lib/sound", () => ({
  playClick: vi.fn(),
  playSwipe: vi.fn(),
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

function mockLayout(view: ReturnType<typeof render>) {
  const playfield = screen.getByRole("group", { name: "Space battlefield" });
  vi.spyOn(playfield, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 600,
    width: 400, height: 600, toJSON: () => ({}),
  } as DOMRect);
  const target = screen.getByTestId("space-target-1");
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
    x: 130, y: 70, left: 130, top: 70, right: 270, bottom: 140,
    width: 140, height: 70, toJSON: () => ({}),
  } as DOMRect);
  fireEvent(window, new Event("resize"));
  return { playfield, target, container: view.container };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalRequestAnimationFrame) Object.defineProperty(window, "requestAnimationFrame", originalRequestAnimationFrame);
  else Reflect.deleteProperty(window, "requestAnimationFrame");
  if (originalCancelAnimationFrame) Object.defineProperty(window, "cancelAnimationFrame", originalCancelAnimationFrame);
  else Reflect.deleteProperty(window, "cancelAnimationFrame");
});

describe("Math Space Shooter", () => {
  it("renders readable answer targets and explicit movement, aim, fire, pause and restart controls", () => {
    mockCanvasContext();
    const onRestartGame = vi.fn();
    const view = render(<MCQSpaceShooter {...shooterProps({ onRestartGame })} />);

    expect(screen.getByRole("group", { name: "Mathematical answer targets" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aim at answer 28" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move spaceship left" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move spaceship right" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fire laser at selected answer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pause game" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restart quiz" })).toBeInTheDocument();
    expect(view.container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
  });

  it("aiming is not an answer submission; a swept laser hit submits through the shared quiz callback once", () => {
    mockCanvasContext();
    const frames = installFrameQueue();
    const onSelectOption = vi.fn(() => true);
    const view = render(<MCQSpaceShooter {...shooterProps({ onSelectOption })} />);
    mockLayout(view);

    fireEvent.click(screen.getByRole("button", { name: "Aim at answer 28" }));
    expect(onSelectOption).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Fire laser at selected answer" }));
    expect(onSelectOption).not.toHaveBeenCalled();

    for (let frame = 0; frame < 38; frame += 1) frames.advance(frame * 40);
    expect(onSelectOption).toHaveBeenCalledTimes(1);
    expect(onSelectOption).toHaveBeenCalledWith(1, "28", expect.stringContaining("question-1"));

    fireEvent.click(screen.getByRole("button", { name: "Fire laser at selected answer" }));
    expect(onSelectOption).toHaveBeenCalledTimes(1);
    frames.restore();
  });

  it("pauses on focus loss, clears held movement, and reports pause and resume to the owning quiz timer", () => {
    mockCanvasContext();
    const onPauseChange = vi.fn();
    render(<MCQSpaceShooter {...shooterProps({ onPauseChange })} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Move spaceship right" }));
    fireEvent.blur(window);
    expect(screen.getByRole("dialog", { name: "Mission paused" })).toBeInTheDocument();
    expect(onPauseChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Resume mission" }));
    expect(screen.queryByRole("dialog", { name: "Mission paused" })).not.toBeInTheDocument();
    expect(onPauseChange).toHaveBeenLastCalledWith(false);
  });

  it("discards in-flight projectiles when the question identity changes", () => {
    mockCanvasContext();
    const frames = installFrameQueue();
    const onSelectOption = vi.fn(() => true);
    const view = render(<MCQSpaceShooter {...shooterProps({ onSelectOption })} />);
    mockLayout(view);

    fireEvent.click(screen.getByRole("button", { name: "Aim at answer 28" }));
    fireEvent.click(screen.getByRole("button", { name: "Fire laser at selected answer" }));
    frames.advance(0);

    view.rerender(<MCQSpaceShooter {...shooterProps({ questionKey: "question-2", onSelectOption })} />);
    for (let frame = 1; frame < 38; frame += 1) frames.advance(frame * 40);
    expect(onSelectOption).not.toHaveBeenCalled();
    frames.restore();
  });

  it("keeps whole-test submission separate from firing an answer", () => {
    mockCanvasContext();
    const onSelectOption = vi.fn(() => true);
    const onFinalSubmit = vi.fn();
    render(<MCQSpaceShooter {...shooterProps({
      canFinalizeTest: true,
      onSelectOption,
      onFinalSubmit,
    })} />);

    fireEvent.click(screen.getByRole("button", { name: "Submit complete test" }));
    expect(onFinalSubmit).toHaveBeenCalledTimes(1);
    expect(onSelectOption).not.toHaveBeenCalled();
  });
});
