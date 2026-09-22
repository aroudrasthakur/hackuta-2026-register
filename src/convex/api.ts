import { makeFunctionReference } from "convex/server";

export const getApplicantRoutingStateRef = makeFunctionReference<
  "query",
  { hackathonId?: string },
  {
    authenticated: boolean;
    verifiedEmail: string | null;
    emailVerified: boolean;
    hasRegistration: boolean;
    registrationStatus: string | null;
    hasSubmittedRegistration?: boolean;
  }
>("applicant:getApplicantRoutingState");

export const getMyApplicantDashboardRef = makeFunctionReference<
  "query",
  { hackathonId?: string }
>("profiles:getMyApplicantDashboard");

export const getMyProfileDraftRef = makeFunctionReference<
  "query",
  { hackathonId?: string }
>("profiles:getMyProfileDraft");

export const saveProfileDraftRef = makeFunctionReference<
  "mutation",
  { hackathonId?: string; patch: Record<string, unknown> }
>("profiles:saveProfileDraft");

export const ensureApplicantProfileRef = makeFunctionReference<
  "mutation",
  { hackathonId?: string }
>("applicant:ensureApplicantProfile");

export const getOtpSendCooldownRef = makeFunctionReference<
  "mutation",
  { email: string },
  { waitSeconds: number; hourlyLimitReached: boolean }
>("rateLimits:getOtpSendCooldown");
