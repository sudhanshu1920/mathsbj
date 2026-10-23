import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import MCQJumpAdventure from "@/components/MCQJumpAdventure";

const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(window, "requestAnimationFrame");
const originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(window, "cancelAnimationFrame");

function mockCanvasContext() {
  const gradient = { addColorStop: vi.fn() };
  const context = {
    clearRect: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    setTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: () => 1,
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalRequestAnimationFrame) Object.defineProperty(window, "requestAnimationFrame", originalRequestAnimationFrame);
  else Reflect.deleteProperty(window, "requestAnimationFrame");
  if (originalCancelAnimationFrame) Object.defineProperty(window, "cancelAnimationFrame", originalCancelAnimationFrame);
  else Reflect.deleteProperty(window, "cancelAnimationFrame");
});

const options = [
  { value: "26", label: "26" },
  { value: "28", label: "28" },
  { value: "22", label: "22" },
  { value: "33", label: "33" },
];

function props(overrides: Partial<ComponentProps<typeof MCQJumpAdventure>> = {}) {
  return {
    questionKey: "question-1",
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

describe("2D Math Jump Adventure UI", () => {
  it("renders movement and jump controls with explicit answer tiles", () => {
    mockCanvasContext();
    render(<MCQJumpAdventure {...props()} />);
    expect(screen.getByRole("button", { name: "Move left" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move right" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jump" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Choose your answer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Answer 28" })).toBeInTheDocument();
  });

  it("submits a chosen answer exactly once per question through the supplied quiz callback", () => {
    mockCanvasContext();
    const onSelectOption = vi.fn(() => true);
    render(<MCQJumpAdventure {...props({ onSelectOption })} />);
    const answer = screen.getByRole("button", { name: "Answer 28" });
    fireEvent.click(answer);
    fireEvent.click(answer);
    expect(onSelectOption).toHaveBeenCalledTimes(1);
    expect(onSelectOption).toHaveBeenCalledWith(1, "28", expect.stringContaining("question-1"));
  });

  it("does not open Pause in the middle of an answer submission", () => {
    mockCanvasContext();
    const onSelectOption = vi.fn(() => true);
    render(<MCQJumpAdventure {...props({ onSelectOption })} />);
    fireEvent.click(screen.getByRole("button", { name: "Answer 28" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onSelectOption).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Adventure paused" })).not.toBeInTheDocument();
  });

  it("pauses gameplay and reports pause/resume to the owning quiz timer when focus is lost", () => {
    mockCanvasContext();
    const onPauseChange = vi.fn();
    render(<MCQJumpAdventure {...props({ onPauseChange })} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Move right" }));
    fireEvent.blur(window);
    expect(screen.getByRole("dialog", { name: "Adventure paused" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(onPauseChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.queryByRole("dialog", { name: "Adventure paused" })).not.toBeInTheDocument();
    expect(onPauseChange).toHaveBeenLastCalledWith(false);
  });

  it("exposes functional restart-session and exit actions in the pause menu", () => {
    mockCanvasContext();
    const onRestartGame = vi.fn();
    const onChangeGame = vi.fn();
    render(<MCQJumpAdventure {...props({ onRestartGame, onChangeGame })} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause adventure" }));

    fireEvent.click(screen.getByRole("button", { name: "Restart quiz" }));
    expect(onRestartGame).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Return to game selector" }));
    expect(onChangeGame).toHaveBeenCalledTimes(1);
  });

  it("starts a clean unpaused world when the owning quiz session is restarted", () => {
    mockCanvasContext();
    const onPauseChange = vi.fn();
    const view = render(<MCQJumpAdventure {...props({ sessionKey: 1, onPauseChange })} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause adventure" }));
    expect(screen.getByRole("dialog", { name: "Adventure paused" })).toBeInTheDocument();

    view.rerender(<MCQJumpAdventure {...props({ sessionKey: 2, questionKey: "question-2", onPauseChange })} />);
    expect(screen.queryByRole("dialog", { name: "Adventure paused" })).not.toBeInTheDocument();
    expect(onPauseChange).toHaveBeenLastCalledWith(false);
  });

  it("shows a recoverable graphics error with retry and selector actions when 2D rendering is unavailable", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const onChangeGame = vi.fn();
    render(<MCQJumpAdventure {...props({ onChangeGame })} />);

    expect(screen.getByRole("alert", { name: "Game graphics unavailable" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry graphics" }));
    expect(screen.getByRole("alert", { name: "Game graphics unavailable" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exit to game selection" }));
    expect(onChangeGame).toHaveBeenCalledTimes(1);
  });

  it("uses the top Submit only for finalizing the complete test", () => {
    mockCanvasContext();
    const onFinalSubmit = vi.fn();
    render(<MCQJumpAdventure {...props({ canFinalizeTest: true, onFinalSubmit })} />);
    const submit = screen.getByTestId("mcq-jump-submit");
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(onFinalSubmit).toHaveBeenCalledTimes(1);
  });
});
