import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PracticePage from "@/pages/PracticePage";

vi.mock("@/lib/mcq3dRenderer", () => ({
  createMCQ3DScene: () => {
    throw new Error("WebGL unavailable in jsdom test environment");
  },
}));

afterEach(cleanup);

describe("Quiz Arena MCQ with Game mode", () => {
  it("offers the third answer mode and opens four live answers on the game screen", () => {
    const originalRequest = Object.getOwnPropertyDescriptor(window, "requestAnimationFrame");
    const originalCancel = Object.getOwnPropertyDescriptor(window, "cancelAnimationFrame");
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: () => 1,
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: () => {},
    });
    const view = render(<PracticePage />);

    try {
      const gameMode = screen.getByRole("button", { name: "MCQ with Game" });
      expect(gameMode).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(gameMode);
      expect(gameMode).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(screen.getByRole("button", { name: "Start Quiz" }));

      expect(screen.getByRole("group", { name: /Four answer lanes/ })).toBeInTheDocument();
      expect(
        view.container.querySelectorAll(".mcq-game-fallback-option, .mcq-game-gate-label"),
      ).toHaveLength(4);
      expect(screen.getByTestId("quiz-overall-progress")).toBeInTheDocument();
      expect(view.container.querySelectorAll(".quiz-question-panel")).toHaveLength(0);
      expect(view.container.querySelectorAll(".mcq-game-question-panel")).toHaveLength(1);
      expect(view.container.querySelectorAll(".mcq-game-controls")).toHaveLength(0);
    } finally {
      view.unmount();
      if (originalRequest) Object.defineProperty(window, "requestAnimationFrame", originalRequest);
      else Reflect.deleteProperty(window, "requestAnimationFrame");
      if (originalCancel) Object.defineProperty(window, "cancelAnimationFrame", originalCancel);
      else Reflect.deleteProperty(window, "cancelAnimationFrame");
    }
  });
});
