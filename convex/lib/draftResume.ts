import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  GenericMutationCtx,
} from "convex/server";
import type { GenericId } from "convex/values";
import { MAX_RESUME_BYTES } from "../../shared/registration/resume";
import type { DraftPatchPayload } from "../../shared/registration/draftPatch";
import type schema from "../schema";
import { findApplicationByResume } from "./applications";
import {
  isVerifiedUploadSessionValid,
  uploadSessionOwnedByUser,
} from "./resumeUpload";

type DataModel = DataModelFromSchemaDefinition<typeof schema>;
type ApplicationDoc = DocumentByName<DataModel, "applications">;
type MutationCtx = GenericMutationCtx<DataModel>;
type StorageId = GenericId<"_storage">;

export async function prepareResumeDraftPatch(
  ctx: MutationCtx,
  application: ApplicationDoc,
  patch: Pick<DraftPatchPayload, "resumeStorageId" | "resumeFilename">,
  authUserId: GenericId<"users">,
): Promise<{ deleteStorageId?: StorageId }> {
  if (!("resumeStorageId" in patch)) {
    return {};
  }

  if (patch.resumeStorageId === null) {
    return application.resumeStorageId
      ? { deleteStorageId: application.resumeStorageId }
      : {};
  }

  if (patch.resumeStorageId === undefined) {
    return {};
  }

  const nextStorageId = ctx.db.system.normalizeId("_storage", patch.resumeStorageId);
  if (!nextStorageId) {
    throw new Error("Please upload a valid PDF resume of 2 MB or smaller.");
  }

  if (nextStorageId === application.resumeStorageId) {
    return {};
  }

  const metadata = await ctx.db.system.get("_storage", nextStorageId);
  if (
    !metadata ||
    metadata.contentType !== "application/pdf" ||
    metadata.size === 0 ||
    metadata.size > MAX_RESUME_BYTES
  ) {
    throw new Error("Please upload a valid PDF resume of 2 MB or smaller.");
  }

  const attachment = await findApplicationByResume(ctx, nextStorageId);
  if (attachment && attachment._id !== application._id) {
    throw new Error("This resume is already attached to another application.");
  }

  if (attachment?._id !== application._id) {
    const session = await ctx.db
      .query("resumeUploadSessions")
      .withIndex("by_storage", (q) => q.eq("storageId", nextStorageId))
      .first();
    const now = Date.now();
    if (
      !uploadSessionOwnedByUser(session, authUserId) ||
      !isVerifiedUploadSessionValid(session, nextStorageId, now)
    ) {
      throw new Error("Your resume upload expired. Please upload your resume again.");
    }
  }

  return application.resumeStorageId
    ? { deleteStorageId: application.resumeStorageId }
    : {};
}
