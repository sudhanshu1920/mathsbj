import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ThemeOptionsGrid from "./ThemeOptionsGrid";
import { setTheme, type ThemeId } from "@/lib/theme";

describe("shared ThemeOptionsGrid", () => {
  beforeEach(() => {
    setTheme("arctic-blue");
  });

  it("keeps popup and Settings cards synchronized through the shared theme store", () => {
    const onPopupSelect = vi.fn();
    const { container } = render(
      <>
        <ThemeOptionsGrid variant="popup" onSelect={onPopupSelect} />
        <ThemeOptionsGrid variant="settings" />
      </>,
    );

    expect(screen.getByRole("button", { name: "Use Arctic Blue theme" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Select Arctic Blue theme" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Use Mint theme" }));

    expect(onPopupSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Use Mint theme" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Select Mint theme" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Select Soft Rose theme" }));

    expect(onPopupSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Use Soft Rose theme" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Select Soft Rose theme" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll("[data-theme-selected-indicator]")).toHaveLength(2);
  });

  it("uses the same three-colour preview in both compact and Settings variants", () => {
    const { container } = render(
      <>
        <ThemeOptionsGrid variant="popup" />
        <ThemeOptionsGrid variant="settings" />
      </>,
    );

    const previews = container.querySelectorAll('[data-theme-option="arctic-blue"] [data-theme-swatch]');
    expect(previews).toHaveLength(2);

    for (const preview of previews) {
      expect(preview.querySelectorAll(":scope > span")).toHaveLength(3);
      expect(preview).toHaveClass("h-5", "w-8");
    }
  });
});
