import { describe, expect, it } from "vitest";
import { applicationRecord, APPLICANT_DRAFT_PATCH_FIELD_KEYS } from "../../convex/applicationFields";
import {
  APPLICANT_ANSWER_FIELD_KEYS,
  REQUIRED_BOOLEAN_FIELDS,
} from "../../shared/registration/applicantFields";
import {
  INTERIM_MLH_CODE_OF_CONDUCT_FIELD,
  LEGACY_CODE_OF_CONDUCT_FIELD,
  MLH_CODE_OF_CONDUCT_FIELD,
  normalizeDraftCodeOfConductPatch,
  resolveMlhCodeOfConductAgreed,
} from "../../shared/registration/consentFieldMigration";
import {
  applicationToDraftForm,
  formToDraftPatch,
  mergeDraftPatchIntoApplication,
} from "../../shared/registration/draftMapping";
import { registrationPayloadSchema } from "../../shared/registration/schema";
import { validateApplicationForm } from "../../shared/registration/validation";
import { validRegistrationForm, validRegistrationPayload } from "../fixtures/validRegistrationForm";

describe("mlh code of conduct schema registration", () => {
  it("registers mlhCodeOfConductAgreed across shared and Convex applicant field lists", () => {
    expect(REQUIRED_BOOLEAN_FIELDS).toContain(MLH_CODE_OF_CONDUCT_FIELD);
    expect(APPLICANT_ANSWER_FIELD_KEYS).toContain(MLH_CODE_OF_CONDUCT_FIELD);
    expect(APPLICANT_DRAFT_PATCH_FIELD_KEYS).toContain(MLH_CODE_OF_CONDUCT_FIELD);
    expect(applicationRecord).toHaveProperty(MLH_CODE_OF_CONDUCT_FIELD);

    const parsed = registrationPayloadSchema.safeParse(validRegistrationPayload());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toHaveProperty(MLH_CODE_OF_CONDUCT_FIELD, true);
    }
  });

  it("requires mlhCodeOfConductAgreed in registrationPayloadSchema", () => {
    const payload = {
      ...validRegistrationPayload(),
      mlhCodeOfConductAgreed: false as const,
    };

    expect(registrationPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects legacy codeOfConductAgreed in strict registration payloads", () => {
    const payload = {
      ...validRegistrationPayload(),
      [LEGACY_CODE_OF_CONDUCT_FIELD]: true,
    };

    expect(registrationPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("round-trips mlhCodeOfConductAgreed through draft patch merge", () => {
    const form = validRegistrationForm();
    form.mlhCodeOfConductAgreed = true;

    const validated = validateApplicationForm(form);
    expect(validated.success).toBe(true);
    if (!validated.success) return;

    expect(validated.payload.mlhCodeOfConductAgreed).toBe(true);

    const patch = formToDraftPatch(form);
    expect(patch.mlhCodeOfConductAgreed).toBe(true);

    const merged = mergeDraftPatchIntoApplication(
      { authUserId: "user1" } as Record<string, unknown>,
      patch,
      { email: "sam@example.com", updatedAt: 1 },
    );
    const restored = applicationToDraftForm(merged as Record<string, unknown>);

    expect(restored.mlhCodeOfConductAgreed).toBe(true);
  });

  it("hydrates legacy codeOfConductAgreed into mlhCodeOfConductAgreed", () => {
    expect(
      resolveMlhCodeOfConductAgreed({
        [LEGACY_CODE_OF_CONDUCT_FIELD]: true,
      }),
    ).toBe(true);

    const restored = applicationToDraftForm({
      [LEGACY_CODE_OF_CONDUCT_FIELD]: true,
    });

    expect(restored.mlhCodeOfConductAgreed).toBe(true);
    expect(restored).not.toHaveProperty(LEGACY_CODE_OF_CONDUCT_FIELD);
  });

  it("hydrates interim MLHcodeOfConductAgreed into mlhCodeOfConductAgreed", () => {
    expect(
      resolveMlhCodeOfConductAgreed({
        [INTERIM_MLH_CODE_OF_CONDUCT_FIELD]: true,
      }),
    ).toBe(true);

    const restored = applicationToDraftForm({
      [INTERIM_MLH_CODE_OF_CONDUCT_FIELD]: true,
    });

    expect(restored.mlhCodeOfConductAgreed).toBe(true);
  });

  it("normalizes legacy draft patch keys to mlhCodeOfConductAgreed", () => {
    expect(
      normalizeDraftCodeOfConductPatch({
        codeOfConductAgreed: true,
        mlhDataSharingConsent: false,
      }),
    ).toEqual({
      mlhDataSharingConsent: false,
      mlhCodeOfConductAgreed: true,
    });

    expect(
      normalizeDraftCodeOfConductPatch({
        MLHcodeOfConductAgreed: true,
        mlhDataSharingConsent: false,
      }),
    ).toEqual({
      mlhDataSharingConsent: false,
      mlhCodeOfConductAgreed: true,
    });
  });

  it("strips legacy code of conduct columns when merging draft patches", () => {
    const patch = formToDraftPatch(validRegistrationForm());
    patch.mlhCodeOfConductAgreed = true;

    const merged = mergeDraftPatchIntoApplication(
      {
        [LEGACY_CODE_OF_CONDUCT_FIELD]: true,
        [INTERIM_MLH_CODE_OF_CONDUCT_FIELD]: true,
      },
      patch,
      { email: "sam@example.com", updatedAt: 1 },
    );

    expect(merged).toMatchObject({ [MLH_CODE_OF_CONDUCT_FIELD]: true });
    expect(merged).not.toHaveProperty(LEGACY_CODE_OF_CONDUCT_FIELD);
    expect(merged).not.toHaveProperty(INTERIM_MLH_CODE_OF_CONDUCT_FIELD);
  });

  it("rejects interim MLHcodeOfConductAgreed in strict registration payloads", () => {
    const payload = {
      ...validRegistrationPayload(),
      [INTERIM_MLH_CODE_OF_CONDUCT_FIELD]: true,
    };

    expect(registrationPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("prefers mlhCodeOfConductAgreed over legacy columns when all exist", () => {
    expect(
      resolveMlhCodeOfConductAgreed({
        [MLH_CODE_OF_CONDUCT_FIELD]: false,
        [INTERIM_MLH_CODE_OF_CONDUCT_FIELD]: true,
        [LEGACY_CODE_OF_CONDUCT_FIELD]: true,
      }),
    ).toBe(false);
  });
});
