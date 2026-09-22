import { describe, expect, it } from "vitest";
import {
  assertSafePlainText,
  containsDangerousMarkup,
  sanitizeEmailHeaderValue,
  sanitizePlainText,
} from "../../shared/lib/sanitizeInput";
import { registrationPayloadSchema } from "../../shared/registration/schema";
import { validRegistrationForm } from "../fixtures/validRegistrationForm";
import { validateApplicationForm } from "../../shared/registration/validation";

describe("sanitizeInput", () => {
  it("strips control characters and normalizes whitespace", () => {
    expect(sanitizePlainText("  Sam\u0000 Test  ")).toBe("Sam Test");
  });

  it("detects HTML and script injection patterns", () => {
    expect(containsDangerousMarkup("<script>alert(1)</script>")).toBe(true);
    expect(containsDangerousMarkup("javascript:alert(1)")).toBe(true);
    expect(containsDangerousMarkup("plain text")).toBe(false);
  });

  it("rejects unsafe plain text", () => {
    expect(assertSafePlainText("<img onerror=alert(1)>")).toBeNull();
    expect(assertSafePlainText("Sam Test")).toBe("Sam Test");
  });

  it("sanitizes email header values", () => {
    expect(sanitizeEmailHeaderValue("  Question about HackUTA  ", 150)).toBe(
      "Question about HackUTA",
    );
    expect(() => sanitizeEmailHeaderValue("<script>", 150)).toThrow();
  });
});

describe("server-side XSS validation integration", () => {
  it("rejects HTML in registration names", () => {
    const form = validRegistrationForm();
    form.firstName = "<script>alert(1)</script>";

    const result = validateApplicationForm(form);
    expect(result.success).toBe(false);
  });

  it("rejects HTML in registration payload schema", () => {
    const form = validRegistrationForm();
    const candidate = {
      ...form,
      firstName: "<b>Evil</b>",
      age: Number(form.age),
      graduationYear: Number(form.graduationYear),
      major: form.major,
      hackathonId: "hackuta-2026" as const,
      codeOfConductAgreed: true as const,
      mlhDataSharingConsent: true as const,
    };

    const result = registrationPayloadSchema.safeParse(candidate);
    expect(result.success).toBe(false);
  });

});
