import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import MCQJumpAdventure from "@/components/MCQJumpAdventure";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const options = [
  { value: "26", label: "26" },
  { value: "28", label: "28" },
  { value: "22", label: "22" },
  { value: "33", label: "33" },
];

function props(overrides: Partial<ComponentProps<typeof MCQJumpAdventure>> = {}) {
  return {
    questionKey: "question-1",
    questionLabel: <p>14 × 2 = ?</p>,
    options,
    correctAnswer: "28",
    feedback: null,
    selectedOption: null,
    correctScore: 0,
    wrongScore: 0,
    progressLabel: "1 / 10",
    finalSubmitReady: false,
    canFinalizeTest: false,
    onSelectOption: vi.fn(() => true),
    onFinalSubmit: vi.fn(),
    ...overrides,
  };
}

describe("2D Math Jump Adventure UI", () => {
  it("renders movement and jump controls with explicit answer tiles", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<MCQJumpAdventure {...props()} />);
    expect(screen.getByRole("button", { name: "Move left" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move right" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jump" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Choose your answer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Answer 28" })).toBeInTheDocument();
  });

  it("submits a chosen answer exactly once per question through the supplied quiz callback", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const onSelectOption = vi.fn(() => true);
    render(<MCQJumpAdventure {...props({ onSelectOption })} />);
    const answer = screen.getByRole("button", { name: "Answer 28" });
    fireEvent.click(answer);
    fireEvent.click(answer);
    expect(onSelectOption).toHaveBeenCalledTimes(1);
    expect(onSelectOption).toHaveBeenCalledWith(1, "28", expect.stringContaining("question-1"));
  });

  it("uses the top Submit only for finalizing the complete test", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const onFinalSubmit = vi.fn();
    render(<MCQJumpAdventure {...props({ canFinalizeTest: true, onFinalSubmit })} />);
    const submit = screen.getByTestId("mcq-jump-submit");
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(onFinalSubmit).toHaveBeenCalledTimes(1);
  });
});
