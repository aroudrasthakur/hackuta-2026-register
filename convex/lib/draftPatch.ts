import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  GenericMutationCtx,
} from "convex/server";
import {
  mergeDraftPatchIntoProfile,
  type DraftPatchPayload,
} from "../../shared/registration/draftPatch";
import type schema from "../schema";

type DataModel = DataModelFromSchemaDefinition<typeof schema>;
type ProfileDoc = DocumentByName<DataModel, "profiles">;
type MutationCtx = GenericMutationCtx<DataModel>;

export { mergeDraftPatchIntoProfile };

export async function replaceProfileWithDraftPatch(
  ctx: MutationCtx,
  profile: ProfileDoc,
  patch: DraftPatchPayload,
  meta: {
    email: string;
    emailVerificationTime?: number;
    updatedAt: number;
  },
) {
  const replacement = mergeDraftPatchIntoProfile(profile, patch, meta);
  await ctx.db.replace(profile._id, replacement);
}
