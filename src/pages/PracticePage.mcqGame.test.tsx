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
  it("records each selected gate immediately and reserves top-right Submit for the complete test", async () => {
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
      const submit = screen.getByTestId("mcq-game-submit");
      expect(submit).toBeDisabled();

      fireEvent.click(options[0] as HTMLButtonElement);
      expect(getProcessedAnswers()).toBe(1);
      fireEvent.click(submit);
      fireEvent.click(submit);
      expect(getProcessedAnswers()).toBe(1);
      expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByLabelText("Question 2 / 10")).toBeInTheDocument();
      });
      expect(getProcessedAnswers()).toBe(1);
      expect(screen.getByTestId("mcq-game-submit")).toBeDisabled();
    } finally {
      view.unmount();
      if (originalRequest) Object.defineProperty(window, "requestAnimationFrame", originalRequest);
      else Reflect.deleteProperty(window, "requestAnimationFrame");
      if (originalCancel) Object.defineProperty(window, "cancelAnimationFrame", originalCancel);
      else Reflect.deleteProperty(window, "cancelAnimationFrame");
    }
  });

  it("waits for whole-test final Submit after the configured questions and finalizes through the existing result flow once", async () => {
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

      for (let question = 1; question <= 10; question += 1) {
        const options = view.container.querySelectorAll(".mcq-game-fallback-option");
        expect(options).toHaveLength(4);
        expect(screen.getByTestId("mcq-game-submit")).toBeDisabled();
        const countBefore = getProcessedAnswers();

        fireEvent.click(options[0] as HTMLButtonElement);
        expect(getProcessedAnswers()).toBe(countBefore + 1);

        if (question < 10) {
          await waitFor(() => {
            expect(screen.getByLabelText(`Question ${question + 1} / 10`)).toBeInTheDocument();
          });
        } else {
          await waitFor(() => {
            expect(screen.getByTestId("mcq-game-submit")).toBeEnabled();
          });
        }
      }

      expect(getProcessedAnswers()).toBe(10);
      expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();

      const finalSubmit = screen.getByTestId("mcq-game-submit");
      fireEvent.click(finalSubmit);
      fireEvent.click(finalSubmit);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
      });
      expect(view.container.textContent).toContain("Attempted");
      expect(view.container.textContent).toContain("10");
    } finally {
      view.unmount();
      if (originalRequest) Object.defineProperty(window, "requestAnimationFrame", originalRequest);
      else Reflect.deleteProperty(window, "requestAnimationFrame");
      if (originalCancel) Object.defineProperty(window, "cancelAnimationFrame", originalCancel);
      else Reflect.deleteProperty(window, "cancelAnimationFrame");
    }
  }, 15000);


});
