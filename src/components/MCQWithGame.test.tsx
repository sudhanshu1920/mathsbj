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
  vi.restoreAllMocks();
  vi.mocked(createMCQ3DScene).mockReset();
});

beforeEach(() => {
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

describe("MCQ with Game 3D gate collision submission", () => {
  it("steers the 3D car and submits exactly the collided gate's displayed option once", () => {
    const raf = installAnimationFrameQueue();
    const onCollision = vi.fn();
    const mappings = createMCQGateMappings("q-1", options.map((option) => option.value));
    const view = render(
      <MCQWithGame
        questionKey="q-1"
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
      const road = screen.getByRole("group", { name: /Four answer lanes/ });
      expect(road).toHaveAttribute("data-swipe-ignore-back", "true");
      expect(view.container.querySelectorAll(".mcq-game-gate-label")).toHaveLength(4);
      expect(screen.getByText("Lane 2 · B")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Steer right" }));
      expect(screen.getByText("Lane 3 · C")).toBeInTheDocument();

      for (let timestamp = 0; timestamp <= 1_250; timestamp += 50) {
        raf.advance(timestamp);
      }

      expect(onCollision).toHaveBeenCalledTimes(1);
      expect(onCollision).toHaveBeenCalledWith(2, "22", mappings[2].gateId);

      fireEvent.click(screen.getByRole("button", { name: "Steer left" }));
      for (let timestamp = 1_300; timestamp <= 1_600; timestamp += 50) {
        raf.advance(timestamp);
      }
      expect(onCollision).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status")).toHaveTextContent("Gate collision detected");
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

    render(
      <MCQWithGame
        questionKey="fallback-q"
        options={options}
        correctAnswer="28"
        feedback={null}
        selectedOption={null}
        correctScore={0}
        wrongScore={0}
        durationMs={4_800}
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
