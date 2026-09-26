/** Read the caller IP from Convex request metadata when available. */
export async function getClientAddressFromMeta(ctx: {
  meta?: {
    getRequestMetadata(): Promise<{ ip?: string | null }>;
  };
}): Promise<string | undefined> {
  try {
    if (!ctx.meta?.getRequestMetadata) {
      return undefined;
    }
    const { ip } = await ctx.meta.getRequestMetadata();
    return ip ?? undefined;
  } catch {
    return undefined;
  }
}
