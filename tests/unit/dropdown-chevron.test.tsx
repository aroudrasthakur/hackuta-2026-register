import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DropdownChevron } from "../../src/pages/Register/components/DropdownChevron";

describe("DropdownChevron", () => {
  it("points down by default and rotates when active", () => {
    const { container, rerender } = render(<DropdownChevron />);
    const chevron = container.firstElementChild;

    expect(chevron?.className).not.toContain("rotate-180");

    rerender(<DropdownChevron active />);
    expect(chevron?.className).toContain("rotate-180");
  });

  it("supports custom positioning and size", () => {
    const { container } = render(
      <DropdownChevron active className="right-1.5" size={12} />,
    );
    const chevron = container.firstElementChild;

    expect(chevron?.className).toContain("right-1.5");
    expect(chevron?.querySelector("svg")).toHaveAttribute("width", "12");
  });
});
