import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SelectField } from "../../src/pages/Register/components/FormFields";

const OPTIONS = ["Texas", "California", "New York"] as const;

describe("SelectField", () => {
  it("opens a themed listbox instead of a native select", async () => {
    render(
      <SelectField
        id="stateOfResidence"
        label="State of residence"
        value=""
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: /State of residence/ }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Texas" })).toBeInTheDocument();
  });

  it("selects an option and closes the menu", async () => {
    function ControlledSelect() {
      const [value, setValue] = useState("");
      return (
        <SelectField
          id="stateOfResidence"
          label="State of residence"
          value={value}
          options={OPTIONS}
          onChange={setValue}
        />
      );
    }

    render(<ControlledSelect />);

    await userEvent.click(screen.getByRole("combobox", { name: /State of residence/ }));
    await userEvent.click(screen.getByRole("button", { name: "California" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /State of residence/ })).toHaveTextContent(
      "California",
    );
  });

  it("closes when clicking outside and only while open", async () => {
    render(
      <SelectField
        id="stateOfResidence"
        label="State of residence"
        value=""
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("combobox", { name: /State of residence/ }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports keyboard navigation and Enter to select", async () => {
    const onChange = vi.fn();
    render(
      <SelectField
        id="stateOfResidence"
        label="State of residence"
        value=""
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: /State of residence/ });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("California");
  });

  it("opens on the current selection and clamps keyboard movement at both ends", async () => {
    const onChange = vi.fn();
    render(
      <SelectField id="state" label="State" value="New York" options={OPTIONS} onChange={onChange} />,
    );
    const trigger = screen.getByRole("combobox", { name: /State/ });
    trigger.focus();

    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("New York");

    await userEvent.keyboard(" ");
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("Texas");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("rotates the chevron while the listbox is open", async () => {
    render(<SelectField id="state" label="State" value="" options={OPTIONS} onChange={vi.fn()} />);
    const trigger = screen.getByRole("combobox", { name: /State/ });
    const chevron = trigger.parentElement?.querySelector("[aria-hidden='true']");

    expect(chevron?.className).not.toContain("rotate-180");
    await userEvent.click(trigger);
    expect(chevron?.className).toContain("rotate-180");
    await userEvent.click(trigger);
    expect(chevron?.className).not.toContain("rotate-180");
  });

  it("toggles closed when the trigger is clicked again and ignores unrelated keys", async () => {
    render(<SelectField id="state" label="State" value="" options={OPTIONS} onChange={vi.fn()} />);
    const trigger = screen.getByRole("combobox", { name: /State/ });
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(trigger, { key: "Tab" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(trigger, { key: "x" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("stays closed and inert when disabled", () => {
    const onChange = vi.fn();
    render(
      <SelectField id="state" label="State" value="" options={OPTIONS} onChange={onChange} disabled />,
    );
    const trigger = screen.getByRole("combobox", { name: /State/ });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("handles an empty option list without selecting anything", async () => {
    const onChange = vi.fn();
    render(<SelectField id="state" label="State" value="" options={[]} onChange={onChange} />);
    const trigger = screen.getByRole("combobox", { name: /State/ });
    trigger.focus();
    await userEvent.keyboard("{Enter}{ArrowDown}{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("wires required, helper, and error descriptions for assistive tech", () => {
    render(
      <SelectField
        id="state"
        label="State"
        value=""
        options={OPTIONS}
        onChange={vi.fn()}
        required
        helperText="Where you live"
        error="Pick one"
      />,
    );
    const trigger = screen.getByRole("combobox", { name: /State/ });
    expect(trigger).toHaveAttribute("aria-required", "true");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-describedby", "state-helper state-error");
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });
});
