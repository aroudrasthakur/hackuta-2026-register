import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { SearchableSelect } from "../../src/pages/Register/components/SearchableSelect";

const OPTIONS = [
  "Alpha University",
  "Beta College",
  "Gamma Institute",
] as const;

const FEATURED = ["Alpha University", "Beta College"] as const;

function renderSelect(
  props: Partial<ComponentProps<typeof SearchableSelect>> = {},
) {
  const onChange = props.onChange ?? vi.fn();
  render(
    <SearchableSelect
      id="school"
      label="School / university"
      value=""
      options={OPTIONS}
      featuredOptions={FEATURED}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

describe("SearchableSelect", () => {
  it("shows the selected value when the list is closed", () => {
    renderSelect({ value: "Alpha University" });
    expect(screen.getByRole("combobox")).toHaveValue("Alpha University");
  });

  it("shows featured options when focused with an empty query", async () => {
    renderSelect();
    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Alpha University" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Beta College" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Gamma Institute" })).not.toBeInTheDocument();
  });

  it("filters options as the user types", async () => {
    renderSelect();
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.type(input, "gamma");

    expect(screen.getByRole("option", { name: "Gamma Institute" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alpha University" })).not.toBeInTheDocument();
  });

  it("selects an option from the list", async () => {
    const onChange = vi.fn();
    renderSelect({ onChange });
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("button", { name: "Beta College" }));

    expect(onChange).toHaveBeenCalledWith("Beta College");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clears the value when the search query is emptied", async () => {
    const onChange = vi.fn();
    renderSelect({ onChange, value: "Alpha University" });
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.clear(input);

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("opens the list with ArrowDown when closed", async () => {
    renderSelect();
    const input = screen.getByRole("combobox");
    input.focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("opens the list with Enter when closed", () => {
    renderSelect();
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("navigates options with arrow keys and selects with Enter", async () => {
    const onChange = vi.fn();
    renderSelect({ onChange });
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("Beta College");
  });

  it("moves the active option up with ArrowUp", async () => {
    renderSelect();
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}");

    const activeButton = screen.getByRole("button", { name: "Alpha University" });
    expect(activeButton.className).toContain("bg-(--clay)");
  });

  it("closes the list on Escape", async () => {
    renderSelect();
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes the list when clicking outside", async () => {
    renderSelect();
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows required and error states", () => {
    renderSelect({ required: true, error: "Pick a school" });

    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Pick a school")).toBeInTheDocument();
  });

  it("falls back to the first options slice without featured options", async () => {
    render(
      <SearchableSelect
        id="school"
        label="School / university"
        value=""
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "Alpha University" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Gamma Institute" })).toBeInTheDocument();
  });
});
