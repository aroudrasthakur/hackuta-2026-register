import {
  CONDITIONAL_STRING_FIELDS,
  PLAIN_STRING_FIELDS,
  STRING_ARRAY_FIELDS,
  TRIMMED_STRING_FIELDS,
} from "./applicantFields";
import {
  DIETARY_OPTIONS,
  FIELD_LIMITS,
  RACE_ETHNICITY_OPTIONS,
} from "./constants";

const STRING_FIELD_MAX: Record<string, number> = {
  firstName: FIELD_LIMITS.name,
  lastName: FIELD_LIMITS.name,
  phone: FIELD_LIMITS.phone,
  studentEmail: FIELD_LIMITS.email,
  otherRaceEthnicity: FIELD_LIMITS.otherRaceEthnicity,
  allergyDetails: FIELD_LIMITS.allergyDetails,
  otherDietaryRestrictions: FIELD_LIMITS.otherDietaryRestrictions,
  linkedin: FIELD_LIMITS.url,
  github: FIELD_LIMITS.url,
  portfolio: FIELD_LIMITS.url,
  devpost: FIELD_LIMITS.url,
  accessibilityNeeds: FIELD_LIMITS.accessibilityNeeds,
  builtOrWantToBuild: FIELD_LIMITS.builtOrWantToBuild,
  shortDeadlineLearning: FIELD_LIMITS.shortDeadlineLearning,
  emergencyContactName: FIELD_LIMITS.name,
  emergencyContactRelationship: FIELD_LIMITS.emergencyContactRelationship,
  emergencyContactPhone: FIELD_LIMITS.phone,
  phoneCountry: 8,
  emergencyContactPhoneCountry: 8,
  school: FIELD_LIMITS.school,
  countryOfResidence: 100,
  stateOfResidence: 100,
  levelOfStudy: 100,
  major: FIELD_LIMITS.major,
  gender: 100,
  tshirtSize: 10,
  experienceLevel: 50,
  hearAbout: FIELD_LIMITS.hearAbout,
  otherSchool: FIELD_LIMITS.otherSchool,
  otherLevelOfStudy: FIELD_LIMITS.otherLevelOfStudy,
  otherMajor: FIELD_LIMITS.otherMajor,
  otherHearAbout: FIELD_LIMITS.otherHearAbout,
  otherGender: FIELD_LIMITS.otherGender,
  resumeFilename: 255,
};

for (const key of TRIMMED_STRING_FIELDS) {
  if (!(key in STRING_FIELD_MAX)) {
    throw new Error(`Missing draft length limit for ${key}`);
  }
}
for (const key of PLAIN_STRING_FIELDS) {
  if (!(key in STRING_FIELD_MAX)) {
    throw new Error(`Missing draft length limit for ${key}`);
  }
}
for (const key of CONDITIONAL_STRING_FIELDS) {
  if (!(key in STRING_FIELD_MAX)) {
    throw new Error(`Missing draft length limit for ${key}`);
  }
}

const ARRAY_MAX_LENGTHS: Record<(typeof STRING_ARRAY_FIELDS)[number], number> = {
  raceEthnicity: RACE_ETHNICITY_OPTIONS.length,
  dietaryRestrictions: DIETARY_OPTIONS.length,
};

export const DRAFT_FIELD_TOO_LONG_MESSAGE = "One or more fields exceed the allowed length.";
export const DRAFT_ARRAY_TOO_LONG_MESSAGE = "Too many selections in a multi-select field.";

export function validateDraftPatchLimits(patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === "string") {
      const max = STRING_FIELD_MAX[key];
      if (max !== undefined && value.length > max) {
        throw new Error(DRAFT_FIELD_TOO_LONG_MESSAGE);
      }
    }

    if (Array.isArray(value) && key in ARRAY_MAX_LENGTHS) {
      const maxItems = ARRAY_MAX_LENGTHS[key as keyof typeof ARRAY_MAX_LENGTHS];
      if (value.length > maxItems) {
        throw new Error(DRAFT_ARRAY_TOO_LONG_MESSAGE);
      }
      for (const item of value) {
        if (typeof item === "string" && item.length > 200) {
          throw new Error(DRAFT_FIELD_TOO_LONG_MESSAGE);
        }
      }
    }
  }
}
