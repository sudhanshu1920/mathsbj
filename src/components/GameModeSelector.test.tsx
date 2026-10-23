import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GameModeSelector from "@/components/GameModeSelector";

afterEach(cleanup);

describe("MCQ with Game selector", () => {
  it("shows the existing racing and jump games plus Space Shooter", () => {
    render(<GameModeSelector selectedGame="car" onBack={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /3D Math Car Racing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2D Math Jump Adventure/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Math Space Shooter/i })).toBeInTheDocument();
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

  it("returns to answer-mode setup without starting a game when Back is selected", () => {
    const onBack = vi.fn();
    render(<GameModeSelector selectedGame="car" onBack={onBack} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Back to Answer Mode" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
