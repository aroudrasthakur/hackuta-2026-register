import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  GENDER_SELF_DESCRIBE_OPTION,
  GENDERS,
  SCHOOL_OTHER_OPTION,
} from "../../shared/registration/constants";
import { SelectWithOther } from "../../src/pages/Register/components/SelectWithOther";

describe("SelectWithOther", () => {
  it("does not show the follow-up text field until Other is selected", () => {
    render(
      <SelectWithOther
        id="gender"
        otherId="otherGender"
        variant="listbox"
        label="Gender"
        value="Man"
        otherValue=""
        options={GENDERS}
        otherOption={GENDER_SELF_DESCRIBE_OPTION}
        otherPlaceholder="Describe your gender"
        onValueChange={vi.fn()}
        onOtherValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: /Gender/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Describe your gender")).not.toBeInTheDocument();
  });

  it("pins the Other option first in listbox dropdowns", async () => {
    render(
      <SelectWithOther
        id="gender"
        otherId="otherGender"
        variant="listbox"
        label="Gender"
        value=""
        otherValue=""
        options={GENDERS}
        otherOption={GENDER_SELF_DESCRIBE_OPTION}
        otherPlaceholder="Describe your gender"
        onValueChange={vi.fn()}
        onOtherValueChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: /Gender/ }));
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAccessibleName(GENDER_SELF_DESCRIBE_OPTION);
  });

  it("shows a searchable follow-up field while keeping the combobox visible", async () => {
    const onValueChange = vi.fn();

    render(
      <SelectWithOther
        id="school"
        otherId="otherSchool"
        variant="searchable"
        label="School / university"
        value={SCHOOL_OTHER_OPTION}
        otherValue=""
        options={["Alpha University"]}
        otherOption="Other (Please Specify)"
        otherPlaceholder="Enter your school / university"
        onValueChange={onValueChange}
        onOtherValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: /School \/ university/ })).toBeInTheDocument();
    expect(
      screen.getByLabelText("Enter your school / university"),
    ).toBeInTheDocument();
  });

  it("forwards other text edits to onOtherValueChange", () => {
    const onOtherValueChange = vi.fn();

    render(
      <SelectWithOther
        id="gender"
        otherId="otherGender"
        variant="listbox"
        label="Gender"
        value={GENDER_SELF_DESCRIBE_OPTION}
        otherValue=""
        options={GENDERS}
        otherOption={GENDER_SELF_DESCRIBE_OPTION}
        otherPlaceholder="Describe your gender"
        onValueChange={vi.fn()}
        onOtherValueChange={onOtherValueChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Describe your gender"), {
      target: { value: "Genderfluid" },
    });

    expect(onOtherValueChange).toHaveBeenCalledWith("Genderfluid");
  });

  it("calls onValueChange when Other is selected from a listbox", async () => {
    const onValueChange = vi.fn();
    const onOtherValueChange = vi.fn();

    render(
      <SelectWithOther
        id="major"
        otherId="otherMajor"
        variant="listbox"
        label="Major / field of study"
        required
        value=""
        otherValue=""
        options={["Computer science, computer engineering, or software engineering", "Other (please specify)"]}
        otherOption="Other (please specify)"
        otherPlaceholder="Describe your major / field of study"
        onValueChange={onValueChange}
        onOtherValueChange={onOtherValueChange}
      />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: /Major \/ field of study/ }));
    await userEvent.click(screen.getByRole("button", { name: "Other (please specify)" }));

    expect(onValueChange).toHaveBeenCalledWith("Other (please specify)");
  });

  it("keeps the picker visible and shows the text field when Other is selected", () => {
    render(
      <SelectWithOther
        id="major"
        otherId="otherMajor"
        variant="listbox"
        label="Major / field of study"
        value="Other (please specify)"
        otherValue="Space Law"
        options={["Other (please specify)"]}
        otherOption="Other (please specify)"
        otherPlaceholder="Describe your major / field of study"
        onValueChange={vi.fn()}
        onOtherValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: /Major \/ field of study/ })).toBeInTheDocument();
    expect(
      screen.getByLabelText("Describe your major / field of study"),
    ).toHaveValue("Space Law");
  });

  it("clears the other value when switching away from Other", async () => {
    const onValueChange = vi.fn();
    const onOtherValueChange = vi.fn();

    render(
      <SelectWithOther
        id="major"
        otherId="otherMajor"
        variant="listbox"
        label="Major / field of study"
        value="Other (please specify)"
        otherValue="Space Law"
        options={["Computer science, computer engineering, or software engineering", "Other (please specify)"]}
        otherOption="Other (please specify)"
        otherPlaceholder="Describe your major / field of study"
        onValueChange={onValueChange}
        onOtherValueChange={onOtherValueChange}
      />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: /Major \/ field of study/ }));
    await userEvent.click(
      screen.getByRole("button", {
        name: "Computer science, computer engineering, or software engineering",
      }),
    );

    expect(onOtherValueChange).toHaveBeenCalledWith("");
    expect(onValueChange).toHaveBeenCalledWith(
      "Computer science, computer engineering, or software engineering",
    );
  });
});
