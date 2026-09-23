import { getAuthUserId } from "@convex-dev/auth/server";
import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import type { GenericId } from "convex/values";
import { HACKATHON_ID } from "../../shared/registration/constants";
import { normalizeEmail } from "./normalizeEmail";
import type schema from "../schema";

type DataModel = DataModelFromSchemaDefinition<typeof schema>;
type ProfileDoc = DocumentByName<DataModel, "profiles">;
type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type AuthCtx = QueryCtx | MutationCtx;

export async function getAuthUser(ctx: AuthCtx) {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId) {
    const authUser = await ctx.db.get(authUserId);
    if (authUser) return authUser;
  }

  const identity = await ctx.auth.getUserIdentity();
  const email = normalizeEmail(identity?.email);
  if (!email) return null;

  return ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .first();
}

export async function requireAuthUser(ctx: AuthCtx) {
  const user = await getAuthUser(ctx);
  if (!user) {
    throw new Error("Authentication required.");
  }
  return user;
}

export async function getProfileByUserAndHackathon(
  ctx: AuthCtx,
  authUserId: GenericId<"users">,
  hackathonId: string,
) {
  return ctx.db
    .query("profiles")
    .withIndex("by_auth_user_hackathon", (q) =>
      q.eq("authUserId", authUserId).eq("hackathonId", hackathonId),
    )
    .first();
}

/** Whether the applicant completed a successful registration form submit. */
export function profileFormWasSubmitted(profile: Pick<ProfileDoc, "formSubmitted" | "submittedAt">) {
  return profile.formSubmitted === true || profile.submittedAt != null;
}

export async function ensureDraftProfile(
  ctx: MutationCtx,
  hackathonId: string = HACKATHON_ID,
) {
  const authUser = await requireAuthUser(ctx);
  const email = normalizeEmail(authUser.email);
  if (!email) {
    throw new Error("A verified email is required.");
  }

  const existing = await getProfileByUserAndHackathon(ctx, authUser._id, hackathonId);
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
  const profileId = await ctx.db.insert("profiles", {
    authUserId: authUser._id,
    email,
    emailVerificationTime: authUser.emailVerificationTime,
    hackathonId,
    status: "draft",
    eligibilityStatus: "unreviewed",
    confirmationStatus: "unconfirmed",
    createdAt: now,
    updatedAt: now,
  });
  const profile = await ctx.db.get(profileId);
  if (!profile) {
    throw new Error("Profile could not be created.");
  }
  return profile;
}

export async function findProfileByResume(
  ctx: AuthCtx,
  storageId: GenericId<"_storage">,
) {
  return ctx.db
    .query("profiles")
    .withIndex("by_resume", (q) => q.eq("resumeStorageId", storageId))
    .first();
}

export function formatProfileFullName(fields: {
  firstName?: string | null;
  lastName?: string | null;
}) {
  const first = fields.firstName?.trim();
  const last = fields.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  return first || last || null;
}

/** Keep auth `users.name` in sync with the application form display name. */
export async function syncAuthUserNameFromProfile(
  ctx: MutationCtx,
  authUserId: GenericId<"users">,
  fields: { firstName?: string | null; lastName?: string | null },
) {
  const name = formatProfileFullName(fields);
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

export function projectApplicantAnswers(profile: ProfileDoc) {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    age: profile.age,
    school: profile.school,
    countryOfResidence: profile.countryOfResidence,
    levelOfStudy: profile.levelOfStudy,
    major: profile.major,
    graduationYear: profile.graduationYear,
    gender: profile.gender,
    raceEthnicity: profile.raceEthnicity,
    otherRaceEthnicity: profile.otherRaceEthnicity,
    dietaryRestrictions: profile.dietaryRestrictions,
    otherDietary: profile.otherDietary,
    tshirtSize: profile.tshirtSize,
    firstHackathon: profile.firstHackathon,
    hearAbout: profile.hearAbout,
    linkedin: profile.linkedin,
    github: profile.github,
    portfolio: profile.portfolio,
    devpost: profile.devpost,
    accessibilityNeeds: profile.accessibilityNeeds,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
    mlhCommunicationsConsent: profile.mlhCommunicationsConsent,
  };
}

export function profileToDraftForm(profile: ProfileDoc) {
  return {
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    phone: profile.phone ?? "",
    age: profile.age !== undefined ? String(profile.age) : "",
    school: profile.school ?? "",
    otherSchool: profile.otherSchool ?? "",
    countryOfResidence: profile.countryOfResidence ?? "",
    levelOfStudy: profile.levelOfStudy ?? "",
    major: profile.major ?? "",
    otherMajor: profile.otherMajor ?? "",
    graduationYear:
      profile.graduationYear !== undefined ? String(profile.graduationYear) : "",
    gender: profile.gender ?? "",
    raceEthnicity: profile.raceEthnicity ?? [],
    otherRaceEthnicity: profile.otherRaceEthnicity ?? "",
    dietaryRestrictions: profile.dietaryRestrictions ?? [],
    otherDietary: profile.otherDietary ?? "",
    tshirtSize: profile.tshirtSize ?? "",
    firstHackathon: profile.firstHackathon ?? null,
    hearAbout: profile.hearAbout ?? "",
    otherHearAbout: profile.otherHearAbout ?? "",
    resume: null,
    linkedin: profile.linkedin ?? "",
    github: profile.github ?? "",
    portfolio: profile.portfolio ?? "",
    devpost: profile.devpost ?? "",
    accessibilityNeeds: profile.accessibilityNeeds ?? "",
    emergencyContactName: profile.emergencyContactName ?? "",
    emergencyContactPhone: profile.emergencyContactPhone ?? "",
    codeOfConductAgreed: profile.codeOfConductAgreed ?? false,
    mlhDataSharingConsent: profile.mlhDataSharingConsent ?? false,
    mlhCommunicationsConsent: profile.mlhCommunicationsConsent ?? false,
  };
}
