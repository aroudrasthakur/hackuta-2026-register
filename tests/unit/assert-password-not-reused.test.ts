import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertPasswordNotReused } from "../../convex/lib/assertPasswordNotReused";
import { PASSWORD_REUSE_MESSAGE } from "../../shared/auth/passwordResetMessages";

vi.mock("@convex-dev/auth/server", () => ({
  retrieveAccount: vi.fn(),
}));

import { retrieveAccount } from "@convex-dev/auth/server";

describe("assertPasswordNotReused", () => {
  beforeEach(() => {
    vi.mocked(retrieveAccount).mockReset();
  });

  it("throws when the new password matches the current hash", async () => {
    vi.mocked(retrieveAccount).mockResolvedValue({} as never);

    await expect(
      assertPasswordNotReused({} as never, "password", "user@example.com", "Hackuta1"),
    ).rejects.toThrow(new ConvexError(PASSWORD_REUSE_MESSAGE));

    expect(retrieveAccount).toHaveBeenCalledWith({} as never, {
      provider: "password",
      account: { id: "user@example.com", secret: "Hackuta1" },
    });
  });

  it("allows reset when the new password differs", async () => {
    vi.mocked(retrieveAccount).mockResolvedValue(null);

    await expect(
      assertPasswordNotReused({} as never, "password", "user@example.com", "NewPass1"),
    ).resolves.toBeUndefined();
  });

  it("skips lookup for invalid email input", async () => {
    await expect(
      assertPasswordNotReused({} as never, "password", "   ", "NewPass1"),
    ).resolves.toBeUndefined();

    expect(retrieveAccount).not.toHaveBeenCalled();
  });
});
