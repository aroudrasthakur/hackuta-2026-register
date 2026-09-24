import { retrieveAccount } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { PASSWORD_REUSE_MESSAGE } from "../../shared/auth/passwordResetMessages";
import { normalizeEmail } from "./normalizeEmail";

type RetrieveAccountCtx = Parameters<typeof retrieveAccount>[0];

/** Reject password reset when the new password matches the current hash. */
export async function assertPasswordNotReused(
  ctx: RetrieveAccountCtx,
  provider: string,
  email: string,
  newPassword: string,
) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const match = await retrieveAccount(ctx, {
    provider,
    account: { id: normalized, secret: newPassword },
  });
  if (match !== null) {
    throw new ConvexError(PASSWORD_REUSE_MESSAGE);
  }
}
