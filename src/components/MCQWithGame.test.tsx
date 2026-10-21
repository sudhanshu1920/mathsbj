import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MCQWithGame from "@/components/MCQWithGame";
import { createMCQGateMappings } from "@/lib/mcqGamePhysics";
import { createMCQ3DScene } from "@/lib/mcq3dRenderer";

vi.mock("@/lib/mcq3dRenderer", () => ({
  createMCQ3DScene: vi.fn(() => ({
    render: vi.fn(() => Array.from({ length: 4 }, (_, index) => ({
      x: 50 + index * 80,
      y: 280,
      width: 62,
      height: 42,
      fontSize: 12,
      visible: true,
    }))),
    dispose: vi.fn(),
  })),
}));

const originalPointerEventDescriptor = Object.getOwnPropertyDescriptor(window, "PointerEvent");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(createMCQ3DScene).mockReset();
  vi.useRealTimers();
  if (originalPointerEventDescriptor) {
    Object.defineProperty(window, "PointerEvent", originalPointerEventDescriptor);
  } else {
    Reflect.deleteProperty(window, "PointerEvent");
  }
});

beforeEach(() => {
  // jsdom does not implement PointerEvent by default. Its generic Event fallback
  // drops clientX, which makes both screen halves look like the left zone.
  if (!window.PointerEvent) {
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      writable: true,
      value: MouseEvent,
    });
  }
  vi.mocked(createMCQ3DScene).mockImplementation(() => ({
    render: vi.fn(() => Array.from({ length: 4 }, (_, index) => ({
      x: 50 + index * 80,
      y: 280,
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

function gameProps(overrides: Partial<ComponentProps<typeof MCQWithGame>> = {}) {
  return {
    questionKey: "q-1",
    questionLabel: <p>14 × 2 = ?</p>,
    options,
    correctAnswer: "28",
    feedback: null,
    selectedOption: null,
    correctScore: 0,
    wrongScore: 0,
    durationMs: 1200,
    progressLabel: "1 / 10",
    onCollision: vi.fn(),
    ...overrides,
  };
}

function setStageBounds(stage: HTMLElement) {
  vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 800,
    width: 400, height: 800, toJSON: () => ({}),
  } as DOMRect);
}

describe("Full-screen continuous MCQ racing", () => {
  it("has no visible steering buttons and a fixed floating question panel", () => {
    const view = render(<MCQWithGame {...gameProps()} />);
    const stage = screen.getByRole("group", { name: /tap the left or right side/i });

    expect(view.container.querySelectorAll(".mcq-game-controls")).toHaveLength(0);
    expect(view.container.querySelectorAll("button[aria-label='Steer left'], button[aria-label='Steer right']")).toHaveLength(0);
    expect(view.container.querySelector(".mcq-game-question-panel")).toBeInTheDocument();
    expect(screen.getByText("14 × 2 = ?")).toBeInTheDocument();
    expect(stage).toHaveAttribute("data-swipe-ignore-back", "true");
  });

  it("renders separate reference-style status and floating question HUDs", () => {
    const view = render(
      <MCQWithGame
        {...gameProps({
          correctScore: 4,
          wrongScore: 0,
          progressLabel: "5 / 10",
          timerLabel: "6s",
        })}
      />,
    );

    expect(view.container.querySelector(".mcq-game-topbar")).toBeInTheDocument();
    expect(view.container.querySelector(".mcq-game-question-panel")).toBeInTheDocument();
    expect(view.container.querySelector(".mcq-game-question-panel .mcq-game-question-meta")).toBeNull();
    expect(screen.getByLabelText("4 correct answers")).toBeInTheDocument();
    expect(screen.getByLabelText("0 incorrect answers")).toBeInTheDocument();
    expect(screen.getByLabelText("Question 5 / 10")).toBeInTheDocument();
    expect(screen.getByLabelText("Time remaining 6s")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit selected answer, option B" })).toBeInTheDocument();
  });

  it("lets Submit commit the current lane once and shares the collision one-shot guard", () => {
    const raf = installAnimationFrameQueue();
    const onCollision = vi.fn();
    const view = render(<MCQWithGame {...gameProps({ onCollision })} />);
    const submit = screen.getByTestId("mcq-game-submit");

    try {
      fireEvent.click(submit);
      expect(onCollision).toHaveBeenCalledTimes(1);
      expect(onCollision).toHaveBeenCalledWith(
        1,
        "28",
        createMCQGateMappings("q-1", options.map((option) => option.value))[1].gateId,
      );
      expect(submit).toBeDisabled();

      for (let timestamp = 0; timestamp <= 1_500; timestamp += 50) raf.advance(timestamp);
      expect(onCollision).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("uses a short tap on each screen half for exactly one lane change", () => {
    vi.useFakeTimers();
    const raf = installAnimationFrameQueue();
    let now = 100;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const view = render(<MCQWithGame {...gameProps()} />);
    const stage = screen.getByRole("group", { name: /tap the left or right side/i });
    setStageBounds(stage);

    try {
      fireEvent.pointerDown(stage, { pointerId: 1, button: 0, clientX: 80, clientY: 650 });
      now = 150;
      fireEvent.pointerUp(stage, { pointerId: 1, button: 0, clientX: 80, clientY: 650 });
      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 1, option A");

      fireEvent.pointerDown(stage, { pointerId: 1, button: 0, clientX: 320, clientY: 650 });
      now = 200;
      fireEvent.pointerUp(stage, { pointerId: 1, button: 0, clientX: 320, clientY: 650 });
      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 2, option B");
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("treats a long press as speed boost without repeated lane changes, then restores normal speed", () => {
    const raf = installAnimationFrameQueue();
    vi.useFakeTimers();
    let now = 10;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const view = render(<MCQWithGame {...gameProps()} />);
    const stage = screen.getByRole("group", { name: /tap the left or right side/i });
    setStageBounds(stage);

    try {
      fireEvent.pointerDown(stage, { pointerId: 8, button: 0, clientX: 320, clientY: 650 });
      act(() => vi.advanceTimersByTime(300));
      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 2, option B");
      expect(screen.getByRole("status")).toHaveTextContent("Speed boost active");

      now = 320;
      fireEvent.pointerUp(stage, { pointerId: 8, button: 0, clientX: 320, clientY: 650 });
      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 2, option B");
      expect(screen.getByRole("status")).toHaveTextContent("Racing");
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("does not convert a large pointer drag into an accidental lane tap", () => {
    const raf = installAnimationFrameQueue();
    let now = 10;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const view = render(<MCQWithGame {...gameProps()} />);
    const stage = screen.getByRole("group", { name: /tap the left or right side/i });
    setStageBounds(stage);

    try {
      fireEvent.pointerDown(stage, { pointerId: 5, button: 0, clientX: 80, clientY: 650 });
      fireEvent.pointerMove(stage, { pointerId: 5, clientX: 115, clientY: 650 });
      now = 50;
      fireEvent.pointerUp(stage, { pointerId: 5, button: 0, clientX: 115, clientY: 650 });

      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']"))
        .toHaveTextContent("Lane 2, option B");
      expect(screen.getByRole("status")).toHaveTextContent("Racing");
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("preserves an active hold when the question changes", () => {
    const raf = installAnimationFrameQueue();
    vi.useFakeTimers();
    let now = 10;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const view = render(<MCQWithGame {...gameProps()} />);
    const stage = screen.getByRole("group", { name: /tap the left or right side/i });
    setStageBounds(stage);

    try {
      fireEvent.pointerDown(stage, { pointerId: 8, button: 0, clientX: 320, clientY: 650 });
      act(() => vi.advanceTimersByTime(300));
      expect(screen.getByRole("status")).toHaveTextContent("Speed boost active");

      view.rerender(<MCQWithGame {...gameProps({
        questionKey: "q-2",
        questionLabel: <p>18 + 9 = ?</p>,
        options: [
          { value: "29", label: "29" },
          { value: "27", label: "27" },
          { value: "31", label: "31" },
          { value: "25", label: "25" },
        ],
        correctAnswer: "27",
      })} />);

      expect(screen.getByText("18 + 9 = ?")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Speed boost active");

      now = 350;
      fireEvent.pointerUp(stage, { pointerId: 8, button: 0, clientX: 320, clientY: 650 });
      expect(screen.getByRole("status")).toHaveTextContent("Racing");
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("does not steer when the initial pointer-down is on the question panel or an answer gate", () => {
    const raf = installAnimationFrameQueue();
    let now = 10;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const view = render(<MCQWithGame {...gameProps()} />);
    const question = view.container.querySelector(".mcq-game-question-panel") as HTMLElement;
    const gate = view.container.querySelector(".mcq-game-gate-label") as HTMLElement;
    const stage = screen.getByRole("group", { name: /tap the left or right side/i });
    setStageBounds(stage);

    try {
      fireEvent.pointerDown(question, { pointerId: 1, button: 0, clientX: 80, clientY: 20 });
      now = 40;
      fireEvent.pointerUp(question, { pointerId: 1, button: 0, clientX: 80, clientY: 20 });
      fireEvent.pointerDown(gate, { pointerId: 2, button: 0, clientX: 80, clientY: 280 });
      now = 70;
      fireEvent.pointerUp(gate, { pointerId: 2, button: 0, clientX: 80, clientY: 280 });

      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 2, option B");
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("submits the exact collided option once and reuses the same 3D scene for the next question", () => {
    const raf = installAnimationFrameQueue();
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const onCollision = vi.fn();
    const mappings = createMCQGateMappings("q-1", options.map((option) => option.value));
    const firstProps = gameProps({ onCollision });
    const view = render(<MCQWithGame {...firstProps} />);
    const stage = screen.getByRole("group", { name: /tap the left or right side/i });
    setStageBounds(stage);

    try {
      // Tap into lane A; the gate must actually cross the car's collision plane.
      fireEvent.pointerDown(stage, { pointerId: 4, button: 0, clientX: 20, clientY: 650 });
      now = 40;
      fireEvent.pointerUp(stage, { pointerId: 4, button: 0, clientX: 20, clientY: 650 });
      for (let timestamp = 0; timestamp <= 1_350; timestamp += 50) raf.advance(timestamp);

      expect(onCollision).toHaveBeenCalledTimes(1);
      expect(onCollision).toHaveBeenCalledWith(0, "26", mappings[0].gateId);
      expect(createMCQ3DScene).toHaveBeenCalledTimes(1);

      const secondOptions = [
        { value: "29", label: "29" },
        { value: "27", label: "27" },
        { value: "31", label: "31" },
        { value: "25", label: "25" },
      ];
      view.rerender(
        <MCQWithGame
          {...gameProps({
            questionKey: "q-2",
            questionLabel: <p>18 + 9 = ?</p>,
            options: secondOptions,
            correctAnswer: "27",
            selectedOption: null,
            feedback: null,
            onCollision,
          })}
        />,
      );

      expect(screen.getByText("18 + 9 = ?")).toBeInTheDocument();
      expect(view.container.querySelectorAll(".mcq-game-gate-label")).toHaveLength(4);
      expect(Array.from(view.container.querySelectorAll<HTMLElement>(".mcq-game-gate-label"))
        .every((node) => (node.dataset.gateId || "").includes(encodeURIComponent("q-2")))).toBe(true);
      expect(createMCQ3DScene).toHaveBeenCalledTimes(1);

      for (let timestamp = 1_400; timestamp <= 2_800; timestamp += 50) raf.advance(timestamp);
      expect(onCollision).toHaveBeenCalledTimes(2);
      expect(onCollision.mock.calls[1]).toEqual([0, "29", createMCQGateMappings("q-2", secondOptions.map((option) => option.value))[0].gateId]);
      expect(createMCQ3DScene).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("honors short gate travel times for a 1-second question timer", () => {
    const raf = installAnimationFrameQueue();
    const onCollision = vi.fn();
    const mappings = createMCQGateMappings("q-fast", options.map((option) => option.value));
    const view = render(
      <MCQWithGame {...gameProps({ questionKey: "q-fast", durationMs: 700, onCollision })} />,
    );

    try {
      for (let timestamp = 0; timestamp <= 800; timestamp += 50) raf.advance(timestamp);
      expect(onCollision).toHaveBeenCalledTimes(1);
      expect(onCollision).toHaveBeenCalledWith(1, "28", mappings[1].gateId);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("provides a recoverable direct-answer fallback when WebGL is unavailable", () => {
    vi.mocked(createMCQ3DScene).mockImplementation(() => {
      throw new Error("WebGL unavailable");
    });
    const onCollision = vi.fn();

    render(<MCQWithGame {...gameProps({ questionKey: "fallback-q", onCollision })} />);

    expect(screen.getByRole("alert")).toHaveTextContent("3D graphics are unavailable");
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
