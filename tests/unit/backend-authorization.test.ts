import { PDFDocument } from "pdf-lib";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import type { GenericId } from "convex/values";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../convex/schema";
import { lookupOtpSendStatus } from "../../convex/lib/otpSendStatus";
import { RESUME_UPLOAD_BUCKET } from "../../convex/lib/rateLimitBuckets";
import { formToDraftPatch } from "../../shared/registration/draftMapping";
import { RESUME_FILENAME_HEADER, RESUME_TEST_CONTENT_LENGTH_HEADER } from "../../shared/registration/resume";
import { INITIAL_FORM } from "../../shared/registration/types";
import { validRegistrationPayload } from "../fixtures/validRegistrationForm";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

// Loaded through runtime paths so the web tsconfig does not type-check these Convex sources
// (they depend on the full auth schema types and are compiled under convex/tsconfig.json).
const applicationsModule = "../../convex/lib/applications";
const resumeUploadModule = "../../convex/lib/resumeUpload";
const { formatApplicantFullName } = (await import(/* @vite-ignore */ applicationsModule)) as {
  formatApplicantFullName: (fields: { firstName?: string | null; lastName?: string | null }) => string | null;
};
const { RESUME_UPLOAD_EXPIRY_MS } = (await import(/* @vite-ignore */ resumeUploadModule)) as {
  RESUME_UPLOAD_EXPIRY_MS: number;
};
const createTest = () => convexTest(schema, modules);
type TestInstance = ReturnType<typeof createTest>;

const ref = {
  ensureApplicantApplication: makeFunctionReference<"mutation">("applicant:ensureApplicantApplication"),
  routingState: makeFunctionReference<"query">("applicant:getApplicantRoutingState"),
  getDraft: makeFunctionReference<"query">("applications:getMyApplicationDraft"),
  saveDraft: makeFunctionReference<"mutation">("applications:saveApplicationDraft"),
  dashboard: makeFunctionReference<"query">("applications:getMyApplicantDashboard"),
  register: makeFunctionReference<"mutation">("registrations:register"),
  discardUpload: makeFunctionReference<"mutation">("resumeUploads:discardUploadSession"),
  createUploadSession: makeFunctionReference<"mutation">("resumeUploads:createVerifiedUploadSession"),
  cleanupUploads: makeFunctionReference<"mutation">("resumeUploads:cleanupExpiredUploadSessions"),
  resetAllData: makeFunctionReference<"mutation">("maintenance:resetAllData"),
  migrateFirstHackathon: makeFunctionReference<"mutation">(
    "migrations:migrateFirstHackathonToHackathonsAttended",
  ),
  stripHackathonIds: makeFunctionReference<"mutation">("migrations:stripLegacyApplicationHackathonIds"),
  stripCheckInAndConfirmedAt: makeFunctionReference<"mutation">(
    "migrations:stripLegacyApplicationCheckInAndConfirmedAt",
  ),
  publicEventConfig: makeFunctionReference<"query">("eventConfig:getPublicEventConfig"),
  hackathonNameInternal: makeFunctionReference<"query">("eventConfig:getHackathonNameInternal"),
  setHackathonName: makeFunctionReference<"mutation">("eventConfig:setHackathonName"),
};

const TEST_ORIGIN = "https://hackuta.test";

async function seedUser(
  t: Pick<TestInstance, "run">,
  fields: { email?: string; name?: string; emailVerificationTime?: number } = {
    email: "applicant@example.com",
    emailVerificationTime: 1,
  },
) {
  return t.run((ctx) => ctx.db.insert("users", fields));
}

function asUser(t: TestInstance, userId: GenericId<"users">, email?: string) {
  return t.withIdentity({ subject: userId, tokenIdentifier: `user|${userId}`, ...(email ? { email } : {}) });
}

async function storePdf(t: Pick<TestInstance, "run">) {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  const bytes = await pdf.save();
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob([bytes as BlobPart], { type: "application/pdf" })));
  await t.run((ctx) =>
    (ctx.db.patch as unknown as (id: string, value: { contentType: string }) => Promise<void>)(storageId, {
      contentType: "application/pdf",
    }),
  );
  return { storageId, bytes };
}

