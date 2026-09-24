import { describe, expect, it, vi } from "vitest";
import { registrationPayloadSchema } from "../../shared/registration/schema";
import { INITIAL_FORM } from "../../shared/registration/types";
import {
  focusFirstInvalidField,
  toggleValue,
  validateApplicationForm,
  validateRegistrationPayload,
} from "../../shared/registration/validation";
import { validRegistrationForm } from "../fixtures/validRegistrationForm";

function validPayloadFromForm() {
  const result = validateApplicationForm(validRegistrationForm());
  if (!result.success) {
    throw new Error("Test setup failed: valid form did not validate");
  }

  return result.payload;
}

describe("validateApplicationForm", () => {
  it.each([
    new File(["text"], "resume.txt", { type: "text/plain" }),
    new File([], "resume.pdf", { type: "application/pdf" }),
    new File(["x".repeat(2 * 1024 * 1024 + 1)], "resume.pdf", { type: "application/pdf" }),
  ])("blocks submission of invalid resume files", (resume) => {
    const result = validateApplicationForm({ ...validRegistrationForm(), resume });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.resume).toBeTruthy();
  });

  it("rejects an empty form with field errors", () => {
    const result = validateApplicationForm(INITIAL_FORM);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.firstName).toBe("First name is required.");
      expect(result.errors.codeOfConductAgreed).toBeTruthy();
    }
  });

  it("accepts a valid form and trims whitespace", () => {
    const form = validRegistrationForm();
    form.firstName = "  Sam  ";
    form.lastName = "  Test  ";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload.firstName).toBe("Sam");
      expect(result.payload.lastName).toBe("Test");
    }
  });

  it("rejects invalid age values", () => {
    const form = validRegistrationForm();
    form.age = "-500";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
  });

  it("rejects invalid graduation years", () => {
    const form = validRegistrationForm();
    form.graduationYear = "9000";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
  });

  it("requires country of residence with a friendly message", () => {
    const form = validRegistrationForm();
    form.countryOfResidence = "";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.countryOfResidence).toBe(
        "Please select your country of residence.",
      );
    }
  });

  it("rejects schools that are not on the MLH list", () => {
    const form = validRegistrationForm();
    form.school = "UT Arlington" as typeof form.school;

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.school).toContain("school");
    }
  });

  it("accepts a custom school when Other is selected", () => {
    const form = validRegistrationForm();
    form.school = "Other:";
    form.otherSchool = "My Local Community College";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload.school).toBe("My Local Community College");
    }
  });

  it("requires a school name when Other is selected", () => {
    const form = validRegistrationForm();
    form.school = "Other:";
    form.otherSchool = "";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.otherSchool).toBe(
        "Please enter your school or university name.",
      );
    }
  });

  it("accepts a custom hear-about response when Other is selected", () => {
    const form = validRegistrationForm();
    form.hearAbout = "Other";
    form.otherHearAbout = "Professor announcement";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload.hearAbout).toBe("Professor announcement");
    }
  });

  it("requires a hear-about response when Other is selected", () => {
    const form = validRegistrationForm();
    form.hearAbout = "Other";
    form.otherHearAbout = "";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.otherHearAbout).toBe(
        "Please tell us how you heard about HackUTA.",
      );
    }
  });

  it("accepts a custom major when Other is selected", () => {
    const form = validRegistrationForm();
    form.major = "Other (please specify)";
    form.otherMajor = "Biomedical engineering";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload.major).toBe("Biomedical engineering");
    }
  });

  it("requires a major description when Other is selected", () => {
    const form = validRegistrationForm();
    form.major = "Other (please specify)";
    form.otherMajor = "";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.otherMajor).toBe(
        "Please describe your major or field of study.",
      );
    }
  });

  it("accepts a custom race/ethnicity when Other (Please Specify) is selected", () => {
    const form = validRegistrationForm();
    form.raceEthnicity = ["Other (Please Specify)"];
    form.otherRaceEthnicity = "Multiracial";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload.otherRaceEthnicity).toBe("Multiracial");
    }
  });

  it("requires a race/ethnicity description when Other (Please Specify) is selected", () => {
    const form = validRegistrationForm();
    form.raceEthnicity = ["Other (Please Specify)"];
    form.otherRaceEthnicity = "";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.otherRaceEthnicity).toBe(
        "Please specify your race or ethnicity.",
      );
    }
  });

  it("requires international student, beef preference, and state of residence", () => {
    const unanswered = validRegistrationForm();
    unanswered.internationalStudent = null;
    unanswered.eatsBeef = null;
    unanswered.stateOfResidence = "";

    const result = validateApplicationForm(unanswered);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.internationalStudent).toBe(
        "Please let us know if you are an international student.",
      );
      expect(result.errors.eatsBeef).toBe("Please let us know if you eat beef.");
      expect(result.errors.stateOfResidence).toBe(
        "Please select your state of residence.",
      );
    }
  });

  it("keeps beef preference independent of dietary restrictions", () => {
    const form = validRegistrationForm();
    form.dietaryRestrictions = ["Vegetarian"];
    form.eatsBeef = true;

    const result = validateApplicationForm(form);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload.dietaryRestrictions).toEqual(["Vegetarian"]);
      expect(result.payload.eatsBeef).toBe(true);
    }
  });

  it("accepts residence outside the United States", () => {
    const form = validRegistrationForm();
    form.stateOfResidence = "Outside the United States";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload.stateOfResidence).toBe("Outside the United States");
    }
  });

  it("requires a description when dietary Allergies is selected", () => {
    const form = validRegistrationForm();
    form.dietaryRestrictions = ["Allergies"];
    form.otherDietary = "";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.otherDietary).toBe("Please describe your food allergies.");
    }
  });

  it("rejects invalid optional URLs", () => {
    const form = validRegistrationForm();
    form.github = "http://???";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.github).toBeTruthy();
    }
  });

  it.each([
    ["linkedin", "not-a-url", "Enter a valid linkedin URL."],
    ["portfolio", "ftp://example.com", "Enter a valid portfolio URL."],
    ["devpost", "http://???", "Enter a valid devpost URL."],
  ] as const)("rejects invalid optional %s URLs", (field, value, message) => {
    const form = validRegistrationForm();
    form[field] = value;

    const result = validateApplicationForm(form);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[field]).toBe(message);
    }
  });

  it.each([
    ["linkedin", "https://linkedin.com/in/sam"],
    ["portfolio", "https://example.com/sam"],
    ["devpost", "https://devpost.com/software/hackuta-project"],
  ] as const)("accepts a valid optional %s URL", (field, value) => {
    const form = validRegistrationForm();
    form[field] = value;

    const result = validateApplicationForm(form);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload[field]).toBe(value);
    }
  });

  it("omits empty optional profile URLs from the payload", () => {
    const form = validRegistrationForm();
    form.linkedin = "";
    form.github = "";
    form.portfolio = "";
    form.devpost = "";

    const result = validateApplicationForm(form);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload.linkedin).toBeUndefined();
      expect(result.payload.github).toBeUndefined();
      expect(result.payload.portfolio).toBeUndefined();
      expect(result.payload.devpost).toBeUndefined();
    }
  });
});

