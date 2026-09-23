import {
  HEAR_ABOUT_OTHER_OPTION,
  MAJOR_OTHER_OPTION,
  SCHOOL_OTHER_OPTION,
} from "./constants";
import {
  APPLICANT_ANSWER_FIELD_KEYS,
  CONDITIONAL_STRING_FIELDS,
  isClearedDraftValue,
  NULLABLE_BOOLEAN_FIELDS,
  OPTIONAL_INT_FIELDS,
  PLAIN_STRING_FIELDS,
  REQUIRED_BOOLEAN_FIELDS,
  STRING_ARRAY_FIELDS,
  TRIMMED_STRING_FIELDS,
  type ApplicantAnswerFieldKey,
  type DraftPatchPayload,
} from "./applicantFields";
import type { ApplicationFormData } from "./types";

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Profile columns needed to hydrate the registration form (excludes resume blob). */
export type StoredApplicantProfile = Partial<
  Record<
    ApplicantAnswerFieldKey,
    string | number | boolean | string[] | null | undefined
  >
>;

/**
 * Full form snapshot for draft autosave.
 * Empty strings, null, and [] mean "clear this field" on the server.
 */
export function formToDraftPatch(form: ApplicationFormData): DraftPatchPayload {
  const patch = {} as DraftPatchPayload;

  for (const key of TRIMMED_STRING_FIELDS) {
    patch[key] = form[key].trim();
  }

  for (const key of PLAIN_STRING_FIELDS) {
    patch[key] = form[key];
  }

  patch.otherSchool =
    form.school === SCHOOL_OTHER_OPTION ? form.otherSchool.trim() : "";
  patch.otherMajor =
    form.major === MAJOR_OTHER_OPTION ? form.otherMajor.trim() : "";
  patch.otherHearAbout =
    form.hearAbout === HEAR_ABOUT_OTHER_OPTION ? form.otherHearAbout.trim() : "";

  for (const key of OPTIONAL_INT_FIELDS) {
    patch[key] = parseOptionalInt(form[key]);
  }

  for (const key of STRING_ARRAY_FIELDS) {
    patch[key] = [...form[key]];
  }

  for (const key of NULLABLE_BOOLEAN_FIELDS) {
    patch[key] = form[key];
  }

  for (const key of REQUIRED_BOOLEAN_FIELDS) {
    patch[key] = form[key];
  }

  return patch;
}

/** Map stored profile columns back into form state (resume stays null). */
export function profileToDraftForm(
  profile: StoredApplicantProfile,
): Omit<ApplicationFormData, "resume"> {
  const values: Record<string, unknown> = {};

  for (const key of TRIMMED_STRING_FIELDS) {
    values[key] = (profile[key] as string | undefined) ?? "";
  }

  for (const key of PLAIN_STRING_FIELDS) {
    values[key] = (profile[key] as string | undefined) ?? "";
  }

  for (const key of CONDITIONAL_STRING_FIELDS) {
    values[key] = (profile[key] as string | undefined) ?? "";
  }

  for (const key of OPTIONAL_INT_FIELDS) {
    const stored = profile[key];
    values[key] = stored !== undefined && stored !== null ? String(stored) : "";
  }

  for (const key of STRING_ARRAY_FIELDS) {
    values[key] = [...((profile[key] as string[] | undefined) ?? [])];
  }

  for (const key of NULLABLE_BOOLEAN_FIELDS) {
    values[key] = (profile[key] as boolean | null | undefined) ?? null;
  }

  for (const key of REQUIRED_BOOLEAN_FIELDS) {
    values[key] = (profile[key] as boolean | undefined) ?? false;
  }

  return values as Omit<ApplicationFormData, "resume">;
}

/** Apply a full draft snapshot, removing cleared fields from the stored profile. */
export function mergeDraftPatchIntoProfile<T extends Record<string, unknown>>(
  profile: T,
  patch: DraftPatchPayload,
  meta: {
    email: string;
    emailVerificationTime?: number;
    updatedAt: number;
  },
): Omit<T, "_id" | "_creationTime"> {
  const next: Record<string, unknown> = { ...profile, ...meta };

  for (const key of APPLICANT_ANSWER_FIELD_KEYS) {
    const value = patch[key];
    if (isClearedDraftValue(value)) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }

  delete next._id;
  delete next._creationTime;

  return next as Omit<T, "_id" | "_creationTime">;
}
