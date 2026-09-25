import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CountryCode } from "libphonenumber-js/max";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PhoneField } from "../../src/pages/Register/components/PhoneField";

function renderPhoneField(
  props: Partial<Parameters<typeof PhoneField>[0]> = {},
) {
  const onChange = props.onChange ?? vi.fn();
  render(
    <PhoneField
      id="phone"
      label="Phone number"
      value=""
      country=""
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

describe("PhoneField", () => {
  it("defaults the country selector to US with a compact +code label", () => {
    renderPhoneField();

    const countrySelect = screen.getByLabelText("Applicant calling code");
    expect(countrySelect).toHaveValue("US");
    expect(screen.getByRole("option", { name: "+1 US" })).toBeInTheDocument();
    expect(countrySelect.querySelector("option")?.textContent).toBe("+1 US");
  });

  it("accepts digits-only input and caps at 15 digits", async () => {
    function ControlledPhoneField() {
      const [value, setValue] = useState("");
      const [country, setCountry] = useState<CountryCode | "">("");
      return (
        <PhoneField
          id="phone"
          label="Phone number"
          value={value}
          country={country}
          onChange={(next, nextCountry) => {
            setValue(next);
            setCountry(nextCountry);
          }}
        />
      );
    }

    render(<ControlledPhoneField />);

    const input = screen.getByLabelText(/Phone number/);
    await userEvent.type(input, "2025550123");
    expect(input).toHaveValue("2025550123");

    fireEvent.change(input, { target: { value: "abc202!555@0123" } });
    expect(input).toHaveValue("2025550123");

    fireEvent.change(input, { target: { value: "123456789012345678" } });
    expect(input).toHaveValue("123456789012345");
  });

  it("displays legacy formatted stored values as digits", () => {
    renderPhoneField({ value: "(202) 555-0123" });
    expect(screen.getByLabelText(/Phone number/)).toHaveValue("2025550123");
  });

  it("updates the country without changing the phone digits", () => {
    const onChange = vi.fn();
    renderPhoneField({ value: "2025550123", country: "US", onChange });

    fireEvent.change(screen.getByLabelText("Applicant calling code"), {
      target: { value: "CA" },
    });

    expect(onChange).toHaveBeenCalledWith("2025550123", "CA");
  });

  it("rotates the country chevron while the selector is focused", () => {
    renderPhoneField();

    const countrySelect = screen.getByLabelText("Applicant calling code");
    const chevron = countrySelect.parentElement?.querySelector("[aria-hidden='true']");

    expect(chevron?.className).not.toContain("rotate-180");
    fireEvent.focus(countrySelect);
    expect(chevron?.className).toContain("rotate-180");
    fireEvent.blur(countrySelect);
    expect(chevron?.className).not.toContain("rotate-180");
  });

  it("uses numeric input hints for mobile keyboards", () => {
    renderPhoneField();
    const input = screen.getByLabelText(/Phone number/);
    expect(input).toHaveAttribute("inputMode", "numeric");
    expect(input).toHaveAttribute("pattern", "[0-9]*");
  });

  it("shows validation errors", () => {
    renderPhoneField({ error: "Enter a valid phone number." });
    expect(screen.getByText("Enter a valid phone number.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone number/)).toHaveAttribute("aria-invalid", "true");
  });

  it("labels the emergency contact country selector distinctly", () => {
    render(
      <PhoneField
        id="emergencyContactPhone"
        label="Emergency contact phone"
        value=""
        country=""
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Emergency contact calling code")).toBeInTheDocument();
  });

  it("keeps controlled phone digits in sync when the parent value changes", () => {
    function ControlledPhoneField() {
      const [value, setValue] = useState("(202) 555-0123");
      return (
        <PhoneField
          id="phone"
          label="Phone number"
          value={value}
          country="US"
          onChange={(next) => setValue(next)}
        />
      );
    }

    render(<ControlledPhoneField />);
    const input = screen.getByLabelText(/Phone number/);
    expect(input).toHaveValue("2025550123");

    fireEvent.change(input, { target: { value: "5551234567" } });
    expect(input).toHaveValue("5551234567");
  });
});
