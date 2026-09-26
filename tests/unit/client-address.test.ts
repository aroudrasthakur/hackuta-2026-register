import { describe, expect, it } from "vitest";
import { getClientAddressFromMeta } from "../../convex/lib/clientAddress";

describe("getClientAddressFromMeta", () => {
  it("returns the IP from request metadata", async () => {
    await expect(
      getClientAddressFromMeta({
        meta: {
          getRequestMetadata: async () => ({ ip: "203.0.113.50" }),
        },
      }),
    ).resolves.toBe("203.0.113.50");
  });

  it("returns undefined when metadata is unavailable", async () => {
    await expect(getClientAddressFromMeta({})).resolves.toBeUndefined();
    await expect(
      getClientAddressFromMeta({
        meta: { getRequestMetadata: async () => ({ ip: null }) },
      }),
    ).resolves.toBeUndefined();
  });

  it("returns undefined when metadata lookup throws", async () => {
    await expect(
      getClientAddressFromMeta({
        meta: {
          getRequestMetadata: async () => {
            throw new Error("unsupported");
          },
        },
      }),
    ).resolves.toBeUndefined();
  });
});
