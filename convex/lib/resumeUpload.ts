import type { GenericId } from "convex/values";
import type { AuthCtx } from "./auth";

export const RESUME_UPLOAD_EXPIRY_MS = 30 * 60 * 1000;

type UploadSession = {
  _id: GenericId<"resumeUploadSessions">;
  token: string;
  storageId?: GenericId<"_storage">;
  createdAt: number;
  verifiedAt?: number;
  consumedAt?: number;
};

export function isVerifiedUploadSessionValid(
  session: UploadSession | null,
  storageId: GenericId<"_storage">,
  now: number,
): session is UploadSession & { storageId: GenericId<"_storage">; verifiedAt: number } {
  return !!(
    session &&
    !session.consumedAt &&
    session.storageId === storageId &&
    session.verifiedAt &&
    session.createdAt >= now - RESUME_UPLOAD_EXPIRY_MS
  );
}

export async function findUploadSessionByToken(ctx: AuthCtx, uploadToken: string) {
  return ctx.db
    .query("resumeUploadSessions")
    .withIndex("by_token", (q) => q.eq("token", uploadToken))
    .first();
}
