import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PracticePage from "@/pages/PracticePage";

const rendererMocks = vi.hoisted(() => ({
  createMCQ3DScene: vi.fn(),
}));

vi.mock("@/lib/mcq3dRenderer", () => ({
  createMCQ3DScene: rendererMocks.createMCQ3DScene,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  rendererMocks.createMCQ3DScene.mockImplementation(() => ({
    render: vi.fn((frame: { gateZ: number }) => {
      const progress = Math.max(0, Math.min(1, (frame.gateZ + 9) / 9.75));
      const perspective = 0.55 + progress * 0.75;
      return Array.from({ length: 4 }, (_, index) => ({
        x: 200 + (index - 1.5) * 48 * perspective,
        y: 275 + progress * 250,
        width: 24 + progress * 64,
        height: 18 + progress * 38,
        fontSize: 9 + progress * 7,
        visible: true,
      }));
    }),
    dispose: vi.fn(),
  }));
});

function installAnimationFrameQueue() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  let timestamp = 0;
  const originalRequest = Object.getOwnPropertyDescriptor(window, "requestAnimationFrame");
  const originalCancel = Object.getOwnPropertyDescriptor(window, "cancelAnimationFrame");

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
    value: (id: number) => {
      callbacks.delete(id);
    },
  });

  return {
    advanceBy(durationMs: number, stepMs = 50) {
      // Run the pending frame at the current clock before advancing elapsed time.
      // This gives the first target row a true T0 instead of discarding one step.
      const firstAtStart = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
      if (firstAtStart) {
        callbacks.delete(firstAtStart[0]);
        act(() => firstAtStart[1](timestamp));
      }
      const steps = Math.ceil(durationMs / stepMs);
      for (let step = 0; step < steps; step += 1) {
        timestamp += stepMs;
        const first = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
        if (!first) break;
        callbacks.delete(first[0]);
        act(() => first[1](timestamp));
      }
    },
    now() {
      return timestamp;
    },
    restore() {
      if (originalRequest) Object.defineProperty(window, "requestAnimationFrame", originalRequest);
      else Reflect.deleteProperty(window, "requestAnimationFrame");
      if (originalCancel) Object.defineProperty(window, "cancelAnimationFrame", originalCancel);
      else Reflect.deleteProperty(window, "cancelAnimationFrame");
    },
  };
}

function openGameSelection() {
  fireEvent.click(screen.getByRole("button", { name: "MCQ with Game" }));
  expect(screen.getByTestId("mcq-game-selector")).toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Choose Your Game" })).toBeInTheDocument();
}

function startSelectedGame(label: RegExp) {
  openGameSelection();
  fireEvent.click(screen.getByRole("button", { name: label }));
  expect(screen.getByTestId("mcq-game-selector")).toBeInTheDocument();
  expect(screen.getByTestId("start-selected-game")).toBeEnabled();
  fireEvent.click(screen.getByTestId("start-selected-game"));
  expect(screen.queryByTestId("mcq-game-selector")).not.toBeInTheDocument();
}

function enablePerQuestionTimer(seconds = 5) {
  fireEvent.click(screen.getByRole("switch", { name: "Per-question timer" }));
  fireEvent.click(screen.getByRole("button", { name: String(seconds) + "s" }));
}

function getProcessedAnswers(container: HTMLElement) {
  const correct = Number(container.querySelector(".mcq-game-topbar-stat--correct span")?.textContent ?? 0);
  const wrong = Number(container.querySelector(".mcq-game-topbar-stat--wrong span")?.textContent ?? 0);
  return correct + wrong;
}

