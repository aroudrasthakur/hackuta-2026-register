import { describe, expect, it } from "vitest";
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
    form.MLHcodeOfConductAgreed = false;
    form.mlhDataSharingConsent = false;
    form.mlhCommunicationsConsent = false;

    const result = validateApplicationForm(form);
    expect(result.success).toBe(false);
  });
});
