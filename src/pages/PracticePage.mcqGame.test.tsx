import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PracticePage from "@/pages/PracticePage";

afterEach(cleanup);

describe("Quiz Arena MCQ with Game mode", () => {
  it("offers the third answer mode and opens the real quiz question on four answer lanes", () => {
    const view = render(<PracticePage />);

    try {
      const gameMode = screen.getByRole("button", { name: "MCQ with Game" });
      expect(gameMode).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(gameMode);
      expect(gameMode).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(screen.getByRole("button", { name: "Start Quiz" }));

      expect(screen.getByRole("group", { name: /Four answer lanes/ })).toBeInTheDocument();
      expect(view.container.querySelectorAll(".mcq-game-gate")).toHaveLength(4);
      expect(screen.getByTestId("quiz-overall-progress")).toBeInTheDocument();
    } finally {
      view.unmount();
    }
  });
});
