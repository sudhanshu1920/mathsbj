import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MCQWithGame from "@/components/MCQWithGame";
import { createMCQGateMappings } from "@/lib/mcqGamePhysics";
import { createMCQ3DScene } from "@/lib/mcq3dRenderer";
import { createRacingAudioController, playClick, playSwipe } from "@/lib/sound";

const racingAudioMocks = vi.hoisted(() => ({
  unlock: vi.fn(),
  update: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  dispose: vi.fn(),
  playClick: vi.fn(),
  playSwipe: vi.fn(),
}));

vi.mock("@/lib/sound", () => ({
  createRacingAudioController: vi.fn(() => ({
    unlock: racingAudioMocks.unlock,
    update: racingAudioMocks.update,
    pause: racingAudioMocks.pause,
    resume: racingAudioMocks.resume,
    dispose: racingAudioMocks.dispose,
  })),
  playClick: racingAudioMocks.playClick,
  playSwipe: racingAudioMocks.playSwipe,
}));

vi.mock("@/lib/mcq3dRenderer", () => ({
  createMCQ3DScene: vi.fn(() => ({
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
  vi.clearAllMocks();
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
    finalSubmitReady: false,
    canFinalizeTest: false,
    onSelectOption: vi.fn(),
    onFinalSubmit: vi.fn(),
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
    expect(screen.getByText("NEON NITRO")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Submit complete test" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit complete test" })).toHaveTextContent("Submit test");
    expect(view.container.querySelectorAll(".mcq-game-gate-letter")).toHaveLength(0);
    expect(view.container.querySelectorAll(".mcq-game-gate-label")).toHaveLength(4);
  });

  it("does not submit or steer when an answer target is tapped", () => {
    const onSelectOption = vi.fn();
    const view = render(<MCQWithGame {...gameProps({ onSelectOption })} />);
    const gate = view.container.querySelector('[data-option-id]') as HTMLElement;
    const stage = screen.getByRole("group", { name: /tap the left or right side/i });
    const laneReadout = view.container.querySelector("[data-testid='mcq-game-lane-readout']");

    expect(createRacingAudioController).toHaveBeenCalledTimes(1);
    expect(gate).toHaveAttribute("role", "listitem");
    fireEvent.pointerDown(gate, { pointerId: 5, button: 0, clientX: 80, clientY: 280 });
    fireEvent.pointerUp(gate, { pointerId: 5, button: 0, clientX: 80, clientY: 280 });
    fireEvent.click(gate);

    expect(onSelectOption).not.toHaveBeenCalled();
    expect(laneReadout).toHaveTextContent("Lane 2");
    expect(playSwipe).not.toHaveBeenCalled();
    expect(racingAudioMocks.unlock).not.toHaveBeenCalled();
    expect(stage).toBeInTheDocument();
  });

  it("keeps answer-target taps separate from the whole-test Submit action", () => {
    const onSelectOption = vi.fn();
    const onFinalSubmit = vi.fn();
    const view = render(<MCQWithGame {...gameProps({ onSelectOption, onFinalSubmit })} />);
    const submit = screen.getByTestId("mcq-game-submit");

    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(onSelectOption).not.toHaveBeenCalled();
    expect(onFinalSubmit).not.toHaveBeenCalled();

    const gate = view.container.querySelector('[data-option-id]') as HTMLElement;
    fireEvent.click(gate);
    fireEvent.click(gate);
    expect(onSelectOption).not.toHaveBeenCalled();
    expect(onFinalSubmit).not.toHaveBeenCalled();
    expect(submit).toBeDisabled();
  });

  it("finalizes the whole test only when ready and ignores rapid repeat taps", () => {
    const onFinalSubmit = vi.fn();
    const view = render(<MCQWithGame {...gameProps({ canFinalizeTest: true, onFinalSubmit })} />);
    const submit = screen.getByTestId("mcq-game-submit");

    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(onFinalSubmit).toHaveBeenCalledTimes(1);
    expect(playClick).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(racingAudioMocks.dispose).toHaveBeenCalledTimes(1);
  });

  it("does not finalize or skip a question while no whole-test submission is ready", () => {
    const onSelectOption = vi.fn();
    const onFinalSubmit = vi.fn();
    render(<MCQWithGame {...gameProps({ onSelectOption, onFinalSubmit })} />);
    const submit = screen.getByTestId("mcq-game-submit");

    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(onSelectOption).not.toHaveBeenCalled();
    expect(onFinalSubmit).not.toHaveBeenCalled();
  });

  it("does not create a submission lock when the player only taps a rendered gate", () => {
    const onSelectOption = vi.fn();
    const view = render(<MCQWithGame {...gameProps({ onSelectOption })} />);
    const gates = view.container.querySelectorAll(".mcq-game-gate-label");

    fireEvent.click(gates[1]);
    fireEvent.click(gates[1]);
    expect(onSelectOption).not.toHaveBeenCalled();
    expect(gates[1]).not.toHaveClass("mcq-game-gate--selected");
  });

  it("restores automatic collision handling after the quiz engine rejects a selection", () => {
    const raf = installAnimationFrameQueue();
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    let rejectFirstAttempt = true;
    const onSelectOption = vi.fn(() => {
      if (rejectFirstAttempt) {
        rejectFirstAttempt = false;
        return false;
      }
      return true;
    });
    const mappings = createMCQGateMappings("q-1", options.map((option) => option.value));
    const view = render(<MCQWithGame {...gameProps({ onSelectOption })} />);
    const stage = screen.getByRole("group", { name: /tap the left or right side/i });
    setStageBounds(stage);

    try {
      // Enter the left gate. The quiz engine rejects that first commit.
      fireEvent.pointerDown(stage, { pointerId: 31, button: 0, clientX: 20, clientY: 650 });
      now = 40;
      fireEvent.pointerUp(stage, { pointerId: 31, button: 0, clientX: 20, clientY: 650 });
      for (let timestamp = 0; timestamp <= 2_300; timestamp += 50) raf.advance(timestamp);

      expect(onSelectOption).toHaveBeenCalledTimes(1);
      expect(onSelectOption.mock.calls[0]).toEqual([0, "26", mappings[0].gateId]);

      // Re-enter a different fixed gate on the same question. Auto-collision
      // must work again instead of remaining locked after the rejected commit.
      fireEvent.pointerDown(stage, { pointerId: 32, button: 0, clientX: 320, clientY: 650 });
      now = 80;
      fireEvent.pointerUp(stage, { pointerId: 32, button: 0, clientX: 320, clientY: 650 });
      for (let timestamp = 2_350; timestamp <= 4_650; timestamp += 50) raf.advance(timestamp);

      expect(onSelectOption).toHaveBeenCalledTimes(2);
      expect(onSelectOption.mock.calls[1]).toEqual([1, "28", mappings[1].gateId]);
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
      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 1");

      fireEvent.pointerDown(stage, { pointerId: 1, button: 0, clientX: 320, clientY: 650 });
      now = 200;
      fireEvent.pointerUp(stage, { pointerId: 1, button: 0, clientX: 320, clientY: 650 });
      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 2");
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
      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 2");
      expect(screen.getByRole("status")).toHaveTextContent("Speed boost active");

      now = 320;
      fireEvent.pointerUp(stage, { pointerId: 8, button: 0, clientX: 320, clientY: 650 });
      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 2");
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
        .toHaveTextContent("Lane 2");
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

      for (let timestamp = 0; timestamp <= 500; timestamp += 50) raf.advance(timestamp);
      const beforeQuestionSpeed = Number(
        racingAudioMocks.update.mock.calls.filter((call) => call[1] === true).at(-1)?.[0],
      );
      expect(beforeQuestionSpeed).toBeGreaterThan(1);

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

      for (let timestamp = 550; timestamp <= 850; timestamp += 50) raf.advance(timestamp);
      const afterQuestionSpeed = Number(
        racingAudioMocks.update.mock.calls.filter((call) => call[1] === true).at(-1)?.[0],
      );
      // The session speed value must not snap back on the question-key change;
      // continuous speed integration itself is covered by the physics unit tests.
      expect(afterQuestionSpeed).toBeGreaterThanOrEqual(beforeQuestionSpeed);
      expect(createRacingAudioController).toHaveBeenCalledTimes(1);

      now = 860;
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

      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 2");
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("submits the exact fixed gate entered by the car and reuses the existing 3D scene", () => {
    const raf = installAnimationFrameQueue();
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const onSelectOption = vi.fn();
    const firstMappings = createMCQGateMappings("q-1", options.map((option) => option.value));
    const view = render(<MCQWithGame {...gameProps({ onSelectOption })} />);
    const stage = screen.getByRole("group", { name: /tap the left or right side/i });
    setStageBounds(stage);

    try {
      const labels = Array.from(view.container.querySelectorAll<HTMLElement>(".mcq-game-gate-label"));
      const fixedPositions = labels.map((element) => [element.style.left, element.style.top, element.style.width, element.style.height]);

      // The car sweeps left out of its starting lane and enters lane 1's gate
      // collider. The exact visible option/gate identity is submitted once.
      fireEvent.pointerDown(stage, { pointerId: 4, button: 0, clientX: 20, clientY: 650 });
      now = 40;
      fireEvent.pointerUp(stage, { pointerId: 4, button: 0, clientX: 20, clientY: 650 });
      for (let timestamp = 0; timestamp <= 2_300; timestamp += 50) raf.advance(timestamp);

      expect(onSelectOption).toHaveBeenCalledTimes(1);
      expect(onSelectOption).toHaveBeenCalledWith(0, "26", firstMappings[0].gateId);
      expect(createMCQ3DScene).toHaveBeenCalledTimes(1);
      expect(labels.map((element) => [element.style.left, element.style.top, element.style.width, element.style.height]))
        .not.toEqual(fixedPositions);

      const secondOptions = [
        { value: "29", label: "29" },
        { value: "27", label: "27" },
        { value: "31", label: "31" },
        { value: "25", label: "25" },
      ];
      const firstGateNode = labels[0];
      view.rerender(<MCQWithGame {...gameProps({
        questionKey: "q-2",
        questionLabel: <p>18 + 9 = ?</p>,
        options: secondOptions,
        correctAnswer: "27",
        onSelectOption,
      })} />);

      expect(screen.getByText("18 + 9 = ?")).toBeInTheDocument();
      expect(view.container.querySelectorAll(".mcq-game-question-panel")).toHaveLength(1);
      expect(view.container.querySelectorAll(".mcq-game-gate-label")).toHaveLength(4);
      expect(view.container.querySelector(".mcq-game-gate-label")).toBe(firstGateNode);
      expect(labels.map((element) => [element.style.left, element.style.top, element.style.width, element.style.height]))
        .toEqual(fixedPositions);
      expect(Array.from(view.container.querySelectorAll<HTMLElement>(".mcq-game-gate-label"))
        .every((node) => (node.dataset.gateId || "").includes(encodeURIComponent("q-2")))).toBe(true);
      expect(createMCQ3DScene).toHaveBeenCalledTimes(1);

      // A second lateral entry on the next question submits its current option;
      // it does not reinitialize the renderer or require a per-question Submit.
      fireEvent.pointerDown(stage, { pointerId: 5, button: 0, clientX: 320, clientY: 650 });
      now = 80;
      fireEvent.pointerUp(stage, { pointerId: 5, button: 0, clientX: 320, clientY: 650 });
      for (let timestamp = 2_350; timestamp <= 4_650; timestamp += 50) raf.advance(timestamp);
      const nextMapping = createMCQGateMappings("q-2", secondOptions.map((option) => option.value))[1];
      expect(onSelectOption).toHaveBeenCalledTimes(2);
      expect(onSelectOption.mock.calls[1]).toEqual([1, "27", nextMapping.gateId]);
      expect(createMCQ3DScene).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("moves the answer-gate row toward the car and resets its world depth on each question", () => {
    const raf = installAnimationFrameQueue();
    const onSelectOption = vi.fn();
    const view = render(<MCQWithGame {...gameProps({ durationMs: 600, disabled: true, onSelectOption })} />);
    const scene = vi.mocked(createMCQ3DScene).mock.results[0]?.value;
    expect(scene).toBeDefined();
    const renderer = scene!.render as unknown as ReturnType<typeof vi.fn>;

    try {
      const labels = Array.from(view.container.querySelectorAll<HTMLElement>(".mcq-game-gate-label"));
      const initialPositions = labels.map((element) => [element.style.left, element.style.top, element.style.width, element.style.height]);
      for (let timestamp = 0; timestamp <= 1_000; timestamp += 50) raf.advance(timestamp);
      const approachingPositions = labels.map((element) => [element.style.left, element.style.top, element.style.width, element.style.height]);
      expect(approachingPositions).not.toEqual(initialPositions);
      expect(onSelectOption).not.toHaveBeenCalled();
      expect(renderer.mock.calls.every(([frame]) => Object.keys(frame as object).sort().join(",") === "carX,gateZ,scrollOffset")).toBe(true);
      const gateDepths = renderer.mock.calls.map(([frame]) => (frame as { gateZ: number }).gateZ);
      expect(gateDepths.some((gateZ) => gateZ > -9)).toBe(true);

      const secondOptions = [
        { value: "29", label: "29" },
        { value: "27", label: "27" },
        { value: "31", label: "31" },
        { value: "25", label: "25" },
      ];
      view.rerender(<MCQWithGame {...gameProps({
        questionKey: "q-2",
        questionLabel: <p>18 + 9 = ?</p>,
        options: secondOptions,
        correctAnswer: "27",
        durationMs: 600,
        disabled: true,
        onSelectOption,
      })} />);

      expect(screen.getByText("18 + 9 = ?")).toBeInTheDocument();
      expect(screen.getByText("29")).toBeInTheDocument();
      expect(screen.getByText("27")).toBeInTheDocument();
      const lastFrame = renderer.mock.calls[renderer.mock.calls.length - 1]?.[0] as { gateZ: number };
      expect(lastFrame.gateZ).toBeCloseTo(-9, 6);
      expect(createMCQ3DScene).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("does not use the question timer or road scroll as a substitute for gate contact", () => {
    const raf = installAnimationFrameQueue();
    const onSelectOption = vi.fn();
    const view = render(<MCQWithGame {...gameProps({ questionKey: "q-fast", durationMs: 350, onSelectOption })} />);
    try {
      for (let timestamp = 0; timestamp <= 1_500; timestamp += 25) raf.advance(timestamp);
      expect(onSelectOption).not.toHaveBeenCalled();
      expect(view.container.querySelectorAll(".mcq-game-gate-label")).toHaveLength(4);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("pauses the race loop and quiz timer, then resumes without recreating the 3D scene", () => {
    const raf = installAnimationFrameQueue();
    const onPauseChange = vi.fn();
    const onSelectOption = vi.fn();
    const view = render(<MCQWithGame {...gameProps({ onPauseChange, onSelectOption })} />);

    try {
      expect(raf.advance(0)).toBe(true);
      const updatesBeforePause = racingAudioMocks.update.mock.calls.length;

      fireEvent.click(screen.getByRole("button", { name: "Pause game" }));
      expect(screen.getByRole("dialog", { name: "Race paused" })).toBeInTheDocument();
      expect(onPauseChange).toHaveBeenNthCalledWith(1, true);
      expect(raf.advance(1000)).toBe(false);
      expect(racingAudioMocks.update).toHaveBeenCalledTimes(updatesBeforePause);
      expect(onSelectOption).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Resume race" }));
      expect(screen.queryByRole("dialog", { name: "Race paused" })).not.toBeInTheDocument();
      expect(onPauseChange).toHaveBeenNthCalledWith(2, false);
      expect(raf.advance(1050)).toBe(true);
      expect(createMCQ3DScene).toHaveBeenCalledTimes(1);
      expect(onSelectOption).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("requires explicit confirmation before restarting the racing quiz", () => {
    const onRestartGame = vi.fn();
    render(<MCQWithGame {...gameProps({ onRestartGame })} />);

    fireEvent.click(screen.getByRole("button", { name: "Pause game" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart quiz" }));

    expect(onRestartGame).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Restart race confirmation" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep race paused" }));
    expect(screen.getByRole("dialog", { name: "Race paused" })).toBeInTheDocument();
    expect(onRestartGame).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Restart quiz" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm restart" }));
    expect(onRestartGame).toHaveBeenCalledTimes(1);
  });

  it("shows textual feedback from the quiz engine alongside gate color feedback", () => {
    const view = render(<MCQWithGame {...gameProps({ feedback: "wrong", selectedOption: 0 })} />);
    expect(view.container.querySelector(".mcq-game-feedback")).toHaveTextContent("INCORRECT ANSWER");
  });

  it("labels a timed-out question as time up rather than an incorrect answer", () => {
    const view = render(<MCQWithGame {...gameProps({ feedback: "wrong", selectedOption: null })} />);
    expect(view.container.querySelector(".mcq-game-feedback")).toHaveTextContent("TIME'S UP");
    expect(view.container.querySelector(".mcq-game-feedback")).not.toHaveTextContent("INCORRECT ANSWER");
  });

  it("stays paused after returning from background until the player explicitly resumes", () => {
    const onPauseChange = vi.fn();
    render(<MCQWithGame {...gameProps({ onPauseChange })} />);

    act(() => window.dispatchEvent(new Event("blur")));
    expect(screen.getByRole("dialog", { name: "Race paused" })).toBeInTheDocument();
    expect(onPauseChange).toHaveBeenNthCalledWith(1, true);

    act(() => window.dispatchEvent(new Event("focus")));
    expect(screen.getByRole("dialog", { name: "Race paused" })).toBeInTheDocument();
    expect(onPauseChange).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Resume race" }));
    expect(onPauseChange).toHaveBeenNthCalledWith(2, false);
  });

  it("pauses on document visibility changes even if WebGL rendering cannot start", () => {
    vi.mocked(createMCQ3DScene).mockImplementation(() => {
      throw new Error("WebGL unavailable");
    });
    const onPauseChange = vi.fn();
    render(<MCQWithGame {...gameProps({ onPauseChange })} />);
    const originalHidden = Object.getOwnPropertyDescriptor(document, "hidden");

    try {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(screen.getByRole("dialog", { name: "Race paused" })).toBeInTheDocument();
      expect(onPauseChange).toHaveBeenNthCalledWith(1, true);

      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(screen.getByRole("dialog", { name: "Race paused" })).toBeInTheDocument();
      expect(onPauseChange).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "Resume race" }));
      expect(onPauseChange).toHaveBeenNthCalledWith(2, false);
    } finally {
      if (originalHidden) Object.defineProperty(document, "hidden", originalHidden);
      else Reflect.deleteProperty(document, "hidden");
    }
  });

  it("preserves lane position across question changes but resets driving state for a new quiz session", () => {
    const raf = installAnimationFrameQueue();
    let now = 10;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const view = render(<MCQWithGame {...gameProps({ sessionKey: "session-1" })} />);
    const stage = screen.getByRole("group", { name: /tap the left or right side/i });
    setStageBounds(stage);

    try {
      fireEvent.pointerDown(stage, { pointerId: 1, button: 0, clientX: 320, clientY: 650 });
      now = 40;
      fireEvent.pointerUp(stage, { pointerId: 1, button: 0, clientX: 320, clientY: 650 });
      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 3");

      view.rerender(<MCQWithGame {...gameProps({
        questionKey: "q-2",
        sessionKey: "session-1",
        questionLabel: <p>18 + 9 = ?</p>,
      })} />);
      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 3");

      view.rerender(<MCQWithGame {...gameProps({
        questionKey: "q-3",
        sessionKey: "session-2",
        questionLabel: <p>20 + 7 = ?</p>,
      })} />);
      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 2");
      expect(createMCQ3DScene).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("does not submit fallback targets without WebGL and reserves Submit for whole-test finalization", () => {
    vi.mocked(createMCQ3DScene).mockImplementation(() => {
      throw new Error("WebGL unavailable");
    });
    const onSelectOption = vi.fn();
    const onFinalSubmit = vi.fn();
    const view = render(<MCQWithGame {...gameProps({
      questionKey: "fallback-q",
      onSelectOption,
      onFinalSubmit,
    })} />);

    expect(screen.getByRole("alert")).toHaveTextContent("3D graphics are unavailable");
    const target = view.container.querySelector("[data-option-id]") as HTMLElement;
    expect(target).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(target);
    fireEvent.click(target);
    expect(onSelectOption).not.toHaveBeenCalled();
    expect(onFinalSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("mcq-game-submit")).toBeDisabled();

    view.rerender(<MCQWithGame {...gameProps({
      questionKey: "fallback-q",
      finalSubmitReady: true,
      canFinalizeTest: true,
      onSelectOption,
      onFinalSubmit,
    })} />);
    fireEvent.click(screen.getByTestId("mcq-game-submit"));
    expect(onSelectOption).not.toHaveBeenCalled();
    expect(onFinalSubmit).toHaveBeenCalledTimes(1);
  });
});
