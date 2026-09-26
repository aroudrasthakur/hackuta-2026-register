import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../../convex/schema";
import { AUTH_SEND_IP_HOURLY_LIMIT } from "../../convex/lib/authSendRateLimits";
import {
  OTP_SEND_IP_BUCKET,
  PASSWORD_RESET_SEND_IP_BUCKET,
} from "../../convex/lib/rateLimitBuckets";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

const consumeOtpSendRequest = makeFunctionReference<"mutation">(
  "rateLimits:consumeOtpSendRequest",
);
const consumePasswordResetRequest = makeFunctionReference<"mutation">(
  "rateLimits:consumePasswordResetRequest",
);

describe("auth send IP rate limits", () => {
  it("throttles one IP across many email addresses", async () => {
    const test = convexTest(schema, modules);
    const clientAddress = "203.0.113.50";

    for (let i = 0; i < AUTH_SEND_IP_HOURLY_LIMIT; i++) {
      await test.mutation(consumeOtpSendRequest, {
        email: `user-${i}@example.com`,
        clientAddress,
      });
    }

    await expect(
      test.mutation(consumeOtpSendRequest, {
        email: "another-user@example.com",
        clientAddress,
      }),
    ).rejects.toThrow("Too many verification requests. Please try again later.");

    const ipRows = await test.run((ctx) =>
      ctx.db
        .query("rateLimits")
        .withIndex("by_bucket_key_createdAt", (q) =>
          q.eq("bucket", OTP_SEND_IP_BUCKET).eq("key", `ip:${clientAddress}`),
        )
        .collect(),
    );
    expect(ipRows.length).toBe(AUTH_SEND_IP_HOURLY_LIMIT);
  });

  it("throttles password reset sends for one IP across many email addresses", async () => {
    const test = convexTest(schema, modules);
    const clientAddress = "203.0.113.99";

    for (let i = 0; i < AUTH_SEND_IP_HOURLY_LIMIT; i++) {
      await test.mutation(consumePasswordResetRequest, {
        email: `reset-${i}@example.com`,
        clientAddress,
      });
    }

    await expect(
      test.mutation(consumePasswordResetRequest, {
        email: "reset-overflow@example.com",
        clientAddress,
      }),
    ).rejects.toThrow("Too many verification requests. Please try again later.");

    const ipRows = await test.run((ctx) =>
      ctx.db
        .query("rateLimits")
        .withIndex("by_bucket_key_createdAt", (q) =>
          q.eq("bucket", PASSWORD_RESET_SEND_IP_BUCKET).eq("key", `ip:${clientAddress}`),
        )
        .collect(),
    );
    expect(ipRows.length).toBe(AUTH_SEND_IP_HOURLY_LIMIT);
  });
});
