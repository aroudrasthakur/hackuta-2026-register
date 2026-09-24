import { makeFunctionReference } from "convex/server";

export const getPublicEventConfigRef = makeFunctionReference<
  "query",
  Record<string, never>,
  { name: string }
>("eventConfig:getPublicEventConfig");

export const getApplicantRoutingStateRef = makeFunctionReference<
  "query",
  Record<string, never>,
  {
    authenticated: boolean;
    verifiedEmail: string | null;
    hasSubmittedRegistration: boolean;
  }
>("applicant:getApplicantRoutingState");

export const getMyApplicantDashboardRef = makeFunctionReference<
  "query",
  Record<string, never>
>("applications:getMyApplicantDashboard");

export const getMyApplicationDraftRef = makeFunctionReference<
  "query",
  Record<string, never>
>("applications:getMyApplicationDraft");

export const saveApplicationDraftRef = makeFunctionReference<
  "mutation",
  { patch: Record<string, unknown> }
>("applications:saveApplicationDraft");

export const ensureApplicantApplicationRef = makeFunctionReference<
  "mutation",
  Record<string, never>
>("applicant:ensureApplicantApplication");

export const getOtpSendCooldownRef = makeFunctionReference<
  "mutation",
  { email: string },
  { waitSeconds: number; hourlyLimitReached: boolean }
>("rateLimits:getOtpSendCooldown");

export const getPasswordResetSendCooldownRef = makeFunctionReference<
  "mutation",
  { email: string },
  { waitSeconds: number; hourlyLimitReached: boolean }
>("rateLimits:getPasswordResetSendCooldown");

export const invalidateSessionsAfterPasswordResetRef = makeFunctionReference<
  "mutation",
  Record<string, never>
>("passwordReset:invalidateSessionsAfterPasswordReset");
