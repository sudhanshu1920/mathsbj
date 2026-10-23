import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GameModeSelector from "@/components/GameModeSelector";

afterEach(cleanup);

describe("MCQ with Game selector", () => {
  it("shows the existing racing and jump games plus Space Shooter", () => {
    render(<GameModeSelector selectedGame="car" onBack={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /3D Car Racing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2D Jump Adventure/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Space Shooter/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button").filter((button) =>
      /3D Math Car Racing|2D Math Jump Adventure|Math Space Shooter/.test(button.getAttribute("aria-label") || ""),
    )).toHaveLength(3);
  });

  it("routes a selected game through one guarded action", () => {
    const onSelect = vi.fn();
    render(<GameModeSelector selectedGame="car" onBack={vi.fn()} onSelect={onSelect} />);
    const jump = screen.getByRole("button", { name: /2D Math Jump Adventure/i });
    fireEvent.click(jump);
    fireEvent.click(jump);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("jump");
  });

  it("routes Space Shooter through the same guarded selector action", () => {
    const onSelect = vi.fn();
    render(<GameModeSelector selectedGame="car" onBack={vi.fn()} onSelect={onSelect} />);
    const shooter = screen.getByRole("button", { name: /Math Space Shooter/i });
    fireEvent.click(shooter);
    fireEvent.click(shooter);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("shooter");
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
    expect(screen.getByRole("dialog", { name: "Choose a quiz game" })).toBeInTheDocument();

    const jump = screen.getByRole("button", { name: /2D Jump Adventure/i });
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

  it("returns to answer-mode setup without starting a game when Back is selected", () => {
    const onBack = vi.fn();
    render(<GameModeSelector selectedGame="car" onBack={onBack} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Back to Answer Mode" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
