import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThemeOptionsGrid from "./ThemeOptionsGrid";
import { setTheme } from "@/lib/theme";

describe("shared ThemeOptionsGrid", () => {
  beforeEach(() => {
    setTheme("arctic-blue");
  });

  afterEach(() => {
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

  it("keeps the Dashboard popup sizing while making the Settings grid denser", () => {
    const { container } = render(
      <>
        <ThemeOptionsGrid variant="popup" />
        <ThemeOptionsGrid variant="settings" />
      </>,
    );

    const popupGrid = container.querySelector('[data-theme-selector-grid="popup"]');
    const settingsGrid = container.querySelector('[data-theme-selector-grid="settings"]');
    expect(popupGrid).toHaveClass("h-[156px]", "auto-cols-[60px]");
    expect(settingsGrid).toHaveClass("grid-cols-4", "min-[480px]:grid-cols-5", "min-[768px]:grid-cols-6", "min-[1024px]:grid-cols-7");
    expect(settingsGrid?.querySelector('[data-theme-option="arctic-blue"]')).toHaveClass("h-10");
    expect(settingsGrid?.querySelector('[data-theme-option="arctic-blue"] [data-theme-swatch]')).toHaveClass("h-3.5", "w-6");
    expect(popupGrid?.querySelector('[data-theme-option="arctic-blue"] [data-theme-swatch]')).toHaveClass("h-5", "w-8");
  });
});
