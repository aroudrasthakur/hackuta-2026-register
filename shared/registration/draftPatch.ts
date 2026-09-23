import {
  HEAR_ABOUT_OTHER_OPTION,
  MAJOR_OTHER_OPTION,
  SCHOOL_OTHER_OPTION,
} from "./constants";
import type { ApplicationFormData } from "./types";

/** Keys autosaved from the application form (must stay in sync with profileDraftPatch). */
export const DRAFT_PATCH_FIELD_KEYS = [
  "firstName",
  "lastName",
  "phone",
  "age",
  "school",
  "otherSchool",
  "countryOfResidence",
  "levelOfStudy",
  "major",
  "otherMajor",
  "graduationYear",
  "gender",
  "raceEthnicity",
  "otherRaceEthnicity",
  "dietaryRestrictions",
  "otherDietary",
  "tshirtSize",
  "firstHackathon",
  "hearAbout",
  "otherHearAbout",
  "linkedin",
  "github",
  "portfolio",
  "devpost",
  "accessibilityNeeds",
  "emergencyContactName",
  "emergencyContactPhone",
  "codeOfConductAgreed",
  "mlhDataSharingConsent",
  "mlhCommunicationsConsent",
] as const;

export type DraftPatchFieldKey = (typeof DRAFT_PATCH_FIELD_KEYS)[number];

export type DraftPatchPayload = {
  [K in DraftPatchFieldKey]: K extends "age" | "graduationYear"
    ? number | null
    : K extends "firstHackathon"
      ? boolean | null
      : K extends "raceEthnicity" | "dietaryRestrictions"
        ? string[]
        : K extends "codeOfConductAgreed" | "mlhDataSharingConsent" | "mlhCommunicationsConsent"
          ? boolean
          : string;
};

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Full form snapshot for draft autosave.
 * Empty strings, null, and [] mean "clear this field" on the server.
 */
export function formToDraftPatch(form: ApplicationFormData): DraftPatchPayload {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phone: form.phone.trim(),
    age: parseOptionalInt(form.age),
    school: form.school,
    otherSchool:
      form.school === SCHOOL_OTHER_OPTION ? form.otherSchool.trim() : "",
    countryOfResidence: form.countryOfResidence,
    levelOfStudy: form.levelOfStudy,
    major: form.major,
    otherMajor: form.major === MAJOR_OTHER_OPTION ? form.otherMajor.trim() : "",
    graduationYear: parseOptionalInt(form.graduationYear),
    gender: form.gender,
    raceEthnicity: [...form.raceEthnicity],
    otherRaceEthnicity: form.otherRaceEthnicity.trim(),
    dietaryRestrictions: [...form.dietaryRestrictions],
    otherDietary: form.otherDietary.trim(),
    tshirtSize: form.tshirtSize,
    firstHackathon: form.firstHackathon,
    hearAbout: form.hearAbout,
    otherHearAbout:
      form.hearAbout === HEAR_ABOUT_OTHER_OPTION ? form.otherHearAbout.trim() : "",
    linkedin: form.linkedin.trim(),
    github: form.github.trim(),
    portfolio: form.portfolio.trim(),
    devpost: form.devpost.trim(),
    accessibilityNeeds: form.accessibilityNeeds.trim(),
    emergencyContactName: form.emergencyContactName.trim(),
    emergencyContactPhone: form.emergencyContactPhone.trim(),
    codeOfConductAgreed: form.codeOfConductAgreed,
    mlhDataSharingConsent: form.mlhDataSharingConsent,
    mlhCommunicationsConsent: form.mlhCommunicationsConsent,
  };
}

export function isClearedDraftValue(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value === "string" && value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
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

  for (const key of DRAFT_PATCH_FIELD_KEYS) {
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
