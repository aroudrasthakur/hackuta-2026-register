import { Email } from "@convex-dev/auth/providers/Email";
import { convexAuth } from "@convex-dev/auth/server";
import { HackutaPassword } from "./lib/hackutaPassword";
import { getClientAddressFromMeta } from "./lib/clientAddress";
import type { GenericActionCtx } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { validatePasswordRequirements } from "../shared/auth/password";
import { isValidEmailSyntax, normalizeEmail } from "../shared/lib/normalizeEmail";

const sendOtpEmailRef = makeFunctionReference<"action">("email/sendOtpEmail:sendOtpEmail");
const sendPasswordResetEmailRef = makeFunctionReference<"action">(
  "email/sendPasswordResetEmail:sendPasswordResetEmail",
);
const consumeOtpSendRequestRef = makeFunctionReference<"mutation">(
  "rateLimits:consumeOtpSendRequest",
);

const OTP_MAX_AGE_SECONDS = 10 * 60;

function generateSixDigitOtp(): string {
  const max = 1_000_000;
  const unbiasedLimit = Math.floor(0x1_0000_0000 / max) * max;
  let value: number;
  do {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    value = bytes[0]!;
  } while (value >= unbiasedLimit);
  return (value % max).toString().padStart(6, "0");
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
    await ctx.runMutation(consumeOtpSendRequestRef, {
      email: identifier,
      clientAddress: await getClientAddressFromMeta(ctx),
    });
    await ctx.runAction(sendOtpEmailRef, {
      email: identifier,
      code: token,
      expiresAt: expires.getTime(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any,
});

const PasswordResetEmail = Email({
  id: "password-reset",
  maxAge: OTP_MAX_AGE_SECONDS,
  generateVerificationToken: async () => generateSixDigitOtp(),
  sendVerificationRequest: (async (
    params: { identifier: string; token: string; expires: Date },
    ctx: GenericActionCtx<Record<string, never>>,
  ) => {
    const { identifier, token, expires } = params;
    await ctx.runAction(sendPasswordResetEmailRef, {
      email: identifier,
      code: token,
      expiresAt: expires.getTime(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any,
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    HackutaPassword({
      id: "password",
      profile(params: Record<string, unknown>) {
        const email = normalizeEmail(String(params.email ?? ""));
        if (!email || !isValidEmailSyntax(email)) {
          throw new ConvexError("Enter a valid email address.");
        }
        return { email };
      },
      validatePasswordRequirements,
      verify: EmailVerification,
      reset: PasswordResetEmail,
    }),
  ],
  signIn: {
    maxFailedAttempsPerHour: 5,
  },
});
