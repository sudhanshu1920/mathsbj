import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MCQWithGame from "@/components/MCQWithGame";
import { createMCQGateMappings } from "@/lib/mcqGamePhysics";
import { createMCQ3DScene } from "@/lib/mcq3dRenderer";

vi.mock("@/lib/mcq3dRenderer", () => ({
  createMCQ3DScene: vi.fn(() => ({
    render: vi.fn(() => Array.from({ length: 4 }, (_, index) => ({
      x: 50 + index * 80,
      y: 90,
      width: 62,
      height: 42,
      fontSize: 12,
      visible: true,
    }))),
    dispose: vi.fn(),
  })),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(createMCQ3DScene).mockReset();
});

beforeEach(() => {
  vi.useRealTimers();
  vi.mocked(createMCQ3DScene).mockImplementation(() => ({
    render: vi.fn(() => Array.from({ length: 4 }, (_, index) => ({
      x: 50 + index * 80,
      y: 90,
      width: 62,
      height: 42,
      fontSize: 12,
      visible: true,
    }))),
    dispose: vi.fn(),
  }));
});

function installAnimationFrameQueue() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
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
    advance(timestamp: number) {
      const first = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
      if (!first) return false;
      callbacks.delete(first[0]);
      act(() => first[1](timestamp));
      return true;
    },
    restore() {
      if (originalRequest) Object.defineProperty(window, "requestAnimationFrame", originalRequest);
      else Reflect.deleteProperty(window, "requestAnimationFrame");
      if (originalCancel) Object.defineProperty(window, "cancelAnimationFrame", originalCancel);
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

function tapSide(stage: HTMLElement, direction: "left" | "right", pointerId = 1) {
  const clientX = direction === "left" ? 100 : 900;
  fireEvent.pointerDown(stage, { pointerId, clientX, clientY: 200 });
  fireEvent.pointerUp(stage, { pointerId, clientX, clientY: 200 });
}

describe("MCQ with Game gesture controls and continuous 3D scene", () => {
  it("steers one lane per short tap, clamps lane boundaries, and removes visible steering buttons", () => {
    render(
      <MCQWithGame
        questionKey="q-steer"
        questionContent="7 × 4 = ?"
        options={options}
        correctAnswer="28"
        feedback={null}
        selectedOption={null}
        correctScore={0}
        wrongScore={0}
        durationMs={5200}
        onCollision={vi.fn()}
      />,
    );

    const stage = screen.getByRole("group", { name: /tap the left or right side to steer/i });
    expect(screen.getByText("7 × 4 = ?")).toBeInTheDocument();
    expect(document.body.querySelectorAll(".mcq-game-gate-label")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Steer left" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Steer right" })).not.toBeInTheDocument();

    tapSide(stage, "left");
    expect(stage).toHaveAttribute("data-lane-index", "0");

    tapSide(stage, "left", 2);
    expect(stage).toHaveAttribute("data-lane-index", "0");

    tapSide(stage, "right", 3);
    expect(stage).toHaveAttribute("data-lane-index", "1");
  });

  it("turns a long hold into a speed boost without also changing the lane", () => {
    vi.useFakeTimers();
    render(
      <MCQWithGame
        questionKey="q-hold"
        questionContent="Hold gesture"
        options={options}
        correctAnswer="28"
        feedback={null}
        selectedOption={null}
        correctScore={0}
        wrongScore={0}
        durationMs={5200}
        onCollision={vi.fn()}
      />,
    );

    const stage = screen.getByRole("group", { name: /tap the left or right side to steer/i });
    fireEvent.pointerDown(stage, { pointerId: 7, clientX: 100, clientY: 200 });
    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(stage).toHaveAttribute("data-lane-index", "1");
    expect(screen.getByLabelText("Speed boost active")).toBeInTheDocument();

    fireEvent.pointerUp(stage, { pointerId: 7, clientX: 100, clientY: 200 });
    expect(stage).toHaveAttribute("data-lane-index", "1");
    expect(screen.queryByLabelText("Speed boost active")).not.toBeInTheDocument();
  });

  it("submits exactly the collided gate's displayed option once", () => {
    const raf = installAnimationFrameQueue();
    const onCollision = vi.fn();
    const mappings = createMCQGateMappings("q-1", options.map((option) => option.value));
    const view = render(
      <MCQWithGame
        questionKey="q-1"
        questionContent="14 + 14 = ?"
        options={options}
        correctAnswer="28"
        feedback={null}
        selectedOption={null}
        correctScore={0}
        wrongScore={0}
        durationMs={1200}
        onCollision={onCollision}
      />,
    );

    try {
      const stage = screen.getByRole("group", { name: /tap the left or right side to steer/i });
      tapSide(stage, "right");
      expect(stage).toHaveAttribute("data-lane-index", "2");

      for (let timestamp = 0; timestamp <= 1_250; timestamp += 50) {
        raf.advance(timestamp);
      }

      expect(onCollision).toHaveBeenCalledTimes(1);
      expect(onCollision).toHaveBeenCalledWith(2, "22", mappings[2].gateId);

      for (let timestamp = 1_300; timestamp <= 2_000; timestamp += 50) {
        raf.advance(timestamp);
      }
      expect(onCollision).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("keeps the same WebGL scene when the quiz engine advances to the next question", () => {
    const onCollision = vi.fn();
    const props = {
      options,
      correctAnswer: "28",
      feedback: null,
      selectedOption: null,
      correctScore: 0,
      wrongScore: 0,
      durationMs: 5200,
      onCollision,
    } as const;
    const view = render(
      <MCQWithGame {...props} questionKey="question-1" questionContent="First question" />,
    );

    expect(screen.getByText("First question")).toBeInTheDocument();
    expect(createMCQ3DScene).toHaveBeenCalledTimes(1);

    view.rerender(
      <MCQWithGame {...props} questionKey="question-2" questionContent="Second question" />,
    );

    expect(screen.getByText("Second question")).toBeInTheDocument();
    expect(createMCQ3DScene).toHaveBeenCalledTimes(1);
  });

  it("provides a once-only recoverable answer fallback when WebGL is unavailable", () => {
    vi.mocked(createMCQ3DScene).mockImplementation(() => {
      throw new Error("WebGL unavailable");
    });
    const onCollision = vi.fn();

    render(
      <MCQWithGame
        questionKey="fallback-q"
        questionContent="Fallback question"
        options={options}
        correctAnswer="28"
        feedback={null}
        selectedOption={null}
        correctScore={0}
        wrongScore={0}
        durationMs={4800}
        onCollision={onCollision}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("3D graphics could not start");
    const answer = screen.getByRole("button", { name: "Lane 2, answer 28" });
    fireEvent.click(answer);
    fireEvent.click(answer);

    expect(onCollision).toHaveBeenCalledTimes(1);
    expect(onCollision).toHaveBeenCalledWith(
      1,
      "28",
      createMCQGateMappings("fallback-q", options.map((option) => option.value))[1].gateId,
    );
  });
});
