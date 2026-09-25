import type { GenericId } from "convex/values";
import { ensureEventConfig } from "./eventConfig";
import { normalizeEmail } from "./normalizeEmail";
import { getAuthUser, requireAuthUser, type AuthCtx } from "./auth";
import type { ApplicationDoc, MutationCtx } from "./dataModel";

export { getAuthUser, requireAuthUser };

export async function getApplicationByUser(
  ctx: AuthCtx,
  authUserId: GenericId<"users">,
): Promise<ApplicationDoc | null> {
  return ctx.db
    .query("applications")
    .withIndex("by_auth_user", (q) => q.eq("authUserId", authUserId))
    .first();
}

/** Whether the applicant completed a successful registration form submit. */
export function applicationFormWasSubmitted(
  application: Pick<ApplicationDoc, "formSubmitted" | "submittedAt">,
) {
  return application.formSubmitted === true || application.submittedAt != null;
}

export async function ensureDraftApplication(ctx: MutationCtx) {
  await ensureEventConfig(ctx);
  const authUser = await requireAuthUser(ctx);
  const email = normalizeEmail(authUser.email);
  if (!email) {
    throw new Error("A verified email is required.");
  }

  const existing = await getApplicationByUser(ctx, authUser._id);
  if (existing) {
    const emailVerificationTime =
      authUser.emailVerificationTime ?? existing.emailVerificationTime;
    if (emailVerificationTime !== existing.emailVerificationTime) {
      await ctx.db.patch(existing._id, {
        emailVerificationTime,
        email,
        updatedAt: Date.now(),
      });
    }
    return existing;
  }

  const now = Date.now();
  const applicationId = await ctx.db.insert("applications", {
    authUserId: authUser._id,
    email,
    ...(authUser.emailVerificationTime !== undefined
      ? { emailVerificationTime: authUser.emailVerificationTime }
      : {}),
    status: "draft",
    eligibilityStatus: "unreviewed",
    confirmationStatus: "unconfirmed",
    createdAt: now,
    updatedAt: now,
  });
  const application = await ctx.db.get(applicationId);
  if (!application) {
    throw new Error("Application could not be created.");
  }
  return application as ApplicationDoc;
}

export async function findApplicationByResume(
  ctx: AuthCtx,
  storageId: GenericId<"_storage">,
): Promise<ApplicationDoc | null> {
  return ctx.db
    .query("applications")
    .withIndex("by_resume", (q) => q.eq("resumeStorageId", storageId))
    .first();
}

export function formatApplicantFullName(fields: {
  firstName?: string | null;
  lastName?: string | null;
}) {
  const first = fields.firstName?.trim();
  const last = fields.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  return first || last || null;
}

/** Keep auth `users.name` in sync with the application form display name. */
export async function syncAuthUserNameFromApplication(
  ctx: MutationCtx,
  authUserId: GenericId<"users">,
  fields: { firstName?: string | null; lastName?: string | null },
) {
  const name = formatApplicantFullName(fields);
  const user = await ctx.db.get(authUserId);
  if (!user) return;

  if (!name) {
    if (user.name !== undefined) {
      const { _id, _creationTime, name: removedName, ...replacement } = user;
      void _id;
      void _creationTime;
      void removedName;
      await ctx.db.replace(authUserId, replacement);
    }
    return;
  }

  if (user.name !== name) {
    await ctx.db.patch(authUserId, { name });
  }
}

export function projectApplicantAnswers(application: ApplicationDoc) {
  return {
    firstName: application.firstName,
    lastName: application.lastName,
    phone: application.phone,
    age: application.age,
    school: application.school,
    studentEmail: application.studentEmail,
    countryOfResidence: application.countryOfResidence,
    stateOfResidence: application.stateOfResidence,
    levelOfStudy: application.levelOfStudy,
    major: application.major,
    graduationYear: application.graduationYear,
    gender: application.gender,
    raceEthnicity: application.raceEthnicity,
    otherRaceEthnicity: application.otherRaceEthnicity,
    dietaryRestrictions: application.dietaryRestrictions,
    otherDietary: application.otherDietary,
    otherDietaryRestrictions: application.otherDietaryRestrictions,
    tshirtSize: application.tshirtSize,
    hackathonsAttended: application.hackathonsAttended,
    hearAbout: application.hearAbout,
    linkedin: application.linkedin,
    github: application.github,
    portfolio: application.portfolio,
    devpost: application.devpost,
    accessibilityNeeds: application.accessibilityNeeds,
    builtOrWantToBuild: application.builtOrWantToBuild,
    shortDeadlineLearning: application.shortDeadlineLearning,
    emergencyContactName: application.emergencyContactName,
    emergencyContactPhone: application.emergencyContactPhone,
    mlhCommunicationsConsent: application.mlhCommunicationsConsent,
    sponsorSharingConsent: application.sponsorSharingConsent === true,
    foodAllergyWaiverAgreed: application.foodAllergyWaiverAgreed === true,
    sponsorSharingConsentSubmittedAt: application.sponsorSharingConsentSubmittedAt,
    foodAllergyWaiverSubmittedAt: application.foodAllergyWaiverSubmittedAt,
  };
}
