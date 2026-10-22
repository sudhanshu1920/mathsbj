import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("routes Submit through the existing quiz engine and advances exactly once", async () => {
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

    const getProcessedAnswers = () => {
      const correct = Number(view.container.querySelector(".mcq-game-topbar-stat--correct span")?.textContent ?? 0);
      const wrong = Number(view.container.querySelector(".mcq-game-topbar-stat--wrong span")?.textContent ?? 0);
      return correct + wrong;
    };

    try {
      fireEvent.click(screen.getByRole("button", { name: "MCQ with Game" }));
      fireEvent.click(screen.getByRole("button", { name: "Start Quiz" }));

      const options = view.container.querySelectorAll(".mcq-game-fallback-option");
      expect(options).toHaveLength(4);
      fireEvent.click(options[0] as HTMLButtonElement);

      const submit = screen.getByTestId("mcq-game-submit");
      expect(submit).toBeEnabled();
      expect(getProcessedAnswers()).toBe(0);

      fireEvent.click(submit);
      fireEvent.click(submit);

      expect(getProcessedAnswers()).toBe(1);
      await waitFor(() => {
        expect(screen.getByLabelText("Question 2 / 10")).toBeInTheDocument();
      });
      expect(getProcessedAnswers()).toBe(1);
    } finally {
      view.unmount();
      if (originalRequest) Object.defineProperty(window, "requestAnimationFrame", originalRequest);
      else Reflect.deleteProperty(window, "requestAnimationFrame");
      if (originalCancel) Object.defineProperty(window, "cancelAnimationFrame", originalCancel);
      else Reflect.deleteProperty(window, "cancelAnimationFrame");
    }
  });


});
