import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  CustomCheckbox,
  CustomRadio,
} from "../../src/pages/Register/components/CustomCheckbox";
import {
  customCheckboxBoxClass,
  customControlInputClass,
  customRadioBoxClass,
} from "../../src/pages/Register/components/formFieldStyles";

describe("CustomCheckbox", () => {
  it("toggles checked state when the control is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<CustomCheckbox id="halal" label="Halal" onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Halal" });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not toggle when the caption text is clicked", async () => {
    const user = userEvent.setup();

    render(<CustomCheckbox id="vegan" label="Vegan" />);

    const checkbox = screen.getByRole("checkbox", { name: "Vegan" });
    await user.click(screen.getByText("Vegan"));

    expect(checkbox).not.toBeChecked();
  });

  it("toggles from the keyboard without losing focus", async () => {
    const user = userEvent.setup();

    render(<CustomCheckbox id="kosher" label="Kosher" />);

    const checkbox = screen.getByRole("checkbox", { name: "Kosher" });
    checkbox.focus();
    await user.keyboard(" ");

    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveFocus();

    await user.keyboard(" ");
    expect(checkbox).not.toBeChecked();
  });

  it("does not toggle when disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<CustomCheckbox id="consent" label="I agree" disabled onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "I agree" });
    expect(checkbox).toBeDisabled();

    await user.click(screen.getByText("I agree"));
    expect(checkbox).not.toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses the shared hover, focus-visible, and disabled control styles", () => {
    render(<CustomCheckbox id="styled" label="Styled option" />);

    const checkbox = screen.getByRole("checkbox", { name: "Styled option" });
    expect(checkbox).toHaveClass(customControlInputClass);
    expect(checkbox.nextElementSibling).toHaveClass(customCheckboxBoxClass);
  });
});

describe("CustomRadio", () => {
  it("selects one option in a group", async () => {
    const user = userEvent.setup();

    render(
      <>
        <CustomRadio id="first-yes" name="firstHackathon" label="Yes" value="yes" />
        <CustomRadio id="first-no" name="firstHackathon" label="No" value="no" />
      </>,
    );

    const yes = screen.getByRole("radio", { name: "Yes" });
    const no = screen.getByRole("radio", { name: "No" });

    await user.click(yes);
    expect(yes).toBeChecked();
    expect(no).not.toBeChecked();

    await user.click(no);
    expect(no).toBeChecked();
    expect(yes).not.toBeChecked();
  });

  it("does not select when the caption text is clicked", async () => {
    const user = userEvent.setup();

    render(
      <>
        <CustomRadio id="intl-yes" name="international" label="Yes" value="yes" />
        <CustomRadio id="intl-no" name="international" label="No" value="no" />
      </>,
    );

    await user.click(screen.getByText("No"));

    expect(screen.getByRole("radio", { name: "No" })).not.toBeChecked();
  });

  it("moves selection with arrow keys", async () => {
    const user = userEvent.setup();

    render(
      <>
        <CustomRadio id="arrow-yes" name="international" label="Yes" value="yes" />
        <CustomRadio id="arrow-no" name="international" label="No" value="no" />
      </>,
    );

    const yes = screen.getByRole("radio", { name: "Yes" });
    const no = screen.getByRole("radio", { name: "No" });

    yes.focus();
    await user.keyboard("{ArrowDown}");

    expect(no).toBeChecked();
    expect(yes).not.toBeChecked();
  });

  it("does not change when disabled", async () => {
    const user = userEvent.setup();

    render(
      <CustomRadio id="disabled-yes" name="disabled-group" label="Yes" value="yes" disabled />,
    );

    const radio = screen.getByRole("radio", { name: "Yes" });
    await user.click(screen.getByText("Yes"));

    expect(radio).not.toBeChecked();
    expect(radio).toBeDisabled();
  });

  it("uses the shared hover, focus-visible, and disabled control styles", () => {
    render(<CustomRadio id="styled-yes" name="styled" label="Yes" value="yes" />);

    const radio = screen.getByRole("radio", { name: "Yes" });
    expect(radio).toHaveClass(customControlInputClass);
    expect(radio.nextElementSibling).toHaveClass(customRadioBoxClass);
  });
});
