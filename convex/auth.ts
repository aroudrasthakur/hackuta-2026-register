import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { GenericActionCtx } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { validatePasswordRequirements } from "../shared/auth/password";
import { isValidEmailSyntax, normalizeEmail } from "../shared/lib/normalizeEmail";

const sendOtpEmailRef = makeFunctionReference<"action">("email/sendOtpEmail:sendOtpEmail");
const assertOtpSendAllowedRef = makeFunctionReference<"mutation">("rateLimits:assertOtpSendAllowed");
const recordOtpSendRef = makeFunctionReference<"mutation">("rateLimits:recordOtpSend");

const OTP_MAX_AGE_SECONDS = 10 * 60;

function generateSixDigitOtp(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return (bytes[0]! % 1_000_000).toString().padStart(6, "0");
}

const EmailVerification = Email({
  id: "email-verification",
  maxAge: OTP_MAX_AGE_SECONDS,
  generateVerificationToken: async () => generateSixDigitOtp(),
  sendVerificationRequest: (async (
    params: { identifier: string; token: string; expires: Date },
    ctx: GenericActionCtx<Record<string, never>>,
  ) => {
    const { identifier, token, expires } = params;
    await ctx.runMutation(assertOtpSendAllowedRef, { email: identifier });
    await ctx.runAction(sendOtpEmailRef, {
      email: identifier,
      code: token,
      expiresAt: expires.getTime(),
    });
    await ctx.runMutation(recordOtpSendRef, { email: identifier });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any,
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      id: "password",
      profile(params) {
        const email = normalizeEmail(String(params.email ?? ""));
        if (!email || !isValidEmailSyntax(email)) {
          throw new ConvexError("Enter a valid email address.");
        }
        return { email };
      },
      validatePasswordRequirements,
      verify: EmailVerification,
    }),
  ],
  signIn: {
    maxFailedAttempsPerHour: 5,
  },
});