async function insertApplication(
  t: Pick<TestInstance, "run">,
  authUserId: GenericId<"users">,
  fields: Record<string, unknown> = {},
) {
  return t.run((ctx) =>
    ctx.db.insert("applications", {
      authUserId,
      email: "applicant@example.com",
      status: "draft",
      eligibilityStatus: "unreviewed",
      createdAt: 1,
      updatedAt: 1,
      ...fields,
    } as never),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("authorization boundaries", () => {
  it("returns no draft and unauthenticated routing for anonymous callers", async () => {
    const t = createTest();
    await expect(t.query(ref.getDraft, {})).resolves.toBeNull();
    await expect(t.query(ref.routingState, {})).resolves.toMatchObject({ authenticated: false });
  });

  it("rejects anonymous dashboard, draft save, and profile bootstrap", async () => {
    const t = createTest();
    await expect(t.query(ref.dashboard, {})).rejects.toThrow("Authentication required.");
    await expect(t.mutation(ref.saveDraft, { patch: formToDraftPatch(INITIAL_FORM) })).rejects.toThrow(
      "Authentication required.",
    );
    await expect(t.mutation(ref.ensureApplicantApplication, {})).rejects.toThrow("Authentication required.");
  });

  it("treats an identity for a deleted user with no email as signed out", async () => {
    const t = createTest();
    const userId = await seedUser(t);
    await t.run((ctx) => ctx.db.delete(userId));
    await expect(asUser(t, userId).query(ref.routingState, {})).resolves.toMatchObject({
      authenticated: false,
    });
  });

  it("falls back to the identity email when the subject does not resolve to a user", async () => {
    const t = createTest();
    const userId = await seedUser(t, { email: "fallback@example.com", emailVerificationTime: 1 });
    const identity = t.withIdentity({ tokenIdentifier: "email|fallback", email: " Fallback@Example.com " });
    await expect(identity.query(ref.routingState, {})).resolves.toMatchObject({
      authenticated: true,
      verifiedEmail: "fallback@example.com",
    });
    expect(userId).toBeTruthy();
  });

  it("requires an email on the auth user before creating a profile", async () => {
    const t = createTest();
    const userId = await seedUser(t, { emailVerificationTime: 1 });
    await expect(asUser(t, userId).mutation(ref.ensureApplicantApplication, {})).rejects.toThrow(
      "A verified email is required.",
    );
  });

  it("rejects submission for a verified user whose account has no email", async () => {
    const t = createTest();
    const userId = await seedUser(t, { emailVerificationTime: 1 });
    await expect(
      asUser(t, userId).mutation(ref.register, { data: validRegistrationPayload() }),
    ).rejects.toThrow("Authentication required.");
  });

  it("never lets one applicant discard another applicant's upload", async () => {
    const t = createTest();
    const owner = await seedUser(t, { email: "owner@example.com", emailVerificationTime: 1 });
    const other = await seedUser(t, { email: "other@example.com", emailVerificationTime: 1 });
    const { storageId } = await storePdf(t);
    await t.run((ctx) =>
      ctx.db.insert("resumeUploadSessions", {
        token: "owner-token",
        authUserId: owner,
        storageId,
        createdAt: Date.now(),
        verifiedAt: Date.now(),
      }),
    );

    await expect(asUser(t, other).mutation(ref.discardUpload, { uploadToken: "owner-token" })).resolves.toEqual({
      ok: true,
    });
    expect(await t.run((ctx) => ctx.db.query("resumeUploadSessions").collect())).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).not.toBeNull();
  });

  it("keeps an attached resume when its upload session is discarded", async () => {
    const t = createTest();
    const owner = await seedUser(t);
    const { storageId } = await storePdf(t);
    await insertApplication(t, owner, { resumeStorageId: storageId });
    await t.run((ctx) =>
      ctx.db.insert("resumeUploadSessions", {
        token: "attached-token",
        authUserId: owner,
        storageId,
        createdAt: Date.now(),
      }),
    );

    await asUser(t, owner).mutation(ref.discardUpload, { uploadToken: "attached-token" });
    expect(await t.run((ctx) => ctx.db.query("resumeUploadSessions").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).not.toBeNull();
  });

  it("treats unknown discard tokens as a no-op", async () => {
    const t = createTest();
    const owner = await seedUser(t);
    await expect(asUser(t, owner).mutation(ref.discardUpload, { uploadToken: "missing" })).resolves.toEqual({
      ok: true,
    });
  });
});

describe("profile lifecycle", () => {
  it("backfills email verification onto an existing draft profile", async () => {
    const t = createTest();
    const userId = await seedUser(t, { email: "late@example.com" });
    const client = asUser(t, userId);
    await client.mutation(ref.ensureApplicantApplication, {});
    expect((await t.run((ctx) => ctx.db.query("applications").first()))?.emailVerificationTime).toBeUndefined();

    await t.run((ctx) => ctx.db.patch(userId, { emailVerificationTime: 1234 }));
    const again = await client.mutation(ref.ensureApplicantApplication, {});
    expect(again).toMatchObject({ status: "draft" });
    const applications = await t.run((ctx) => ctx.db.query("applications").collect());
    expect(applications).toHaveLength(1);
    expect(applications[0]?.emailVerificationTime).toBe(1234);
  });

  it("does not rewrite the profile when verification is unchanged", async () => {
    const t = createTest();
    const userId = await seedUser(t);
    const client = asUser(t, userId);
    await client.mutation(ref.ensureApplicantApplication, {});
    const before = await t.run((ctx) => ctx.db.query("applications").first());
    await client.mutation(ref.ensureApplicantApplication, {});
    const after = await t.run((ctx) => ctx.db.query("applications").first());
    expect(after?.updatedAt).toBe(before?.updatedAt);
  });

  it("syncs, updates, and clears the auth display name from draft names", async () => {
    const t = createTest();
    const userId = await seedUser(t);
    const client = asUser(t, userId);

    await client.mutation(ref.saveDraft, {
      patch: formToDraftPatch({ ...INITIAL_FORM, firstName: "Sam", lastName: "Test" }),
    });
    expect((await t.run((ctx) => ctx.db.get(userId)))?.name).toBe("Sam Test");

    await client.mutation(ref.saveDraft, {
      patch: formToDraftPatch({ ...INITIAL_FORM, firstName: "Sam", lastName: "" }),
    });
    expect((await t.run((ctx) => ctx.db.get(userId)))?.name).toBe("Sam");

    await client.mutation(ref.saveDraft, { patch: formToDraftPatch(INITIAL_FORM) });
    const cleared = await t.run((ctx) => ctx.db.get(userId));
    expect(cleared).not.toHaveProperty("name");
    expect(cleared?.email).toBe("applicant@example.com");

    await client.mutation(ref.saveDraft, { patch: formToDraftPatch(INITIAL_FORM) });
    expect(await t.run((ctx) => ctx.db.get(userId))).not.toHaveProperty("name");
  });

  it("blocks draft edits after the application is submitted", async () => {
    const t = createTest();
    const userId = await seedUser(t);
    await insertApplication(t, userId, { status: "submitted", formSubmitted: true, submittedAt: 5 });
    await expect(
      asUser(t, userId).mutation(ref.saveDraft, { patch: formToDraftPatch(INITIAL_FORM) }),
    ).rejects.toThrow("Your application has already been submitted.");
  });

  it("reports submitted routing state from either submission marker", async () => {
    const t = createTest();
    const userId = await seedUser(t);
    await insertApplication(t, userId, { status: "draft", submittedAt: 5 });
    await expect(asUser(t, userId).query(ref.routingState, {})).resolves.toMatchObject({
      hasSubmittedRegistration: true,
    });
  });

  it("reports a draft profile as not yet submitted", async () => {
    const t = createTest();
    const userId = await seedUser(t);
    await insertApplication(t, userId);
    await expect(asUser(t, userId).query(ref.routingState, {})).resolves.toMatchObject({
      hasSubmittedRegistration: false,
    });
  });

  it("derives the dashboard display name from profile, account, then identity", async () => {
    const t = createTest();
    const userId = await seedUser(t, { email: "name@example.com", name: "Account Name", emailVerificationTime: 1 });

    const noProfile = (await asUser(t, userId).query(ref.dashboard, {})) as {
      profile: { displayName: string | null };
      registration: unknown;
    };
    expect(noProfile.profile.displayName).toBe("Account Name");
    expect(noProfile.registration).toBeNull();

    await insertApplication(t, userId, { firstName: "Profile", lastName: "Name" });
    const withProfile = (await asUser(t, userId).query(ref.dashboard, {})) as {
      profile: { displayName: string | null };
    };
    expect(withProfile.profile.displayName).toBe("Profile Name");

    const identityOnly = (await t
      .withIdentity({ tokenIdentifier: "x", name: "Identity Name", email: "nobody@example.com" })
      .query(ref.dashboard, {})) as { profile: { displayName: string | null; verifiedEmail: string | null } };
    expect(identityOnly.profile).toEqual({ displayName: "Identity Name", verifiedEmail: "nobody@example.com" });

    const anonymousish = (await t.withIdentity({ tokenIdentifier: "y" }).query(ref.dashboard, {})) as {
      profile: { displayName: string | null; verifiedEmail: string | null };
    };
    expect(anonymousish.profile).toEqual({ displayName: null, verifiedEmail: null });
  });

  it.each([
    [{ firstName: " Sam ", lastName: " Test " }, "Sam Test"],
    [{ firstName: "Sam", lastName: "  " }, "Sam"],
    [{ firstName: null, lastName: "Test" }, "Test"],
    [{}, null],
  ])("formats full name %j", (fields, expected) => {
    expect(formatApplicantFullName(fields)).toBe(expected);
  });
});

describe("registration resume replacement", () => {
  it("replaces a previously attached resume and deletes the old file", async () => {
    const t = createTest();
    const userId = await seedUser(t);
    const oldResume = await storePdf(t);
    const newResume = await storePdf(t);
    await insertApplication(t, userId, { resumeStorageId: oldResume.storageId });
    await t.run((ctx) =>
      ctx.db.insert("resumeUploadSessions", {
        token: "new-token",
        authUserId: userId,
        storageId: newResume.storageId,
        createdAt: Date.now(),
        verifiedAt: Date.now(),
      }),
    );

    await expect(
      asUser(t, userId).mutation(ref.register, {
        data: { ...validRegistrationPayload(), resumeStorageId: newResume.storageId },
        resumeUploadToken: "new-token",
      }),
    ).resolves.toMatchObject({ ok: true, isNew: false });

    expect(await t.run((ctx) => ctx.db.system.get("_storage", oldResume.storageId))).toBeNull();
    expect((await t.run((ctx) => ctx.db.query("applications").first()))?.resumeStorageId).toBe(newResume.storageId);
    await t.finishInProgressScheduledFunctions();
  });

  it("rejects a malformed storage id as an invalid resume", async () => {
    const t = createTest();
    const userId = await seedUser(t);
    await expect(
      asUser(t, userId).mutation(ref.register, {
        data: { ...validRegistrationPayload(), resumeStorageId: "not-a-storage-id" },
        resumeUploadToken: "anything",
      }),
    ).rejects.toThrow("Please upload a valid PDF resume of 2 MB or smaller.");
  });
});

describe("resume upload sessions", () => {
  it("refuses duplicate tokens, missing files, and empty files", async () => {
    const t = createTest();
    const userId = await seedUser(t);
    const { storageId } = await storePdf(t);
    const empty = await t.run((ctx) => ctx.storage.store(new Blob([])));

    await t.mutation(ref.createUploadSession, { uploadToken: "tok", storageId, authUserId: userId });
    await expect(
      t.mutation(ref.createUploadSession, { uploadToken: "tok", storageId, authUserId: userId }),
    ).rejects.toThrow("Invalid resume upload.");
    await expect(
      t.mutation(ref.createUploadSession, { uploadToken: "empty", storageId: empty, authUserId: userId }),
    ).rejects.toThrow("Invalid resume upload.");

    await t.run((ctx) => ctx.storage.delete(storageId));
    await expect(
      t.mutation(ref.createUploadSession, { uploadToken: "gone", storageId, authUserId: userId }),
    ).rejects.toThrow("Invalid resume upload.");
  });

  it("reschedules cleanup when a full page of expired records is found", async () => {
    const t = createTest();
    const old = Date.now() - RESUME_UPLOAD_EXPIRY_MS - 60_000;
    await t.run(async (ctx) => {
      for (let i = 0; i < 101; i += 1) {
        await ctx.db.insert("rateLimits", { bucket: RESUME_UPLOAD_BUCKET, key: `k${i}`, createdAt: old });
      }
    });

    vi.useFakeTimers();
    try {
      await t.mutation(ref.cleanupUploads, {});
      expect(await t.run((ctx) => ctx.db.query("rateLimits").collect())).toHaveLength(1);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    } finally {
      vi.useRealTimers();
    }
    expect(await t.run((ctx) => ctx.db.query("rateLimits").collect())).toHaveLength(0);
  });
});

describe("resume upload HTTP failure handling", () => {
  async function uploadAs(t: TestInstance, userId: GenericId<"users">, headers: Record<string, string>, body: BodyInit) {
    return asUser(t, userId).fetch("/resume-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        Origin: TEST_ORIGIN,
        "X-Test-Origin": TEST_ORIGIN,
        [RESUME_FILENAME_HEADER]: "resume.pdf",
        ...headers,
      },
      body,
    });
  }

  it("rejects non-numeric Content-Length values with 400", async () => {
    const t = createTest();
    const userId = await seedUser(t);
    const result = await uploadAs(t, userId, { [RESUME_TEST_CONTENT_LENGTH_HEADER]: "abc" }, "%PDF-");
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({ error: "Invalid upload request." });
  });

  it("deletes the stored file and returns 500 when the upload session cannot be created", async () => {
    const t = createTest();
    const userId = await seedUser(t);
    const pdf = await PDFDocument.create();
    pdf.addPage([612, 792]);
    const bytes = new Uint8Array(await pdf.save());

    const collidingToken = "00".repeat(32);
    await t.run((ctx) =>
      ctx.db.insert("resumeUploadSessions", { token: collidingToken, authUserId: userId, createdAt: Date.now() }),
    );
    const realGetRandomValues = crypto.getRandomValues.bind(crypto);
    vi.spyOn(crypto, "getRandomValues").mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint8Array && array.length === 32) {
        array.fill(0);
        return array;
      }
      return realGetRandomValues(array as never) as T;
    });

    const result = await uploadAs(t, userId, { [RESUME_TEST_CONTENT_LENGTH_HEADER]: String(bytes.byteLength) }, bytes);
    expect(result.status).toBe(500);
    expect(await result.json()).toEqual({ error: "The resume could not be stored." });
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toEqual([]);
  });

  it("only trusts the test origin when no allow-list is configured", async () => {
    vi.stubEnv("REGISTRATION_ALLOWED_ORIGINS", "");
    vi.stubEnv("SITE_URL", "");
    const t = createTest();
    const allowed = await t.fetch("/resume-upload", {
      method: "OPTIONS",
      headers: { "X-Test-Origin": TEST_ORIGIN },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(TEST_ORIGIN);

    const denied = await t.fetch("/resume-upload", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" },
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("event config", () => {
  it("serves the default name internally and rejects blank renames", async () => {
    const t = createTest();
    await expect(t.query(ref.hackathonNameInternal, {})).resolves.toBe("HackUTA 2026");
    await expect(t.mutation(ref.setHackathonName, { name: "   " })).rejects.toThrow(
      "Hackathon name is required.",
    );
    await expect(t.mutation(ref.setHackathonName, { name: "  HackUTA 8  " })).resolves.toMatchObject({
      ok: true,
      name: "HackUTA 8",
    });
    await expect(t.query(ref.hackathonNameInternal, {})).resolves.toBe("HackUTA 8");
    await expect(t.query(ref.publicEventConfig, {})).resolves.toEqual({ name: "HackUTA 8" });
  });
});

describe("maintenance and migrations", () => {
  it("wipes every application and auth table plus stored files, across multiple pages", async () => {
    const t = createTest();
    const userId = await seedUser(t);
    await insertApplication(t, userId);
    await storePdf(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 205; i += 1) {
        await ctx.db.insert("rateLimits", { bucket: "b", key: `k${i}`, createdAt: i });
      }
      const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: 1 });
      await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: 1 });
      await ctx.db.insert("resumeUploadSessions", { token: "t", authUserId: userId, createdAt: 1 });
    });
    await t.run(async (ctx) => {
      for (let i = 0; i < 100; i += 1) {
        await ctx.storage.store(new Blob([`file-${i}`]));
      }
    });

    await expect(t.mutation(ref.resetAllData, {})).resolves.toEqual({ ok: true });

    await t.run(async (ctx) => {
      for (const table of [
        "applications",
        "rateLimits",
        "users",
        "authSessions",
        "authRefreshTokens",
        "resumeUploadSessions",
      ] as const) {
        expect(await ctx.db.query(table).collect()).toHaveLength(0);
      }
      expect(await ctx.db.system.query("_storage").collect()).toHaveLength(0);
    });
  }, 30_000);

  it("strips legacy checkedInAt and confirmedAt fields from applications", async () => {
    const looseSchema = Object.assign(Object.create(Object.getPrototypeOf(schema)), schema, {
      schemaValidation: false,
    }) as typeof schema;
    const t = convexTest(looseSchema, modules);
    const userId = await seedUser(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("applications", {
        authUserId: userId,
        email: "legacy-checkin@example.com",
        status: "accepted",
        eligibilityStatus: "eligible",
        createdAt: 1,
        updatedAt: 1,
        checkedInAt: 2,
        confirmedAt: 3,
      } as never);
      await ctx.db.insert("applications", {
        authUserId: userId,
        email: "clean@example.com",
        status: "submitted",
        eligibilityStatus: "unreviewed",
        createdAt: 4,
        updatedAt: 4,
      });
    });

    await expect(t.mutation(ref.stripCheckInAndConfirmedAt, {})).resolves.toEqual({
      ok: true,
      updated: 1,
    });

    const applications = await t.run((ctx) => ctx.db.query("applications").collect());
    expect(applications.some((application) => "checkedInAt" in application)).toBe(false);
    expect(applications.some((application) => "confirmedAt" in application)).toBe(false);
    expect(applications.find((application) => application.email === "clean@example.com")?.status).toBe(
      "submitted",
    );

    await expect(t.mutation(ref.stripCheckInAndConfirmedAt, {})).resolves.toEqual({
      ok: true,
      updated: 0,
    });
  }, 30_000);

  it("migrates legacy firstHackathon answers to hackathonsAttended and removes the legacy field", async () => {
    const looseSchema = Object.assign(Object.create(Object.getPrototypeOf(schema)), schema, {
      schemaValidation: false,
    }) as typeof schema;
    const t = convexTest(looseSchema, modules);
    const userId = await seedUser(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("applications", {
        authUserId: userId,
        email: "first-timer@example.com",
        status: "submitted",
        eligibilityStatus: "unreviewed",
        createdAt: 1,
        updatedAt: 1,
        firstHackathon: true,
      } as never);
      await ctx.db.insert("applications", {
        authUserId: userId,
        email: "returning@example.com",
        status: "submitted",
        eligibilityStatus: "unreviewed",
        createdAt: 2,
        updatedAt: 2,
        firstHackathon: false,
      } as never);
      await ctx.db.insert("applications", {
        authUserId: userId,
        email: "already-migrated@example.com",
        status: "draft",
        eligibilityStatus: "unreviewed",
        createdAt: 3,
        updatedAt: 3,
        hackathonsAttended: 5,
      });
    });

    await expect(t.mutation(ref.migrateFirstHackathon, {})).resolves.toEqual({
      ok: true,
      updated: 2,
    });

    const applications = await t.run((ctx) => ctx.db.query("applications").collect());
    expect(applications.some((application) => "firstHackathon" in application)).toBe(false);
    expect(
      applications.find((application) => application.email === "first-timer@example.com")
        ?.hackathonsAttended,
    ).toBe(0);
    expect(
      applications.find((application) => application.email === "returning@example.com")
        ?.hackathonsAttended,
    ).toBe(1);
    expect(
      applications.find((application) => application.email === "already-migrated@example.com")
        ?.hackathonsAttended,
    ).toBe(5);

    await expect(t.mutation(ref.migrateFirstHackathon, {})).resolves.toEqual({
      ok: true,
      updated: 0,
    });
  }, 30_000);

  it("strips legacy hackathonId fields across applications and leaves others untouched", async () => {
    const looseSchema = Object.assign(Object.create(Object.getPrototypeOf(schema)), schema, {
      schemaValidation: false,
    }) as typeof schema;
    const t = convexTest(looseSchema, modules);
    const userId = await seedUser(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 105; i += 1) {
        await ctx.db.insert("applications", {
          authUserId: userId,
          email: `p${i}@example.com`,
          status: "draft",
          eligibilityStatus: "unreviewed",
          createdAt: i,
          updatedAt: i,
          ...(i % 50 === 0 ? { hackathonId: "hackuta-2025" } : {}),
        } as never);
      }
    });

    await expect(t.mutation(ref.stripHackathonIds, {})).resolves.toEqual({ ok: true, updated: 3 });
    const applications = await t.run((ctx) => ctx.db.query("applications").collect());
    expect(applications).toHaveLength(105);
    expect(applications.some((application) => "hackathonId" in application)).toBe(false);
    expect(applications.find((application) => application.email === "p50@example.com")?.createdAt).toBe(50);

    await expect(t.mutation(ref.stripHackathonIds, {})).resolves.toEqual({ ok: true, updated: 0 });
  }, 30_000);
});

describe("lookupOtpSendStatus", () => {
  it("short-circuits blank emails without touching the database", async () => {
    const db = { query: vi.fn() };
    await expect(lookupOtpSendStatus({ db } as never, "  ")).resolves.toEqual({
      waitSeconds: 0,
      hourlyLimitReached: false,
    });
    expect(db.query).not.toHaveBeenCalled();
  });
});
