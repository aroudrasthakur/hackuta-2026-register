import { v } from "convex/values";

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

/** Attendance confirmation after acceptance (set by admin or applicant). */
export const confirmationStatus = v.union(
  v.literal("unconfirmed"),
  v.literal("confirmed"),
  v.literal("declined"),
);

/**
 * Applicant profile — one row per auth user per hackathon.
 * Passwords and auth secrets live in Convex Auth tables only.
 */
export const profileRecord = {
  authUserId: v.id("users"),
  email: v.string(),
  emailVerificationTime: v.optional(v.number()),
  hackathonId: v.string(),
  status: profileStatus,
  eligibilityStatus,
  createdAt: v.number(),
  updatedAt: v.number(),
  submittedAt: v.optional(v.number()),
  reviewedAt: v.optional(v.number()),
  reviewedBy: v.optional(v.string()),
  checkedInAt: v.optional(v.number()),
  confirmedAt: v.optional(v.number()),
  confirmationStatus: v.optional(confirmationStatus),
  internalNotes: v.optional(v.string()),
  resumeStorageId: v.optional(v.id("_storage")),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  phone: v.optional(v.string()),
  age: v.optional(v.number()),
  school: v.optional(v.string()),
  otherSchool: v.optional(v.string()),
  countryOfResidence: v.optional(v.string()),
  levelOfStudy: v.optional(v.string()),
  major: v.optional(v.string()),
  otherMajor: v.optional(v.string()),
  graduationYear: v.optional(v.number()),
  gender: v.optional(v.string()),
  raceEthnicity: v.optional(v.array(v.string())),
  otherRaceEthnicity: v.optional(v.string()),
  dietaryRestrictions: v.optional(v.array(v.string())),
  otherDietary: v.optional(v.string()),
  tshirtSize: v.optional(v.string()),
  firstHackathon: v.optional(v.boolean()),
  hearAbout: v.optional(v.string()),
  otherHearAbout: v.optional(v.string()),
  linkedin: v.optional(v.string()),
  github: v.optional(v.string()),
  portfolio: v.optional(v.string()),
  devpost: v.optional(v.string()),
  accessibilityNeeds: v.optional(v.string()),
  emergencyContactName: v.optional(v.string()),
  emergencyContactPhone: v.optional(v.string()),
  codeOfConductAgreed: v.optional(v.boolean()),
  mlhDataSharingConsent: v.optional(v.boolean()),
  mlhCommunicationsConsent: v.optional(v.boolean()),
};

const draftNullableString = v.union(v.string(), v.null());
const draftNullableNumber = v.union(v.number(), v.null());
const draftNullableBoolean = v.union(v.boolean(), v.null());

/** Writable draft fields (autosave + pre-submit edits). Null/""/[] clears stored values. */
export const profileDraftPatch = v.object({
  firstName: draftNullableString,
  lastName: draftNullableString,
  phone: draftNullableString,
  age: draftNullableNumber,
  school: draftNullableString,
  otherSchool: draftNullableString,
  countryOfResidence: draftNullableString,
  levelOfStudy: draftNullableString,
  major: draftNullableString,
  otherMajor: draftNullableString,
  graduationYear: draftNullableNumber,
  gender: draftNullableString,
  raceEthnicity: v.array(v.string()),
  otherRaceEthnicity: draftNullableString,
  dietaryRestrictions: v.array(v.string()),
  otherDietary: draftNullableString,
  tshirtSize: draftNullableString,
  firstHackathon: draftNullableBoolean,
  hearAbout: draftNullableString,
  otherHearAbout: draftNullableString,
  linkedin: draftNullableString,
  github: draftNullableString,
  portfolio: draftNullableString,
  devpost: draftNullableString,
  accessibilityNeeds: draftNullableString,
  emergencyContactName: draftNullableString,
  emergencyContactPhone: draftNullableString,
  codeOfConductAgreed: v.boolean(),
  mlhDataSharingConsent: v.boolean(),
  mlhCommunicationsConsent: v.boolean(),
  resumeStorageId: v.optional(v.id("_storage")),
});
