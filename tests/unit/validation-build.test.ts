import { describe, expect, it } from "vitest";
import { isValidPhone } from "../../shared/registration/schema";
import { validateApplicationForm } from "../../shared/registration/validation";
import { validRegistrationForm } from "../fixtures/validRegistrationForm";

describe("validateApplicationForm candidate building", () => {
  it("treats blank numeric fields as invalid numbers", () => {
    const form = validRegistrationForm();
    form.age = "   ";
    form.graduationYear = "";

    const result = validateApplicationForm(form);
    expect(result.success).toBe(false);
  });

  it("maps unchecked consent to undefined", () => {
    const form = validRegistrationForm();
    form.codeOfConductAgreed = false;
    form.mlhDataSharingConsent = false;
    form.mlhCommunicationsConsent = false;

    const result = validateApplicationForm(form);
    expect(result.success).toBe(false);
  });
});

describe("isValidPhone boundaries", () => {
  it("accepts 7-15 digit numbers", () => {
    expect(isValidPhone("1234567")).toBe(true);
    expect(isValidPhone("123456789012345")).toBe(true);
  });

  it("rejects numbers outside the allowed range", () => {
    expect(isValidPhone("123456")).toBe(false);
    expect(isValidPhone("1234567890123456")).toBe(false);
  });
});
