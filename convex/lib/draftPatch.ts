import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  GenericMutationCtx,
} from "convex/server";
import {
  mergeDraftPatchIntoApplication,
  type DraftPatchPayload,
} from "../../shared/registration/draftPatch";
import type schema from "../schema";
import { getAuthUser } from "./applications";
import { prepareResumeDraftPatch } from "./draftResume";

type DataModel = DataModelFromSchemaDefinition<typeof schema>;
type ApplicationDoc = DocumentByName<DataModel, "applications">;
type MutationCtx = GenericMutationCtx<DataModel>;

export { mergeDraftPatchIntoApplication };

export async function replaceApplicationWithDraftPatch(
  ctx: MutationCtx,
  application: ApplicationDoc,
  patch: DraftPatchPayload,
  meta: {
    email: string;
    emailVerificationTime?: number;
    updatedAt: number;
  },
) {
  const authUser = await getAuthUser(ctx);
  const resumeCleanup = authUser
    ? await prepareResumeDraftPatch(ctx, application, patch, authUser._id)
    : {};

  const replacement = mergeDraftPatchIntoApplication(application, patch, meta);
  await ctx.db.replace(application._id, replacement);

  if (resumeCleanup.deleteStorageId) {
    await ctx.storage.delete(resumeCleanup.deleteStorageId);
  }
}
