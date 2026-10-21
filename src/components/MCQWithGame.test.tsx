import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MCQWithGame from "@/components/MCQWithGame";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

describe("MCQ with Game collision submission", () => {
  it("steers one lane per tap and submits exactly the displayed lane once at collision", () => {
    const raf = installAnimationFrameQueue();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const onCollision = vi.fn();
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
      expect(screen.getByText("Lane 1 · A")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Steer left" }));
      expect(screen.getByText("Lane 1 · A")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Steer right" }));
      expect(screen.getByText("Lane 2 · B")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Steer right" }));
      expect(screen.getByText("Lane 3 · C")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Steer right" }));
      fireEvent.click(screen.getByRole("button", { name: "Steer right" }));
      expect(screen.getByText("Lane 4 · D")).toBeInTheDocument();

      for (let timestamp = 0; timestamp <= 1_300; timestamp += 50) {
        raf.advance(timestamp);
      }

      expect(onCollision).toHaveBeenCalledTimes(1);
      expect(onCollision).toHaveBeenCalledWith(3);

      fireEvent.click(screen.getByRole("button", { name: "Steer left" }));
      for (let timestamp = 1_350; timestamp <= 1_600; timestamp += 50) {
        raf.advance(timestamp);
      }
      expect(onCollision).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status")).toHaveTextContent("Answer submitted");
    } finally {
      view.unmount();
      raf.restore();
    }
  });
});
