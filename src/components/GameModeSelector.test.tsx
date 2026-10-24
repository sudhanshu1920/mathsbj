import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GameModeSelector from "@/components/GameModeSelector";

afterEach(cleanup);

describe("MCQ with Game selector", () => {
  it("shows the existing games plus Math Slice Ninja", () => {
    render(<GameModeSelector selectedGame="car" onBack={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /3D Car Racing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Jump Adventure/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Space Shooter/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Math Slice Ninja/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button").filter((button) =>
      /3D Car Racing|2D Jump Adventure|Space Shooter|Math Slice Ninja/.test(button.getAttribute("aria-label") || ""),
    )).toHaveLength(4);
  });

  it("renders a compact modal with only four game names and functional actions", () => {
    render(<GameModeSelector selectedGame="car" variant="modal" onBack={vi.fn()} onSelect={vi.fn()} onStart={vi.fn(() => true)} />);
    expect(screen.getByRole("dialog", { name: "Choose Your Game" })).toBeInTheDocument();
    for (const name of ["Car Racing", "Jump Adventure", "Space Shooter", "Math Slice Ninja"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.queryByText(/Race and solve|Jump and answer|Aim, shoot and solve|Swipe\. Slice\. Solve|Choose Your Game|MATH ARCADE|SELECT ONE TO CONTINUE/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Cancel game selection" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Quiz" })).toBeDisabled();
  });

  it("shows the matching icon before each game name in the compact popup", () => {
    render(
      <GameModeSelector
        selectedGame="car"
        variant="modal"
        onBack={vi.fn()}
        onSelect={vi.fn()}
        onStart={vi.fn(() => true)}
      />,
    );

    const expectedIcons = [
      ["select-car-racing", "lucide-car-front"],
      ["select-jump-adventure", "lucide-mountain"],
      ["select-space-shooter", "lucide-rocket"],
      ["select-math-slice-ninja", "lucide-scissors"],
    ] as const;

    for (const [testId, iconClass] of expectedIcons) {
      const option = screen.getByTestId(testId);
      const icon = option.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass(iconClass);
      expect(option.querySelector("svg")?.compareDocumentPosition(option.querySelector(".mcq-game-select-card-title")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("routes a selected game through one guarded action", () => {
    const onSelect = vi.fn();
    render(<GameModeSelector selectedGame="car" onBack={vi.fn()} onSelect={onSelect} />);
    const jump = screen.getByRole("button", { name: /Jump Adventure/i });
    fireEvent.click(jump);
    fireEvent.click(jump);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("jump");
  });

  it("routes Space Shooter through the same guarded selector action", () => {
    const onSelect = vi.fn();
    render(<GameModeSelector selectedGame="car" onBack={vi.fn()} onSelect={onSelect} />);
    const shooter = screen.getByRole("button", { name: /Space Shooter/i });
    fireEvent.click(shooter);
    fireEvent.click(shooter);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("shooter");
  });


  it("selects Math Slice Ninja without launching until Start Quiz", () => {
    const onSelect = vi.fn();
    const onStart = vi.fn(() => true);
    render(<GameModeSelector selectedGame="car" variant="modal" onBack={vi.fn()} onSelect={onSelect} onStart={onStart} />);
    const card = screen.getByRole("button", { name: /Math Slice Ninja/i });
    fireEvent.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("slice");
    expect(onStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("start-selected-game"));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith("slice");
  });

  it("requires an explicit choice and launches only from Start Quiz in the compact popup", () => {
    const onSelect = vi.fn();
    const onStart = vi.fn(() => true);
    render(
      <GameModeSelector
        selectedGame="car"
        variant="modal"
        canStartQuiz
        onBack={vi.fn()}
        onSelect={onSelect}
        onStart={onStart}
      />,
    );

    const start = screen.getByTestId("start-selected-game");
    expect(start).toBeDisabled();
    expect(screen.getByRole("dialog", { name: "Choose Your Game" })).toBeInTheDocument();

    const jump = screen.getByRole("button", { name: /Jump Adventure/i });
    fireEvent.click(jump);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("jump");
    expect(start).toBeEnabled();
    expect(screen.getByTestId("mcq-game-selector")).toBeInTheDocument();
    expect(onStart).not.toHaveBeenCalled();

    fireEvent.click(start);
    fireEvent.click(start);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith("jump");
  });

  it("keeps Start Quiz disabled until a game is selected and setup is valid", () => {
    render(
      <GameModeSelector
        selectedGame="car"
        variant="modal"
        canStartQuiz={false}
        onBack={vi.fn()}
        onSelect={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    const start = screen.getByTestId("start-selected-game");
    expect(start).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Space Shooter/i }));
    expect(start).toBeDisabled();
  });

  it("keeps the explicit game selection when the app theme class changes", () => {
    const originalClassName = document.documentElement.className;
    try {
      const onSelect = vi.fn();
      render(
        <GameModeSelector
          selectedGame="car"
          variant="modal"
          onBack={vi.fn()}
          onSelect={onSelect}
          onStart={vi.fn(() => true)}
        />,
      );

      const jump = screen.getByRole("button", { name: "Jump Adventure" });
      fireEvent.click(jump);
      expect(jump).toHaveAttribute("aria-pressed", "true");

      document.documentElement.classList.add("light");
      expect(jump).toHaveAttribute("aria-pressed", "true");
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
      expect(jump).toHaveAttribute("aria-pressed", "true");
      expect(onSelect).toHaveBeenCalledTimes(1);
    } finally {
      document.documentElement.className = originalClassName;
    }
  });

  it("returns to answer-mode setup without starting a game when Back is selected", () => {
    const onBack = vi.fn();
    render(<GameModeSelector selectedGame="car" onBack={onBack} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Back to Answer Mode" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