describe("validateRegistrationPayload", () => {
  it("accepts a valid payload", () => {
    const payload = validPayloadFromForm();
    const parsed = registrationPayloadSchema.safeParse(payload);

    expect(parsed.success).toBe(true);
    expect(validateRegistrationPayload(payload).success).toBe(true);
  });

  it("rejects invalid enum values", () => {
    const result = validateRegistrationPayload({
      ...validPayloadFromForm(),
      gender: "asdf",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unexpected fields", () => {
    const result = validateRegistrationPayload({
      ...validPayloadFromForm(),
      injectedField: "nope",
    });

    expect(result.success).toBe(false);
  });

  it("rejects bypass attempts with invalid age", () => {
    const result = validateRegistrationPayload({
      ...validPayloadFromForm(),
      age: -500,
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing consent fields", () => {
    const result = validateRegistrationPayload({
      ...validPayloadFromForm(),
      codeOfConductAgreed: false,
    });

    expect(result.success).toBe(false);
  });

  it("accepts optional profile URLs including devpost", () => {
    const result = validateRegistrationPayload({
      ...validPayloadFromForm(),
      linkedin: "https://linkedin.com/in/sam",
      github: "https://github.com/sam",
      portfolio: "https://example.com/sam",
      devpost: "https://devpost.com/software/hackuta-project",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload.devpost).toBe(
        "https://devpost.com/software/hackuta-project",
      );
    }
  });
});

describe("isValidHttpUrl", () => {
  it("accepts http and https URLs", async () => {
    const { isValidHttpUrl } = await import("../../shared/registration/schema");
    expect(isValidHttpUrl("https://github.com/user")).toBe(true);
    expect(isValidHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects invalid and non-http URLs", async () => {
    const { isValidHttpUrl } = await import("../../shared/registration/schema");
    expect(isValidHttpUrl("not-a-url")).toBe(false);
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
  });
});

describe("isValidPhone", () => {
  it("accepts normalized phone numbers", async () => {
    const { isValidPhone } = await import("../../shared/registration/schema");
    expect(isValidPhone("555-123-4567")).toBe(true);
  });

  it("rejects too-short numbers", async () => {
    const { isValidPhone } = await import("../../shared/registration/schema");
    expect(isValidPhone("123")).toBe(false);
  });
});

describe("toggleValue", () => {
  it("adds a value when it is not present", () => {
    expect(toggleValue(["A"], "B")).toEqual(["A", "B"]);
  });

  it("removes a value when it is already present", () => {
    expect(toggleValue(["A", "B"], "A")).toEqual(["B"]);
  });
});

describe("focusFirstInvalidField", () => {
  it("focuses the first invalid field in field order", () => {
    const element = document.createElement("input");
    element.id = "firstName";
    document.body.appendChild(element);
    const focusSpy = vi.spyOn(element, "focus");
    const scrollSpy = vi.spyOn(element, "scrollIntoView");

    focusFirstInvalidField({ lastName: "Required", firstName: "Required" });

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("no-ops when there are no errors", () => {
    expect(() => focusFirstInvalidField({})).not.toThrow();
  });
});
