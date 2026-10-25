import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MCQWithGame from "@/components/MCQWithGame";
import {
  createMCQGateMappings,
  createMCQGateApproachStartZs,
  MCQ_GAME_COLLISION_Z,
  MCQ_GAME_GATE_START_Z,
  MCQ_GAME_TRAVEL_DISTANCE,
} from "@/lib/mcqGamePhysics";
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
    render: vi.fn((frame: { gateZ: number; gateZs?: readonly number[]; gateActive?: readonly boolean[] }) => {
      return Array.from({ length: 4 }, (_, index) => {
        const gateZ = frame.gateZs?.[index] ?? frame.gateZ;
        const progress = Math.max(0, Math.min(1, (gateZ + 9) / 9.75));
        const perspective = 0.55 + progress * 0.75;
        return {
          x: 200 + (index - 1.5) * 48 * perspective,
          y: 275 + progress * 250,
          width: 24 + progress * 64,
          height: 18 + progress * 38,
          fontSize: 9 + progress * 7,
          visible: frame.gateActive?.[index] !== false,
        };
      });
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
      value: class TestPointerEvent extends MouseEvent {
        pointerId: number;
        pointerType: string;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 0;
          this.pointerType = init.pointerType ?? "";
        }
      },
    });
  }
  vi.mocked(createMCQ3DScene).mockImplementation(() => ({
    render: vi.fn((frame: { gateZ: number; gateZs?: readonly number[]; gateActive?: readonly boolean[] }) => {
      return Array.from({ length: 4 }, (_, index) => {
        const gateZ = frame.gateZs?.[index] ?? frame.gateZ;
        const progress = Math.max(0, Math.min(1, (gateZ + 9) / 9.75));
        const perspective = 0.55 + progress * 0.75;
        return {
          x: 200 + (index - 1.5) * 48 * perspective,
          y: 275 + progress * 250,
          width: 24 + progress * 64,
          height: 18 + progress * 38,
          fontSize: 9 + progress * 7,
          visible: frame.gateActive?.[index] !== false,
        };
      });
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


describe("Full-screen continuous MCQ racing", () => {
  it("renders dedicated Speed, Left and Right controls in a fixed screen-space layout", () => {
    const view = render(<MCQWithGame {...gameProps()} />);
    const stage = screen.getByRole("group", { name: /four answer lanes/i });

    expect(view.container.querySelectorAll(".mcq-game-controls")).toHaveLength(1);
    expect(screen.getByTestId("mcq-game-accelerate")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("mcq-game-steer-left")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("mcq-game-steer-right")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Accelerate \(hold\)/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Steer left" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Steer right" })).toBeEnabled();
    expect(view.container.querySelector(".mcq-game-question-panel")).toBeInTheDocument();
    expect(screen.getByText("NEON NITRO")).toBeInTheDocument();
    expect(screen.getByText("14 × 2 = ?")).toBeInTheDocument();
    expect(stage).toHaveAttribute("data-swipe-ignore-back", "true");
  });

  it("keeps the game selector in the top HUD and prevents HUD touches from steering", () => {
    const onChangeGame = vi.fn();
    const view = render(<MCQWithGame {...gameProps({ onChangeGame })} />);
    const topbar = view.container.querySelector(".mcq-game-topbar");
    const chooseGame = screen.getByRole("button", { name: "Choose another game" });

    expect(topbar).toContainElement(chooseGame);
    expect(chooseGame.parentElement).toBe(topbar);

    fireEvent.pointerDown(chooseGame, {
      button: 0,
      pointerId: 42,
      pointerType: "touch",
      clientX: 5,
      clientY: 780,
    });
    fireEvent.pointerUp(chooseGame, {
      pointerId: 42,
      pointerType: "touch",
      clientX: 5,
      clientY: 780,
    });
    expect(screen.getByTestId("mcq-game-lane-readout")).toHaveTextContent("Lane 2");

    fireEvent.click(chooseGame);
    expect(onChangeGame).toHaveBeenCalledTimes(1);
  });

  it("repositions the question from the measured HUD height after viewport changes", () => {
    const view = render(<MCQWithGame {...gameProps()} />);
    const topbar = view.container.querySelector(".mcq-game-topbar") as HTMLDivElement;
    const panel = view.container.querySelector(".mcq-game-question-panel") as HTMLDivElement;
    const stage = view.container.querySelector(".mcq-game-stage") as HTMLDivElement;

    vi.spyOn(topbar, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 8, left: 0, top: 8, right: 360, bottom: 112, width: 360, height: 104,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
      x: 20, y: 124, left: 20, top: 124, right: 340, bottom: 190, width: 320, height: 66,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.resize(window);

    const gap = window.innerHeight <= 520 ? 8 : 12;
    expect(stage.style.getPropertyValue("--mcq-game-question-top")).toBe(`${112 + gap}px`);
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
    const stage = screen.getByRole("group", { name: /four answer lanes/i });
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
    const onSelectOption = vi.fn((
      _laneIndex: number,
      _optionValue: string | number,
      _gateId: string,
      _contactTimestampMs?: number,
    ): boolean => {
      if (rejectFirstAttempt) {
        rejectFirstAttempt = false;
        return false;
      }
      return true;
    });
    const mappings = createMCQGateMappings("q-1", options.map((option) => option.value));
    const view = render(<MCQWithGame {...gameProps({ onSelectOption })} />);
    const left = screen.getByTestId("mcq-game-steer-left");
    const right = screen.getByTestId("mcq-game-steer-right");

    try {
      // Hold LEFT until the first real gate collision is rejected.
      fireEvent.pointerDown(left, { pointerId: 31, pointerType: "touch", button: 0 });
      now = 40;
      for (let timestamp = 0; timestamp <= 1_100; timestamp += 50) raf.advance(timestamp);

      expect(onSelectOption).toHaveBeenCalledTimes(1);
      expect(onSelectOption.mock.calls[0].slice(0, 3)).toEqual([0, "26", mappings[0].gateId]);
      expect(onSelectOption.mock.calls[0][3]).toEqual(expect.any(Number));

      // The rejected commit releases that control. Steering RIGHT must still work
      // and a fresh contact on the next target must be accepted.
      fireEvent.pointerDown(right, { pointerId: 32, pointerType: "touch", button: 0 });
      now = 80;
      for (let timestamp = 1_150; timestamp <= 4_650; timestamp += 50) raf.advance(timestamp);

      expect(onSelectOption).toHaveBeenCalledTimes(2);
      expect(onSelectOption.mock.calls[1].slice(0, 3)).toEqual([1, "28", mappings[1].gateId]);
      expect(onSelectOption.mock.calls[1][3]).toEqual(expect.any(Number));
    } finally {
      fireEvent.pointerCancel(left, { pointerId: 31, pointerType: "touch" });
      fireEvent.pointerCancel(right, { pointerId: 32, pointerType: "touch" });
      view.unmount();
      raf.restore();
    }
  });

  it("accelerates immediately on Speed press and coasts after that pointer releases", () => {
    const raf = installAnimationFrameQueue();
    vi.spyOn(performance, "now").mockReturnValue(0);
    const view = render(<MCQWithGame {...gameProps({ durationMs: 30_000 })} />);
    const speed = screen.getByTestId("mcq-game-accelerate");
    const right = screen.getByTestId("mcq-game-steer-right");
    const scene = vi.mocked(createMCQ3DScene).mock.results[0]?.value;
    const renderer = scene!.render as unknown as ReturnType<typeof vi.fn>;

    try {
      fireEvent.pointerDown(speed, { pointerId: 1, pointerType: "touch", button: 0 });
      fireEvent.pointerDown(right, { pointerId: 2, pointerType: "touch", button: 0 });
      expect(speed).toHaveAttribute("aria-pressed", "true");
      expect(right).toHaveAttribute("aria-pressed", "true");

      for (let timestamp = 0; timestamp <= 400; timestamp += 50) raf.advance(timestamp);
      const bothActiveFrame = renderer.mock.calls.at(-1)?.[0] as { carX: number };
      const acceleratedSpeed = racingAudioMocks.update.mock.calls.at(-1)?.[0] as number;
      expect(bothActiveFrame.carX).toBeGreaterThan(-1.15);
      expect(acceleratedSpeed).toBeGreaterThan(1);

      fireEvent.pointerUp(right, { pointerId: 2, pointerType: "touch" });
      expect(right).toHaveAttribute("aria-pressed", "false");
      expect(speed).toHaveAttribute("aria-pressed", "true");
      raf.advance(450);
      const continuedSpeed = racingAudioMocks.update.mock.calls.at(-1)?.[0] as number;
      expect(continuedSpeed).toBeGreaterThan(acceleratedSpeed);

      fireEvent.pointerUp(speed, { pointerId: 1, pointerType: "touch" });
      expect(speed).toHaveAttribute("aria-pressed", "false");
      raf.advance(500);
      const coastSpeed = racingAudioMocks.update.mock.calls.at(-1)?.[0] as number;
      expect(coastSpeed).toBeLessThan(continuedSpeed);
      expect(coastSpeed).toBeGreaterThan(1);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("keeps steering active when Speed releases and restores older steering when the newest direction lifts", () => {
    const raf = installAnimationFrameQueue();
    vi.spyOn(performance, "now").mockReturnValue(0);
    const view = render(<MCQWithGame {...gameProps({ durationMs: 30_000 })} />);
    const speed = screen.getByTestId("mcq-game-accelerate");
    const left = screen.getByTestId("mcq-game-steer-left");
    const right = screen.getByTestId("mcq-game-steer-right");
    try {
      fireEvent.pointerDown(left, { pointerId: 11, pointerType: "touch", button: 0 });
      fireEvent.pointerDown(speed, { pointerId: 12, pointerType: "touch", button: 0 });
      fireEvent.pointerDown(right, { pointerId: 13, pointerType: "touch", button: 0 });
      expect(right).toHaveAttribute("aria-pressed", "true");
      expect(left).toHaveAttribute("aria-pressed", "false");

      fireEvent.pointerUp(speed, { pointerId: 12, pointerType: "touch" });
      expect(speed).toHaveAttribute("aria-pressed", "false");
      expect(right).toHaveAttribute("aria-pressed", "true");
      for (let timestamp = 0; timestamp <= 500; timestamp += 50) raf.advance(timestamp);
      const rightwardFrame = vi.mocked(createMCQ3DScene).mock.results[0]?.value.render as unknown as ReturnType<typeof vi.fn>;
      expect((rightwardFrame.mock.calls.at(-1)?.[0] as { carX: number }).carX).toBeGreaterThan(-1.15);

      fireEvent.pointerUp(right, { pointerId: 13, pointerType: "touch" });
      expect(left).toHaveAttribute("aria-pressed", "true");
      for (let timestamp = 550; timestamp <= 850; timestamp += 50) raf.advance(timestamp);
      expect((rightwardFrame.mock.calls.at(-1)?.[0] as { carX: number }).carX).toBeLessThan(1.15);
    } finally {
      fireEvent.pointerCancel(left, { pointerId: 11, pointerType: "touch" });
      view.unmount();
      raf.restore();
    }
  });

  it("uses the most recently activated steering direction and falls back when it releases", () => {
    const view = render(<MCQWithGame {...gameProps()} />);
    const left = screen.getByTestId("mcq-game-steer-left");
    const right = screen.getByTestId("mcq-game-steer-right");
    try {
      fireEvent.pointerDown(left, { pointerId: 21, pointerType: "touch", button: 0 });
      expect(left).toHaveAttribute("aria-pressed", "true");
      fireEvent.pointerDown(right, { pointerId: 22, pointerType: "touch", button: 0 });
      expect(right).toHaveAttribute("aria-pressed", "true");
      expect(left).toHaveAttribute("aria-pressed", "false");
      fireEvent.pointerUp(right, { pointerId: 22, pointerType: "touch" });
      expect(left).toHaveAttribute("aria-pressed", "true");
      fireEvent.pointerUp(left, { pointerId: 21, pointerType: "touch" });
      expect(left).toHaveAttribute("aria-pressed", "false");
      expect(right).toHaveAttribute("aria-pressed", "false");
    } finally {
      view.unmount();
    }
  });

  it("cancels only the pointer that is released or cancelled", () => {
    const view = render(<MCQWithGame {...gameProps()} />);
    const speed = screen.getByTestId("mcq-game-accelerate");
    const right = screen.getByTestId("mcq-game-steer-right");
    try {
      fireEvent.pointerDown(speed, { pointerId: 31, pointerType: "touch", button: 0 });
      fireEvent.pointerDown(right, { pointerId: 32, pointerType: "touch", button: 0 });
      fireEvent.pointerCancel(speed, { pointerId: 31, pointerType: "touch" });
      expect(speed).toHaveAttribute("aria-pressed", "false");
      expect(right).toHaveAttribute("aria-pressed", "true");
      fireEvent.lostPointerCapture(right, { pointerId: 32, pointerType: "touch" });
      expect(right).toHaveAttribute("aria-pressed", "false");
    } finally {
      view.unmount();
    }
  });

  it("ignores stale mouse pointer-capture events while a touch control remains held", () => {
    const view = render(<MCQWithGame {...gameProps()} />);
    const speed = screen.getByTestId("mcq-game-accelerate");
    const right = screen.getByTestId("mcq-game-steer-right");
    try {
      fireEvent.pointerDown(speed, { pointerId: 61, pointerType: "touch", button: 0 });
      fireEvent.pointerDown(right, { pointerId: 72, pointerType: "mouse", button: 0 });
      fireEvent.pointerUp(right, { pointerId: 72, pointerType: "mouse" });
      expect(right).toHaveAttribute("aria-pressed", "false");
      expect(speed).toHaveAttribute("aria-pressed", "true");

      // Browsers may dispatch lostpointercapture after pointerup. That old mouse ID
      // must not be resolved to the one still-active touch pointer.
      fireEvent.lostPointerCapture(right, { pointerId: 72, pointerType: "mouse" });
      expect(speed).toHaveAttribute("aria-pressed", "true");
      expect(right).toHaveAttribute("aria-pressed", "false");
    } finally {
      fireEvent.pointerCancel(speed, { pointerId: 61, pointerType: "touch" });
      view.unmount();
    }
  });

  it("does not let touches on the question or answer gates activate any driving control", () => {
    const view = render(<MCQWithGame {...gameProps()} />);
    const question = view.container.querySelector(".mcq-game-question-panel") as HTMLElement;
    const gate = view.container.querySelector(".mcq-game-gate-label") as HTMLElement;
    try {
      fireEvent.pointerDown(question, { pointerId: 40, pointerType: "touch", button: 0 });
      fireEvent.pointerDown(gate, { pointerId: 41, pointerType: "touch", button: 0 });
      expect(screen.getByTestId("mcq-game-accelerate")).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByTestId("mcq-game-steer-left")).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByTestId("mcq-game-steer-right")).toHaveAttribute("aria-pressed", "false");
    } finally {
      view.unmount();
    }
  });

  it("steers continuously by elapsed time and clamps against the road boundary", () => {
    const raf = installAnimationFrameQueue();
    vi.spyOn(performance, "now").mockReturnValue(0);
    const view = render(<MCQWithGame {...gameProps({ durationMs: 30_000 })} />);
    const left = screen.getByTestId("mcq-game-steer-left");
    const scene = vi.mocked(createMCQ3DScene).mock.results[0]?.value;
    const renderer = scene!.render as unknown as ReturnType<typeof vi.fn>;
    try {
      fireEvent.pointerDown(left, { pointerId: 51, pointerType: "touch", button: 0 });
      for (let timestamp = 0; timestamp <= 1_500; timestamp += 50) raf.advance(timestamp);
      const frame = renderer.mock.calls.at(-1)?.[0] as { carX: number };
      expect(frame.carX).toBeCloseTo(-3.45, 1);
      expect(screen.getByTestId("mcq-game-lane-readout")).toHaveTextContent("Lane 1");
      fireEvent.pointerUp(left, { pointerId: 51, pointerType: "touch" });
      expect(left).toHaveAttribute("aria-pressed", "false");
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("preserves speed across question changes while invalidating stale gate collisions", () => {
    const raf = installAnimationFrameQueue();
    vi.spyOn(performance, "now").mockReturnValue(0);
    const view = render(<MCQWithGame {...gameProps({ durationMs: 30_000 })} />);
    const speed = screen.getByTestId("mcq-game-accelerate");
    try {
      fireEvent.pointerDown(speed, { pointerId: 8, pointerType: "touch", button: 0 });
      for (let timestamp = 0; timestamp <= 400; timestamp += 50) raf.advance(timestamp);
      const before = racingAudioMocks.update.mock.calls.at(-1)?.[0] as number;
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
        durationMs: 30_000,
      })} />);
      expect(screen.getByText("18 + 9 = ?")).toBeInTheDocument();
      expect(screen.getByTestId("mcq-game-accelerate")).toHaveAttribute("aria-pressed", "true");
      for (let timestamp = 450; timestamp <= 750; timestamp += 50) raf.advance(timestamp);
      const after = racingAudioMocks.update.mock.calls.at(-1)?.[0] as number;
      expect(after).toBeGreaterThanOrEqual(before);
      fireEvent.pointerUp(screen.getByTestId("mcq-game-accelerate"), { pointerId: 8, pointerType: "touch" });
      expect(screen.getByTestId("mcq-game-accelerate")).toHaveAttribute("aria-pressed", "false");
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
    const left = screen.getByTestId("mcq-game-steer-left");

    try {
      const labels = Array.from(view.container.querySelectorAll<HTMLElement>(".mcq-game-gate-label"));
      const initialPositions = labels.map((element) => [element.style.left, element.style.top, element.style.width, element.style.height]);

      // Hold LEFT through the lane-0 gate's actual contact plane.
      fireEvent.pointerDown(left, { pointerId: 4, pointerType: "touch", button: 0 });
      now = 40;
      for (let timestamp = 0; timestamp <= 1_150; timestamp += 50) raf.advance(timestamp);

      const approachingPositions = labels.map((element) => [element.style.left, element.style.top, element.style.width, element.style.height]);
      expect(approachingPositions).not.toEqual(initialPositions);
      expect(onSelectOption).toHaveBeenCalledTimes(1);
      expect(onSelectOption).toHaveBeenCalledWith(0, "26", firstMappings[0].gateId, expect.any(Number));
      expect(createMCQ3DScene).toHaveBeenCalledTimes(1);

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
      const scene = vi.mocked(createMCQ3DScene).mock.results[0]?.value;
      const renderSpy = scene!.render as unknown as ReturnType<typeof vi.fn>;
      const secondWaveFrame = renderSpy.mock.calls[renderSpy.mock.calls.length - 1]?.[0] as { gateZs: number[] };
      expect(secondWaveFrame).toBeDefined();
      expect(new Set(secondWaveFrame.gateZs).size).toBe(4);
      expect(Array.from(view.container.querySelectorAll<HTMLElement>(".mcq-game-gate-label"))
        .every((node) => (node.dataset.gateId || "").includes(encodeURIComponent("q-2")))).toBe(true);
      expect(createMCQ3DScene).toHaveBeenCalledTimes(1);

      // Question change invalidates the old pointer/collision identity. A new RIGHT
      // hold steers to lane 2 for the second question through the same WebGL scene.
      const right = screen.getByTestId("mcq-game-steer-right");
      fireEvent.pointerDown(right, { pointerId: 5, pointerType: "touch", button: 0 });
      now = 80;
      // Starting at the left boundary, use a short held correction into lane 2,
      // then release so continuous steering does not carry the car past the target.
      for (let timestamp = 1_200; timestamp <= 1_550; timestamp += 50) raf.advance(timestamp);
      fireEvent.pointerUp(right, { pointerId: 5, pointerType: "touch" });
      for (let timestamp = 1_600; timestamp <= 3_900; timestamp += 50) raf.advance(timestamp);
      const nextMapping = createMCQGateMappings("q-2", secondOptions.map((option) => option.value))[1];
      expect(onSelectOption).toHaveBeenCalledTimes(2);
      expect(onSelectOption.mock.calls[1].slice(0, 3)).toEqual([1, "27", nextMapping.gateId]);
      expect(onSelectOption.mock.calls[1][3]).toEqual(expect.any(Number));
      expect(createMCQ3DScene).toHaveBeenCalledTimes(1);
    } finally {
      fireEvent.pointerCancel(left, { pointerId: 4, pointerType: "touch" });
      fireEvent.pointerCancel(screen.getByTestId("mcq-game-steer-right"), { pointerId: 5, pointerType: "touch" });
      view.unmount();
      raf.restore();
    }
  });

  it("stages answer targets at different depths and consumes missed gates without submitting", () => {
    const raf = installAnimationFrameQueue();
    const onSelectOption = vi.fn();
    const view = render(<MCQWithGame {...gameProps({
      questionKey: "q-depth-wave",
      durationMs: 1_200,
      disabled: true,
      onSelectOption,
    })} />);
    const renderer = vi.mocked(createMCQ3DScene).mock.results[0]?.value.render as unknown as ReturnType<typeof vi.fn>;
    try {
      const initialFrame = renderer.mock.calls[renderer.mock.calls.length - 1]?.[0] as {
        gateZs: number[];
        gateActive: boolean[];
      };
      expect(initialFrame.gateZs).toEqual(createMCQGateApproachStartZs("q-depth-wave"));
      expect(new Set(initialFrame.gateZs).size).toBe(4);
      expect(initialFrame.gateActive).toEqual([true, true, true, true]);

      for (let timestamp = 0; timestamp <= 700; timestamp += 50) raf.advance(timestamp);
      const laterFrame = renderer.mock.calls[renderer.mock.calls.length - 1]?.[0] as {
        gateZs: number[];
        gateActive: boolean[];
      };
      expect(laterFrame.gateZs).not.toEqual(initialFrame.gateZs);
      expect(laterFrame.gateActive.filter(Boolean)).toHaveLength(3);
      expect(onSelectOption).not.toHaveBeenCalled();
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
      expect(renderer.mock.calls.every(([frame]) => Object.keys(frame as object).sort().join(",") === "activeElapsedMs,carX,gateActive,gateZ,gateZs,scrollOffset,steerAngle")).toBe(true);
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

  it("submits each gate at its own configured physical contact time", () => {
    const raf = installAnimationFrameQueue();
    const onSelectOption = vi.fn();
    const questionKey = "q-timed";
    const durationMs = 1_500;
    const gateStartZ = createMCQGateApproachStartZs(questionKey)[1];
    const expectedContactMs = (MCQ_GAME_COLLISION_Z - gateStartZ) / MCQ_GAME_TRAVEL_DISTANCE * durationMs;
    const view = render(<MCQWithGame {...gameProps({ questionKey, durationMs, onSelectOption })} />);
    const scene = vi.mocked(createMCQ3DScene).mock.results[0]?.value;
    const renderer = scene!.render as unknown as ReturnType<typeof vi.fn>;
    try {
      expect(raf.advance(0)).toBe(true);
      const contactFrame = Math.ceil(expectedContactMs / 50) * 50;
      for (let timestamp = 50; timestamp < contactFrame; timestamp += 50) raf.advance(timestamp);
      const beforeContact = renderer.mock.calls[renderer.mock.calls.length - 1]?.[0] as { gateZs: number[] };
      expect(beforeContact.gateZs[1]).toBeLessThan(MCQ_GAME_COLLISION_Z);
      expect(onSelectOption).not.toHaveBeenCalled();

      expect(raf.advance(contactFrame)).toBe(true);
      expect(onSelectOption).toHaveBeenCalledTimes(1);
      expect(onSelectOption.mock.calls[0].slice(0, 3)).toEqual([
        1, "28", createMCQGateMappings(questionKey, options.map((option) => option.value))[1].gateId,
      ]);
      expect(onSelectOption.mock.calls[0][3]).toBeCloseTo(expectedContactMs, 6);
      expect(raf.advance(contactFrame + 50)).toBe(true);
      expect(onSelectOption).toHaveBeenCalledTimes(1);
      expect(view.container.querySelectorAll(".mcq-game-gate-label")).toHaveLength(4);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("uses elapsed time across a dropped frame and still detects the exact swept contact once", () => {
    const raf = installAnimationFrameQueue();
    const onSelectOption = vi.fn();
    const questionKey = "q-dropped-frame";
    const durationMs = 1_000;
    const mappings = createMCQGateMappings(questionKey, options.map((option) => option.value));
    const targetStartZ = createMCQGateApproachStartZs(questionKey)[1];
    const expectedContactMs = (MCQ_GAME_COLLISION_Z - targetStartZ) / MCQ_GAME_TRAVEL_DISTANCE * durationMs;
    const view = render(<MCQWithGame {...gameProps({ questionKey, durationMs, onSelectOption })} />);
    const scene = vi.mocked(createMCQ3DScene).mock.results[0]?.value;
    const renderer = scene!.render as unknown as ReturnType<typeof vi.fn>;

    try {
      expect(raf.advance(0)).toBe(true);
      expect(raf.advance(300)).toBe(true);
      const afterDrop = renderer.mock.calls[renderer.mock.calls.length - 1]?.[0] as { gateZ: number };
      expect(afterDrop.gateZ).toBeCloseTo(MCQ_GAME_GATE_START_Z + MCQ_GAME_TRAVEL_DISTANCE * 0.3, 1);
      expect(onSelectOption).not.toHaveBeenCalled();

      const beforeContact = renderer.mock.calls[renderer.mock.calls.length - 1]?.[0] as { gateZs: number[] };
      expect(beforeContact.gateZs[1]).toBeLessThan(MCQ_GAME_COLLISION_Z);
      expect(onSelectOption).not.toHaveBeenCalled();

      // Deliberately skip the exact contact frame. Swept collision interpolation
      // must still catch the target and preserve its world-plane contact timestamp.
      expect(raf.advance(expectedContactMs + 10)).toBe(true);
      expect(onSelectOption).toHaveBeenCalledTimes(1);
      expect(onSelectOption.mock.calls[0].slice(0, 3)).toEqual([1, "28", mappings[1].gateId]);
      expect(onSelectOption.mock.calls[0][3]).toBeCloseTo(expectedContactMs, 6);
      expect(raf.advance(expectedContactMs + 60)).toBe(true);
      expect(onSelectOption).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      raf.restore();
    }
  });

  it("moves answer targets toward collision faster while the player holds accelerate", () => {
    vi.useFakeTimers();
    const raf = installAnimationFrameQueue();
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const view = render(<MCQWithGame {...gameProps({ questionKey: "q-hold-targets", durationMs: 5_000 })} />);
    const speed = screen.getByTestId("mcq-game-accelerate");
    const scene = vi.mocked(createMCQ3DScene).mock.results[0]?.value;
    const renderer = scene!.render as unknown as ReturnType<typeof vi.fn>;

    try {
      expect(raf.advance(0)).toBe(true);
      fireEvent.pointerDown(speed, { pointerId: 42, pointerType: "touch", button: 0 });
      expect(speed).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("status")).toHaveTextContent("Speed boost active");

      for (let timestamp = 50; timestamp <= 1_000; timestamp += 50) {
        now = timestamp;
        expect(raf.advance(timestamp)).toBe(true);
      }

      const acceleratedFrame = renderer.mock.calls[renderer.mock.calls.length - 1]?.[0] as { gateZ: number };
      const normalSpeedExpected = MCQ_GAME_GATE_START_Z + MCQ_GAME_TRAVEL_DISTANCE * (1_000 / 5_000);
      expect(acceleratedFrame.gateZ).toBeGreaterThan(normalSpeedExpected + 0.25);

      now = 1_050;
      fireEvent.pointerUp(speed, { pointerId: 42, pointerType: "touch" });
      expect(speed).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("status")).toHaveTextContent("Racing");
    } finally {
      fireEvent.pointerCancel(speed, { pointerId: 42, pointerType: "touch" });
      view.unmount();
      raf.restore();
    }
  });

  it("moves targets on elapsed time using the configured duration and does not reset on HUD changes", () => {
    const raf = installAnimationFrameQueue();
    const onSelectOption = vi.fn();
    const view = render(<MCQWithGame {...gameProps({ questionKey: "q-speed", durationMs: 5_000, disabled: true, onSelectOption })} />);
    const scene = vi.mocked(createMCQ3DScene).mock.results[0]?.value;
    const renderer = scene!.render as unknown as ReturnType<typeof vi.fn>;
    try {
      for (let timestamp = 0; timestamp <= 2_500; timestamp += 50) raf.advance(timestamp);
      const halfway = renderer.mock.calls[renderer.mock.calls.length - 1]?.[0] as { gateZ: number };
      expect(halfway.gateZ).toBeCloseTo(MCQ_GAME_GATE_START_Z + MCQ_GAME_TRAVEL_DISTANCE * 0.5, 1);

      view.rerender(<MCQWithGame {...gameProps({
        questionKey: "q-speed",
        durationMs: 5_000,
        timerLabel: "2s",
        disabled: true,
        onSelectOption,
      })} />);
      for (let timestamp = 2_550; timestamp <= 3_000; timestamp += 50) raf.advance(timestamp);
      const sixtyPercent = renderer.mock.calls[renderer.mock.calls.length - 1]?.[0] as { gateZ: number };
      expect(sixtyPercent.gateZ).toBeCloseTo(MCQ_GAME_GATE_START_Z + MCQ_GAME_TRAVEL_DISTANCE * 0.6, 1);
      expect(onSelectOption).not.toHaveBeenCalled();
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
    const right = screen.getByTestId("mcq-game-steer-right");

    try {
      fireEvent.pointerDown(right, { pointerId: 1, pointerType: "touch", button: 0 });
      for (let timestamp = 0; timestamp <= 300; timestamp += 50) raf.advance(timestamp);
      now = 40;
      expect(view.container.querySelector("[data-testid='mcq-game-lane-readout']")).toHaveTextContent("Lane 3");
      fireEvent.pointerUp(right, { pointerId: 1, pointerType: "touch" });

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
