import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextAreaField } from "../../src/pages/Register/components/FormFields";

describe("TextAreaField", () => {
  it("shows required labels, helper text, and validation errors", () => {
    render(
      <TextAreaField
        id="builtOrWantToBuild"
        label="Tell us about something you have built or something you want to build"
        required
        rows={4}
        value="Built a weather app"
        helperText="Up to 2,000 characters."
        error="Tell us about something you have built or something you want to build."
      />,
    );

    expect(
      screen.getByLabelText(/Tell us about something you have built or something you want to build/),
    ).toBeRequired();
    expect(screen.getByText("Up to 2,000 characters.")).toBeInTheDocument();
    expect(
      screen.getByText("Tell us about something you have built or something you want to build."),
    ).toBeInTheDocument();
  });
});
