import { v, type GenericValidator } from "convex/values";
import {
  CONDITIONAL_STRING_FIELDS,
  NULLABLE_BOOLEAN_FIELDS,
  OPTIONAL_INT_FIELDS,
  PLAIN_STRING_FIELDS,
  REQUIRED_BOOLEAN_FIELDS,
  STRING_ARRAY_FIELDS,
  TRIMMED_STRING_FIELDS,
} from "../shared/registration/applicantFields";

/** Application lifecycle status for a hackathon profile row. */
export const profileStatus = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("accepted"),
  v.literal("waitlisted"),
  v.literal("rejected"),
  v.literal("withdrawn"),
);

/** Organizer eligibility review (separate from accept/waitlist/reject). */
export const eligibilityStatus = v.union(
  v.literal("unreviewed"),
  v.literal("eligible"),
  v.literal("ineligible"),
);

/** Attendance confirmation after acceptance (set by organizers or applicant). */
export const confirmationStatus = v.union(
  v.literal("unconfirmed"),
  v.literal("confirmed"),
  v.literal("declined"),
);

const draftNullableString = v.union(v.string(), v.null());
const draftNullableNumber = v.union(v.number(), v.null());
const draftNullableBoolean = v.union(v.boolean(), v.null());

const applicantStringFieldKeys = [
  ...TRIMMED_STRING_FIELDS,
  ...PLAIN_STRING_FIELDS,
  ...CONDITIONAL_STRING_FIELDS,
] as const;

function fieldsFromKeys<const K extends readonly string[]>(
  keys: K,
  builder: (key: K[number]) => GenericValidator,
) {
  return Object.fromEntries(keys.map((key) => [key, builder(key)])) as {
    [P in K[number]]: GenericValidator;
  };
}

/** Optional applicant answer columns persisted on profiles. */
const applicantAnswerFields = {
  ...fieldsFromKeys(applicantStringFieldKeys, () => v.optional(v.string())),
  ...fieldsFromKeys(OPTIONAL_INT_FIELDS, () => v.optional(v.number())),
  ...fieldsFromKeys(STRING_ARRAY_FIELDS, () => v.optional(v.array(v.string()))),
  ...fieldsFromKeys(NULLABLE_BOOLEAN_FIELDS, () => v.optional(v.boolean())),
  ...fieldsFromKeys(REQUIRED_BOOLEAN_FIELDS, () => v.optional(v.boolean())),
};

/** Writable draft fields (autosave + pre-submit edits). Null/""/[] clears stored values. */
const applicantDraftPatchFields = {
  ...fieldsFromKeys(applicantStringFieldKeys, () => draftNullableString),
  ...fieldsFromKeys(OPTIONAL_INT_FIELDS, () => draftNullableNumber),
  ...fieldsFromKeys(STRING_ARRAY_FIELDS, () => v.array(v.string())),
  ...fieldsFromKeys(NULLABLE_BOOLEAN_FIELDS, () => draftNullableBoolean),
  ...fieldsFromKeys(REQUIRED_BOOLEAN_FIELDS, () => v.boolean()),
};

/**
 * Applicant profile — one row per auth user.
 * Passwords and auth secrets live in Convex Auth tables only.
 */
export const profileRecord = {
  authUserId: v.id("users"),
  email: v.string(),
  emailVerificationTime: v.optional(v.number()),
  status: profileStatus,
  eligibilityStatus,
  createdAt: v.number(),
  updatedAt: v.number(),
  /** Set to true when the registration form is successfully submitted; never cleared. */
  formSubmitted: v.optional(v.boolean()),
  submittedAt: v.optional(v.number()),
  reviewedAt: v.optional(v.number()),
  reviewedBy: v.optional(v.string()),
  checkedInAt: v.optional(v.number()),
  confirmedAt: v.optional(v.number()),
  confirmationStatus: v.optional(confirmationStatus),
  internalNotes: v.optional(v.string()),
  resumeStorageId: v.optional(v.id("_storage")),
  ...applicantAnswerFields,
};

/** Writable draft fields (autosave + pre-submit edits). Null/""/[] clears stored values. */
export const profileDraftPatch = v.object({
  ...applicantDraftPatchFields,
  resumeStorageId: v.optional(v.id("_storage")),
});