describe("Quiz Arena MCQ with Game mode", () => {
  it("opens a compact chooser and starts only the selected game after Start Quiz", () => {
    const raf = installAnimationFrameQueue();
    const view = render(<PracticePage />);

    try {
      fireEvent.click(screen.getByRole("button", { name: "MCQ with Game" }));
      expect(screen.getByTestId("mcq-game-selector")).toBeInTheDocument();
      expect(view.container.querySelector(".quiz-screen--setup")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /3D Car Racing/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /2D Jump Adventure/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Space Shooter/i })).toBeInTheDocument();
      expect(screen.getByTestId("start-selected-game")).toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: /2D Jump Adventure/i }));
      expect(screen.getByTestId("mcq-game-selector")).toBeInTheDocument();
      expect(screen.queryByTestId("mcq-jump-fullscreen")).not.toBeInTheDocument();
      expect(screen.getByTestId("start-selected-game")).toBeEnabled();

      fireEvent.click(screen.getByRole("button", { name: /3D Car Racing/i }));
      expect(screen.getByTestId("select-car-racing")).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByTestId("select-jump-adventure")).toHaveAttribute("aria-pressed", "false");
      expect(screen.queryByTestId("mcq-game-fullscreen")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("start-selected-game"));
      expect(screen.queryByTestId("mcq-game-selector")).not.toBeInTheDocument();
      expect(screen.getByTestId("mcq-game-fullscreen")).toBeInTheDocument();
      expect(screen.queryByTestId("mcq-jump-fullscreen")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Question 1 / 10")).toBeInTheDocument();
      expect(view.container.querySelectorAll(".mcq-game-gate-label")).toHaveLength(4);
      expect(rendererMocks.createMCQ3DScene).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("cancels game selection without starting a quiz", () => {
    const view = render(<PracticePage />);
    fireEvent.click(screen.getByRole("button", { name: "MCQ with Game" }));
    expect(screen.getByTestId("start-selected-game")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByTestId("mcq-game-selector")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mcq-game-fullscreen")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mcq-jump-fullscreen")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "MCQ with Game" })).toHaveAttribute("aria-pressed", "false");
  });

  it("launches Jump Adventure only after the selected-game Start Quiz action", () => {
    const raf = installAnimationFrameQueue();
    const contextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ setTransform: vi.fn() } as unknown as CanvasRenderingContext2D);
    const view = render(<PracticePage />);

    try {
      openGameSelection();
      fireEvent.click(screen.getByRole("button", { name: /2D Jump Adventure/i }));
      expect(screen.getByTestId("mcq-game-selector")).toBeInTheDocument();
      expect(screen.queryByTestId("mcq-jump-fullscreen")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("start-selected-game"));

      expect(screen.queryByTestId("mcq-game-selector")).not.toBeInTheDocument();
      expect(screen.getByTestId("mcq-jump-fullscreen")).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Choose your answer" })).toBeInTheDocument();
      expect(view.container.querySelectorAll(".mcq-jump-answer")).toHaveLength(4);
      expect(view.container.querySelectorAll(".mcq-game-fullscreen")).toHaveLength(0);
    } finally {
      view.unmount();
      contextSpy.mockRestore();
      raf.restore();
    }
  });

  it("launches Space Shooter through the same explicit selected-game flow", () => {
    const raf = installAnimationFrameQueue();
    const contextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ setTransform: vi.fn(), clearRect: vi.fn() } as unknown as CanvasRenderingContext2D);
    const view = render(<PracticePage />);

    try {
      openGameSelection();
      fireEvent.click(screen.getByRole("button", { name: /Space Shooter/i }));
      expect(screen.queryByRole("region", { name: "Math Space Shooter" })).not.toBeInTheDocument();
      expect(screen.getByTestId("start-selected-game")).toBeEnabled();

      fireEvent.click(screen.getByTestId("start-selected-game"));

      expect(screen.queryByTestId("mcq-game-selector")).not.toBeInTheDocument();
      expect(view.container.querySelector(".mcq-space-shell")).toBeInTheDocument();
      expect(view.container.querySelector(".mcq-game-fullscreen")).not.toBeInTheDocument();
    } finally {
      view.unmount();
      contextSpy.mockRestore();
      raf.restore();
    }
  });

  it("routes external Back from the compact setup picker to the previous answer mode", () => {
    const view = render(<PracticePage externalBackRequest={0} />);
    fireEvent.click(screen.getByRole("button", { name: "MCQ with Game" }));
    expect(screen.getByTestId("mcq-game-selector")).toBeInTheDocument();

    view.rerender(<PracticePage externalBackRequest={1} />);

    expect(screen.queryByTestId("mcq-game-selector")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "MCQ" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("mcq-game-fullscreen")).not.toBeInTheDocument();
  });

  it("does not submit when an answer target is tapped, but submits one answer on real car-gate contact", async () => {
    const raf = installAnimationFrameQueue();
    vi.spyOn(performance, "now").mockImplementation(() => raf.now());
    const view = render(<PracticePage />);

    try {
      enablePerQuestionTimer(5);
      startSelectedGame(/3D Car Racing/i);
      expect(screen.getByLabelText("Question 1 / 10")).toBeInTheDocument();

      const initialTargets = view.container.querySelectorAll(".mcq-game-gate-label");
      expect(initialTargets).toHaveLength(4);
      const laneReadout = view.container.querySelector("[data-testid='mcq-game-lane-readout']");
      expect(laneReadout).toHaveTextContent("Lane 2");

      fireEvent.pointerDown(initialTargets[1], { pointerId: 7, button: 0, clientX: 80, clientY: 280 });
      fireEvent.pointerUp(initialTargets[1], { pointerId: 7, button: 0, clientX: 80, clientY: 280 });
      fireEvent.click(initialTargets[1]);
      fireEvent.click(initialTargets[1]);
      expect(getProcessedAnswers(view.container)).toBe(0);
      expect(laneReadout).toHaveTextContent("Lane 2");

      const submit = screen.getByTestId("mcq-game-submit");
      expect(submit).toBeDisabled();
      fireEvent.click(submit);
      expect(getProcessedAnswers(view.container)).toBe(0);

      raf.advanceBy(5_100, 100);
      await waitFor(() => {
        expect(screen.getByLabelText("Question 2 / 10")).toBeInTheDocument();
      });

      expect(getProcessedAnswers(view.container)).toBe(1);
      expect(screen.getByTestId("mcq-game-submit")).toBeDisabled();
      expect(rendererMocks.createMCQ3DScene).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("uses a ten-second target approach when the per-question timer is disabled", async () => {
    const raf = installAnimationFrameQueue();
    vi.spyOn(performance, "now").mockImplementation(() => raf.now());
    const view = render(<PracticePage />);

    try {
      expect(screen.getByRole("switch", { name: "Per-question timer" })).not.toBeChecked();
      startSelectedGame(/3D Car Racing/i);
      expect(screen.getByLabelText("Question 1 / 10")).toBeInTheDocument();
      raf.advanceBy(9_500, 100);
      expect(getProcessedAnswers(view.container)).toBe(0);

      raf.advanceBy(600, 100);
      await waitFor(() => {
        expect(screen.getByLabelText("Question 2 / 10")).toBeInTheDocument();
      });
      expect(getProcessedAnswers(view.container)).toBe(1);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("automatically submits once after the final car-collision answer is recorded", async () => {
    const raf = installAnimationFrameQueue();
    vi.spyOn(performance, "now").mockImplementation(() => raf.now());
    const onQuizFinish = vi.fn();
    const view = render(<PracticePage onQuizFinish={onQuizFinish} />);

    try {
      enablePerQuestionTimer(5);
      startSelectedGame(/3D Car Racing/i);

      for (let question = 1; question <= 10; question += 1) {
        const targets = view.container.querySelectorAll(".mcq-game-gate-label");
        expect(targets).toHaveLength(4);
        expect(screen.getByTestId("mcq-game-submit")).toBeDisabled();
        const before = getProcessedAnswers(view.container);

        fireEvent.click(targets[1]);
        expect(getProcessedAnswers(view.container)).toBe(before);

        raf.advanceBy(5_100, 100);
        if (question < 10) {
          await waitFor(() => {
            expect(screen.getByLabelText("Question " + (question + 1) + " / 10")).toBeInTheDocument();
          });
          expect(getProcessedAnswers(view.container)).toBe(before + 1);
        } else {
          await waitFor(() => {
            expect(screen.getByRole("button", { name: "Play Again" })).toBeInTheDocument();
          });
          expect(getProcessedAnswers(view.container)).toBe(before + 1);
          expect(onQuizFinish).toHaveBeenCalledTimes(1);
        }
      }

      expect(getProcessedAnswers(view.container)).toBe(10);
      expect(onQuizFinish).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Back to Game Selection" })).toBeInTheDocument();
      expect(view.container.textContent).toContain("Attempted");
      expect(view.container.textContent).toContain("10");
    } finally {
      view.unmount();
      raf.restore();
    }
  }, 15_000);

  it("switches games during an active quiz without starting a second quiz session", () => {
    const raf = installAnimationFrameQueue();
    const contextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ setTransform: vi.fn() } as unknown as CanvasRenderingContext2D);
    const view = render(<PracticePage />);

    try {
      startSelectedGame(/3D Car Racing/i);
      expect(screen.getByLabelText("Question 1 / 10")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Choose another game" }));
      expect(screen.getByTestId("mcq-game-selector")).toBeInTheDocument();
      expect(view.container.querySelectorAll(".mcq-game-fullscreen, .mcq-jump-fullscreen")).toHaveLength(0);

      fireEvent.click(screen.getByRole("button", { name: /2D Jump Adventure/i }));
      expect(screen.queryByTestId("mcq-game-selector")).not.toBeInTheDocument();
      expect(screen.getByTestId("mcq-jump-fullscreen")).toBeInTheDocument();
      expect(screen.getByLabelText("Question 1 / 10")).toBeInTheDocument();
      expect(view.container.querySelector(".mcq-jump-score--correct span")).toHaveTextContent("0");

      fireEvent.click(screen.getByRole("button", { name: "Choose another game" }));
      fireEvent.click(screen.getByRole("button", { name: /3D Car Racing/i }));
      expect(screen.getByTestId("mcq-game-fullscreen")).toBeInTheDocument();
      expect(screen.getByLabelText("Question 1 / 10")).toBeInTheDocument();
    } finally {
      view.unmount();
      contextSpy.mockRestore();
      raf.restore();
    }
  });
});
