import { fireEvent, render, screen } from "@testing-library/react";
import BottomNav from "./BottomNav";

vi.mock("@/lib/sound", () => ({ playClick: vi.fn() }));

describe("BottomNav rapid interaction safety", () => {
  const noop = () => {};

  it("renders exactly one navigation surface with three distinct items", () => {
    const { container } = render(
      <BottomNav active="learn" onChange={noop} />,
    );

    expect(container.querySelectorAll('[data-app-floating-nav="true"]')).toHaveLength(1);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Learning" })).toHaveAttribute("aria-current", "page");
  });

  it("does not treat two taps on a newly selected section as a reset gesture", () => {
    const onChange = vi.fn();
    const onDoubleTap = vi.fn();
    const view = render(
      <BottomNav active="learn" onChange={onChange} onDoubleTap={onDoubleTap} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quiz" }));
    view.rerender(
      <BottomNav active="practice" onChange={onChange} onDoubleTap={onDoubleTap} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Quiz" }));

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it("only recognizes consecutive double taps on the already-active section", () => {
    const onChange = vi.fn();
    const onDoubleTap = vi.fn();
    render(
      <BottomNav active="practice" onChange={onChange} onDoubleTap={onDoubleTap} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quiz" }));
    fireEvent.click(screen.getByRole("button", { name: "Quiz" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    expect(onDoubleTap).toHaveBeenCalledWith("practice");
  });

  it("does not retain a per-tab double-tap when another section is tapped between", () => {
    const onChange = vi.fn();
    const onDoubleTap = vi.fn();
    render(
      <BottomNav active="learn" onChange={onChange} onDoubleTap={onDoubleTap} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quiz" }));
    fireEvent.click(screen.getByRole("button", { name: "Progress" }));
    fireEvent.click(screen.getByRole("button", { name: "Quiz" }));

    expect(onDoubleTap).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});
