import { PDFDocument } from "pdf-lib";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import schema from "../../convex/schema";
import { RESUME_UPLOAD_BUCKET } from "../../convex/lib/rateLimitBuckets";
import { formToDraftPatch } from "../../shared/registration/draftPatch";
import { validRegistrationForm, validRegistrationPayload } from "../fixtures/validRegistrationForm";
import { INITIAL_FORM } from "../../shared/registration/types";
import {
  MAX_RESUME_BYTES,
  MAX_RESUME_PAGES,
  RESUME_EMPTY_ERROR_MESSAGE,
  RESUME_FILENAME_HEADER,
  RESUME_MISSING_MESSAGE,
  RESUME_SIZE_ERROR_MESSAGE,
  RESUME_TEST_CONTENT_LENGTH_HEADER,
  RESUME_UPLOAD_EXPIRED_MESSAGE,
} from "../../shared/registration/resume";
import { RESUME_UPLOAD_AUTH_REQUIRED_MESSAGE } from "../../shared/registration/submitErrors";
import { HACKATHON_SCHEDULE } from "../../shared/hackathon/schedule";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });
const assertRateLimit = makeFunctionReference<"mutation">("resumeUploads:assertUploadRateLimit");
const cleanup = makeFunctionReference<"mutation">("resumeUploads:cleanupExpiredUploadSessions");
const migrateMeatPreferences = makeFunctionReference<"mutation">(
  "migrations:migrateEatsBeefAndPorkToDietaryRestrictions",
);

type ConvexTestClient = {
  mutation: (name: string, args: unknown) => Promise<{
    ok: boolean;
    isNew?: boolean;
    userId?: string;
    registrationId?: string;
  }>;
  query: (name: string, args: unknown) => Promise<unknown>;
  withIdentity: (identity: { tokenIdentifier: string; subject?: string; email?: string; name?: string }) => ConvexTestClient;
  run: ReturnType<typeof convexTest>["run"];
  fetch: ReturnType<typeof convexTest>["fetch"];
};

const TEST_ORIGIN = "https://hackuta.test";
const uploadHeaders = {
  "Content-Type": "application/pdf",
  Origin: TEST_ORIGIN,
  "X-Test-Origin": TEST_ORIGIN,
  "X-Forwarded-For": "192.0.2.10",
};

function uploadBodyLength(body: BodyInit) {
  if (body instanceof Uint8Array) return body.byteLength;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (typeof body === "string") return new TextEncoder().encode(body).byteLength;
  return 0;
}

function buildUploadHeaders(body: BodyInit, overrides: Record<string, string> = {}) {
  const length = String(uploadBodyLength(body));
  return {
    ...uploadHeaders,
    [RESUME_TEST_CONTENT_LENGTH_HEADER]: length,
    [RESUME_FILENAME_HEADER]: "resume.pdf",
    ...overrides,
  };
}

const createTest = () => convexTest(schema, modules);
type TestInstance = ReturnType<typeof createTest>;

async function drainScheduledFunctions(client: ConvexTestClient) {
  await (client as unknown as TestInstance).finishInProgressScheduledFunctions();
}

async function seedAuthUser(
  t: ConvexTestClient,
  identity: { email?: string; name?: string } = {},
) {
  const email = identity.email ?? "applicant@example.com";
  await t.run(async (ctx) => {
    const existing = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first();
    if (!existing) {
      await ctx.db.insert("users", {
        email,
        name: identity.name,
        emailVerificationTime: Date.now(),
      });
    }
  });
}

async function authTest(identity: {
  tokenIdentifier?: string;
  subject?: string;
  email?: string;
  name?: string;
} = { email: "applicant@example.com" }) {
  const email = identity.email ?? "applicant@example.com";
  const base = createTest();
  await seedAuthUser(base as unknown as ConvexTestClient, { ...identity, email });
  const userId = await base.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) throw new Error("Expected seeded auth user");
    return user._id;
  });
  const tokenIdentifier = identity.tokenIdentifier ?? `email|${email}`;
  return base.withIdentity({
    ...identity,
    email,
    subject: userId,
    tokenIdentifier,
  }) as unknown as ConvexTestClient;
}

type RunnableTest = Pick<ReturnType<typeof createTest>, "run">;

async function pdfBytes() {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return new Uint8Array(await pdf.save()).buffer as ArrayBuffer;
}

async function pdfBytesWithPageCount(pageCount: number) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    pdf.addPage([612, 792]);
  }
  return new Uint8Array(await pdf.save());
}

/** Pad a minimal valid PDF with comments to an exact byte length. */
async function pdfBytesAtExactly(targetLength: number): Promise<Uint8Array> {
  const base = new Uint8Array(await pdfBytes());
  if (base.byteLength >= targetLength) {
    throw new Error(`Base PDF (${base.byteLength}b) must be smaller than ${targetLength}b`);
  }

  const eofMarker = new TextEncoder().encode("%%EOF");
  let eofIndex = -1;
  for (let index = 0; index <= base.byteLength - eofMarker.length; index += 1) {
    if (eofMarker.every((byte, offset) => base[index + offset] === byte)) {
      eofIndex = index;
    }
  }
  if (eofIndex === -1) {
    throw new Error("PDF missing %%EOF marker");
  }

  const commentPrefix = new TextEncoder().encode("\n% ");
  const commentSuffix = new TextEncoder().encode("\n");
  const insertLength = targetLength - base.byteLength;
  const padLength = insertLength - commentPrefix.byteLength - commentSuffix.byteLength;
  if (padLength < 0) {
    throw new Error("Target length is too small for PDF comment padding");
  }

  const padding = new Uint8Array(padLength);
  padding.fill("0".charCodeAt(0));

  const padded = new Uint8Array(targetLength);
  padded.set(base.subarray(0, eofIndex));
  padded.set(commentPrefix, eofIndex);
  padded.set(padding, eofIndex + commentPrefix.byteLength);
  padded.set(commentSuffix, eofIndex + commentPrefix.byteLength + padLength);
  padded.set(base.subarray(eofIndex), eofIndex + insertLength);
  return padded;
}

async function storeFile(
  t: RunnableTest,
  contents: BlobPart,
  type = "application/pdf",
) {
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob([contents], { type })));
  await t.run((ctx) => (ctx.db.patch as unknown as (
    id: string,
    value: { contentType: string },
  ) => Promise<void>)(storageId, { contentType: type }));
  return storageId;
}

async function ensureTestUserId(t: RunnableTest) {
  return t.run(async (ctx) => {
    const existing = await ctx.db.query("users").first();
    if (existing) return existing._id;
    return ctx.db.insert("users", {
      email: "upload-test@example.com",
      emailVerificationTime: Date.now(),
    });
  });
}

async function verifiedUpload(
  t: RunnableTest,
  token: string = crypto.randomUUID(),
  contents?: BlobPart,
) {
  const storageId = await storeFile(t, contents ?? await pdfBytes());
  const authUserId = await ensureTestUserId(t);
  await t.run((ctx) => ctx.db.insert("resumeUploadSessions", {
    token,
    authUserId,
    storageId,
    createdAt: Date.now(),
    verifiedAt: Date.now(),
  }));
  return { storageId, token };
}

describe("convex registrations", () => {
  it.each([
    [["No Beef"] as const],
    [["No Pork"] as const],
    [["No Beef", "No Pork", "Halal"] as const],
  ])("persists independent dietary restrictions through draft and submission (%j)", async (dietaryRestrictions) => {
    const t = await authTest();
    const answers = {
      countryOfResidence: "Canada" as const,
      internationalStudent: false,
      dietaryRestrictions: [...dietaryRestrictions],
    };
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch({ ...validRegistrationForm(), ...answers }),
    });
    await expect(t.query("applications:getMyApplicationDraft", {})).resolves.toMatchObject({
      draft: answers,
    });
    await t.mutation("registrations:submitRegistration", {
      data: { ...validRegistrationPayload(), ...answers },
    });
    expect(await t.run((ctx) => ctx.db.query("applications").first())).toMatchObject({
      ...answers,
      status: "submitted",
    });
    const dashboard = await t.query("applications:getMyApplicantDashboard", {}) as {
      registration: { answers: Record<string, unknown> };
    };
    expect(dashboard.registration.answers).not.toHaveProperty("stateOfResidence");
    expect(dashboard.registration.answers.dietaryRestrictions).toEqual(answers.dietaryRestrictions);
    expect(dashboard.registration.answers).not.toHaveProperty("internationalStudent");
    expect(dashboard.registration.answers).not.toHaveProperty("eatsBeef");
    expect(dashboard.registration.answers).not.toHaveProperty("eatsPork");
    await drainScheduledFunctions(t);
  });

  it("persists application questions and hackathonsAttended through draft, submission, and dashboard", async () => {
    const t = await authTest();
    const answers = {
      builtOrWantToBuild: "Built a campus events app with React and Convex.",
      shortDeadlineLearning: "Learned GitHub Actions in one night before a demo.",
      hackathonsAttended: "2",
      experienceLevel: "Advanced" as const,
    };
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch({ ...validRegistrationForm(), ...answers }),
    });
    await expect(t.query("applications:getMyApplicationDraft", {})).resolves.toMatchObject({
      draft: {
        builtOrWantToBuild: answers.builtOrWantToBuild,
        shortDeadlineLearning: answers.shortDeadlineLearning,
        hackathonsAttended: answers.hackathonsAttended,
        experienceLevel: answers.experienceLevel,
      },
    });

    await t.mutation("registrations:submitRegistration", {
      data: {
        ...validRegistrationPayload(),
        builtOrWantToBuild: answers.builtOrWantToBuild,
        shortDeadlineLearning: answers.shortDeadlineLearning,
        hackathonsAttended: 2,
        experienceLevel: answers.experienceLevel,
      },
    });

    expect(await t.run((ctx) => ctx.db.query("applications").first())).toMatchObject({
      builtOrWantToBuild: answers.builtOrWantToBuild,
      shortDeadlineLearning: answers.shortDeadlineLearning,
      hackathonsAttended: 2,
      experienceLevel: answers.experienceLevel,
      status: "submitted",
    });

    const dashboard = await t.query("applications:getMyApplicantDashboard", {}) as {
      registration: { answers: Record<string, unknown> };
    };
    expect(dashboard.registration.answers).toMatchObject({
      builtOrWantToBuild: answers.builtOrWantToBuild,
      shortDeadlineLearning: answers.shortDeadlineLearning,
      hackathonsAttended: 2,
      experienceLevel: answers.experienceLevel,
    });
    await drainScheduledFunctions(t);
  });

  it("clears saved answers without clearing dietary restrictions and reloads them as unanswered", async () => {
    const t = await authTest();
    const form = { ...validRegistrationForm(), dietaryRestrictions: ["Halal" as const, "No Beef" as const] };
    await t.mutation("applications:saveApplicationDraft", { patch: formToDraftPatch(form) });
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch({
        ...form,
        stateOfResidence: "",
        internationalStudent: null,
      }),
    });
    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    for (const field of ["stateOfResidence", "internationalStudent"]) {
      expect(stored).not.toHaveProperty(field);
    }
    await expect(t.query("applications:getMyApplicationDraft", {})).resolves.toMatchObject({
      draft: {
        stateOfResidence: "",
        internationalStudent: null,
        dietaryRestrictions: ["Halal", "No Beef"],
      },
    });
  });

  it("creates and updates registrations", async () => {
    const t = await authTest();

    const first = await t.mutation("registrations:register", {
      data: validRegistrationPayload(),
    });
    expect(first.ok).toBe(true);
    expect(first.isNew).toBe(true);
    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored).toMatchObject({
      stateOfResidence: "Texas",
      internationalStudent: false,
      dietaryRestrictions: [],
    });
    await expect(t.query("applications:getMyApplicantDashboard", {})).resolves.toMatchObject({
      registration: { answers: { stateOfResidence: "Texas" } },
    });

    await drainScheduledFunctions(t);

    await expect(t.mutation("registrations:register", {
      data: validRegistrationPayload(),
    })).rejects.toThrow("already submitted");
  }, 15_000);

  it("records submitted consent metadata and preserves an optional sponsor decline", async () => {
    const t = await authTest();
    const result = await t.mutation("registrations:submitRegistration", {
      data: { ...validRegistrationPayload(), sponsorSharingConsent: false },
    });
    expect(result.ok).toBe(true);

    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored).toMatchObject({
      sponsorSharingConsent: false,
      foodAllergyWaiverAgreed: true,
      foodAllergyWaiverSubmittedAt: expect.any(Number),
    });
    expect(stored).not.toHaveProperty("sponsorSharingConsentSubmittedAt");
    await drainScheduledFunctions(t);
  });

  it("records sponsor consent timestamp only when granted", async () => {
    const t = await authTest();
    await t.mutation("registrations:submitRegistration", {
      data: { ...validRegistrationPayload(), sponsorSharingConsent: true },
    });

    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored).toMatchObject({
      sponsorSharingConsent: true,
      sponsorSharingConsentSubmittedAt: expect.any(Number),
    });
    await drainScheduledFunctions(t);
  });

  it("stores a parser-verified PDF only when the matching capability is supplied", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    });
    const profile = await t.run((ctx) => ctx.db.query("applications").first());
    expect(profile?.resumeStorageId).toBe(upload.storageId);
    const session = await t.run((ctx) => ctx.db.query("resumeUploadSessions").first());
    expect(session?.consumedAt).toEqual(expect.any(Number));
  }, 10_000);

  it("rejects a storage ID without its matching upload capability", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
      resumeUploadToken: "wrong-token",
    })).rejects.toThrow("valid PDF resume");
  });

  it.each([
    ["application/pdf", "", "valid PDF resume"],
    ["text/plain", "not a pdf", "valid PDF resume"],
    ["application/pdf", "x".repeat(MAX_RESUME_BYTES + 1), RESUME_SIZE_ERROR_MESSAGE],
  ])("rejects invalid stored file metadata (%s)", async (type, contents, expectedMessage) => {
    const t = await authTest();
    const storageId = await storeFile(t, contents, type);
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: storageId },
    })).rejects.toThrow(expectedMessage);
  });

  it("accepts a stored resume exactly at the 2 MB limit", async () => {
    const t = await authTest();
    const bytes = await pdfBytesAtExactly(MAX_RESUME_BYTES);
    const upload = await verifiedUpload(t, crypto.randomUUID(), bytes as BlobPart);
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    })).resolves.toMatchObject({ ok: true, isNew: true });
  }, 15_000);

  it("rate limits by an API-derived client key, independent of applicant PII", async () => {
    const t = createTest();
    const authUserId = await ensureTestUserId(t);
    for (let index = 0; index < 5; index += 1) {
      await t.mutation(assertRateLimit, { requestKey: "hashed-network-client", authUserId });
    }
    await expect(t.mutation(assertRateLimit, { requestKey: "hashed-network-client", authUserId }))
      .rejects.toThrow("Too many resume upload attempts");
  });

  it("allows another upload once the rate-limit window passes", async () => {
    const t = createTest();
    const authUserId = await ensureTestUserId(t);
    for (let index = 0; index < 5; index += 1) {
      await t.mutation(assertRateLimit, { requestKey: "hashed-network-client", authUserId });
    }
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 11 * 60 * 1000);
    await expect(t.mutation(assertRateLimit, { requestKey: "hashed-network-client", authUserId }))
      .resolves.toBeNull();
    clock.mockRestore();
  });

  it("rate limits globally across distinct client keys", async () => {
    const t = createTest();
    const authUserId = await ensureTestUserId(t);
    const now = Date.now();
    await t.run(async (ctx) => {
      for (let index = 0; index < 100; index += 1) {
        await ctx.db.insert("rateLimits", {
          bucket: RESUME_UPLOAD_BUCKET,
          key: `client-${index}`,
          createdAt: now,
        });
      }
    });
    await expect(t.mutation(assertRateLimit, { requestKey: "fresh-client", authUserId }))
      .rejects.toThrow("Too many resume upload attempts");
  });

  it("rejects registration when the upload belongs to another user", async () => {
    const owner = await authTest({
      tokenIdentifier: "email|owner-resume@example.com",
      email: "owner-resume@example.com",
    });
    const upload = await verifiedUpload(owner);
    const other = createTest().withIdentity({
      tokenIdentifier: "email|other-resume@example.com",
      email: "other-resume@example.com",
    }) as unknown as ConvexTestClient;
    await seedAuthUser(other, { email: "other-resume@example.com" });
    await expect(other.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    })).rejects.toThrow("valid PDF resume");
  });

  it("rejects registration with an expired upload capability", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    const expiredAt = Date.now() - 31 * 60 * 1000;
    await t.run(async (ctx) => {
      const session = await ctx.db.query("resumeUploadSessions").first();
      if (session) {
        await ctx.db.patch(session._id, { createdAt: expiredAt, verifiedAt: expiredAt });
      }
    });
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    })).rejects.toThrow("valid PDF resume");
  });

  it("rejects registration when the upload capability was already consumed", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.run(async (ctx) => {
      const session = await ctx.db.query("resumeUploadSessions").first();
      if (session) {
        await ctx.db.patch(session._id, { consumedAt: Date.now() });
      }
    });
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    })).rejects.toThrow("valid PDF resume");
  });

  it("accepts the submitRegistration alias", async () => {
    const t = await authTest();
    await expect(t.mutation("registrations:submitRegistration", { data: validRegistrationPayload() }))
      .resolves.toMatchObject({ ok: true, isNew: true });
  });

  it("rejects invalid registration payloads", async () => {
    const t = await authTest();
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), age: -1 },
    })).rejects.toThrow("Invalid registration data.");
  });

  it("rejects registration payloads with unexpected fields", async () => {
    const t = await authTest();
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), hackathonId: "hackuta-2026" },
    })).rejects.toThrow("Invalid registration data.");
  });

  it("rejects unauthenticated registration", async () => {
    const t = createTest() as unknown as ConvexTestClient;

    await expect(
      t.mutation("registrations:register", { data: validRegistrationPayload() }),
    ).rejects.toThrow("Authentication required.");
  });

  it("creates a submitted profile when registration completes", async () => {
    const t = await authTest({
      tokenIdentifier: "email|sam@example.com",
      email: "sam@example.com",
      name: "Sam Test",
    });

    expect(await t.run((ctx) => ctx.db.query("applications").collect())).toHaveLength(0);

    await t.mutation("registrations:register", { data: validRegistrationPayload() });

    expect(await t.run((ctx) => ctx.db.query("applications").collect())).toHaveLength(1);
  });

  it("rejects registration when email is not verified", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "email|unverified@example.com",
      email: "unverified@example.com",
    }) as unknown as ConvexTestClient;
    await t.run(async (ctx) => {
      await ctx.db.insert("users", { email: "unverified@example.com" });
    });

    await expect(
      t.mutation("registrations:register", { data: validRegistrationPayload() }),
    ).rejects.toThrow("Verify your email");
  });
});

describe("resume HTTP validation and lifecycle", () => {
  it("handles CORS preflight without a response body", async () => {
    const t = createTest();
    const preflight = await t.fetch("/resume-upload", {
      method: "OPTIONS",
      headers: { Origin: TEST_ORIGIN, "X-Test-Origin": TEST_ORIGIN },
    });
    expect(preflight.status).toBe(204);
    expect(await preflight.text()).toBe("");
  });

  it("rejects unauthenticated upload requests", async () => {
    const t = createTest();
    const body = new Uint8Array(await pdfBytes());
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body),
      body,
    });
    expect(result.status).toBe(401);
    expect((await result.json() as { error: string }).error).toBe(
      RESUME_UPLOAD_AUTH_REQUIRED_MESSAGE,
    );
  });

  it("rejects uploads without an allowed browser origin", async () => {
    const t = await authTest();
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: { "Content-Type": "application/pdf", "X-Forwarded-For": "192.0.2.10" },
      body: await pdfBytes(),
    });
    expect(result.status).toBe(403);
  });

  it("rejects uploads from a disallowed origin", async () => {
    const t = createTest();
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        Origin: "https://evil.example",
        "X-Forwarded-For": "192.0.2.10",
      },
      body: await pdfBytes(),
    });
    expect(result.status).toBe(403);
  });

  it("parses, stores, and binds a valid PDF through the HTTP upload route", async () => {
    const t = await authTest();
    const body = new Uint8Array(await pdfBytes());
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body),
      body,
    });
    expect(result.status).toBe(201);
    const upload = await result.json() as { storageId: string; uploadToken: string };
    await t.run((ctx) => (ctx.db.patch as unknown as (
      id: string,
      value: { contentType: string },
    ) => Promise<void>)(upload.storageId, { contentType: "application/pdf" }));
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
      resumeUploadToken: upload.uploadToken,
    })).resolves.toMatchObject({ ok: true, isNew: true });
  });

  it("rejects a file that only has a PDF-looking prefix", async () => {
    const t = await authTest();
    const body = "%PDF-1.7\nnot actually a PDF";
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body),
      body,
    });
    expect(result.status).toBe(422);
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toEqual([]);
  });

  it("rejects PDFs with too many pages through the HTTP upload route", async () => {
    const t = await authTest();
    const body = await pdfBytesWithPageCount(MAX_RESUME_PAGES + 1);
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body),
      body,
    });
    expect(result.status).toBe(422);
    expect((await result.json() as { error: string }).error).toBe("The PDF has too many pages.");
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toEqual([]);
  });

  it("accepts PDF content types with parameters", async () => {
    const t = await authTest();
    const body = new Uint8Array(await pdfBytes());
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body, {
        "Content-Type": "application/pdf; charset=binary",
      }),
      body,
    });
    expect(result.status).toBe(201);
  });

  it("rejects non-PDF content types before reading the body", async () => {
    const t = await authTest();
    const body = new Uint8Array(await pdfBytes());
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body, { "Content-Type": "text/plain" }),
      body,
    });
    expect(result.status).toBe(415);
  });

  it("rejects empty uploads and oversized bodies", async () => {
    const t = await authTest();
    const emptyBody = new Uint8Array();
    const emptyResult = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(emptyBody),
      body: emptyBody,
    });
    expect(emptyResult.status).toBe(413);
    expect((await emptyResult.json() as { error: string }).error).toBe(
      RESUME_EMPTY_ERROR_MESSAGE,
    );

    const oversizedLength = 2 * 1024 * 1024 + 1;
    const oversizedResult = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(new Uint8Array(1), {
        [RESUME_TEST_CONTENT_LENGTH_HEADER]: String(oversizedLength),
      }),
      body: new Uint8Array(1),
    });
    expect(oversizedResult.status).toBe(413);
    expect((await oversizedResult.json() as { error: string }).error).toBe(
      RESUME_SIZE_ERROR_MESSAGE,
    );
  });

  it("accepts a valid PDF upload exactly at the 2 MB limit", async () => {
    const t = await authTest();
    const body = await pdfBytesAtExactly(MAX_RESUME_BYTES);
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body as BodyInit),
      body: body as BodyInit,
    });
    expect(result.status).toBe(201);
    expect(await result.json()).toMatchObject({
      storageId: expect.any(String),
      uploadToken: expect.any(String),
    });
  }, 15_000);

  it("rejects uploads without Content-Length before reading the body", async () => {
    const t = await authTest();
    const body = new Uint8Array(await pdfBytes());
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: {
        ...uploadHeaders,
        [RESUME_FILENAME_HEADER]: "resume.pdf",
      },
      body,
    });
    expect(result.status).toBe(411);
  });

  it("rejects disallowed file extensions before storage", async () => {
    const t = await authTest();
    const body = new Uint8Array(await pdfBytes());
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body, { [RESUME_FILENAME_HEADER]: "resume.php" }),
      body,
    });
    expect(result.status).toBe(415);
  });

  it("rejects Content-Length mismatches", async () => {
    const t = await authTest();
    const body = new Uint8Array(await pdfBytes());
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body, {
        [RESUME_TEST_CONTENT_LENGTH_HEADER]: String(body.byteLength + 10),
      }),
      body,
    });
    expect(result.status).toBe(413);
  });

  it("rate limits repeated uploads from the same client address", async () => {
    const t = await authTest();
    for (let index = 0; index < 5; index += 1) {
      const body = new Uint8Array(await pdfBytes());
      const ok = await t.fetch("/resume-upload", {
        method: "POST",
        headers: buildUploadHeaders(body),
        body,
      });
      expect(ok.status).toBe(201);
    }
    const body = new Uint8Array(await pdfBytes());
    const limited = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body),
      body,
    });
    expect(limited.status).toBe(429);
    expect((await limited.json() as { error: string }).error).toBe(
      "Too many uploads. Please try again later.",
    );
  });

  it("rejects CORS preflight from a disallowed origin", async () => {
    const t = createTest();
    const preflight = await t.fetch("/resume-upload", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" },
    });
    expect(preflight.status).toBe(403);
  });

  it("keeps an attached resume and permits idempotent resubmission", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    const data = { ...validRegistrationPayload(), resumeStorageId: upload.storageId };
    await t.mutation("registrations:register", { data, resumeUploadToken: upload.token });
    await t.mutation("resumeUploads:discardUploadSession", { uploadToken: upload.token });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", upload.storageId))).not.toBeNull();
    await expect(t.mutation("registrations:register", { data })).rejects.toThrow(
      "already submitted",
    );
  });

  it("does not let another application claim a submitted resume", async () => {
    const base = createTest();
    const owner = base.withIdentity({
      tokenIdentifier: "email|owner@example.com",
      email: "owner@example.com",
    }) as unknown as ConvexTestClient;
    await seedAuthUser(owner, { email: "owner@example.com" });
    const upload = await verifiedUpload(owner);
    await owner.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    });

    const otherApplicant = base.withIdentity({
      tokenIdentifier: "email|other@example.com",
      email: "other@example.com",
    }) as unknown as ConvexTestClient;
    await seedAuthUser(otherApplicant, { email: "other@example.com" });
    await expect(otherApplicant.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), firstName: "Other", resumeStorageId: upload.storageId },
    })).rejects.toThrow("already attached");
  });

  it("ignores delete requests for consumed upload capabilities", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    });
    await expect(t.mutation("resumeUploads:discardUploadSession", { uploadToken: upload.token })).resolves.toEqual({ ok: true });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", upload.storageId))).not.toBeNull();
  });

  it("deletes an unconsumed upload only with its capability", async () => {
    const t = await authTest({
      tokenIdentifier: "email|discard-upload@example.com",
      email: "discard-upload@example.com",
    });
    const upload = await verifiedUpload(t);
    await t.mutation("resumeUploads:discardUploadSession", { uploadToken: "guessed-or-wrong-token" });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", upload.storageId))).not.toBeNull();
    await t.mutation("resumeUploads:discardUploadSession", { uploadToken: upload.token });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", upload.storageId))).toBeNull();
  });

  it("stores the submitted resume on the application", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    });
    const profile = await t.run((ctx) => ctx.db.query("applications").first());
    expect(profile?.resumeStorageId).toBe(upload.storageId);
    expect(await t.run((ctx) => ctx.db.system.get("_storage", upload.storageId))).not.toBeNull();
  });

  it("scheduled cleanup removes expired rate-limit records", async () => {
    const t = createTest();
    const stale = Date.now() - 31 * 60 * 1000;
    await t.run((ctx) => ctx.db.insert("rateLimits", {
      bucket: RESUME_UPLOAD_BUCKET,
      key: "stale",
      createdAt: stale,
    }));
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now());
    await t.mutation(cleanup, {});
    expect(await t.run((ctx) => ctx.db.query("rateLimits").collect())).toEqual([]);
    clock.mockRestore();
  });

  it("scheduled cleanup removes expired unassociated files but preserves attached files", async () => {
    const t = await authTest();
    const orphan = await verifiedUpload(t, "orphan-token");
    const attached = await verifiedUpload(t, "attached-token");
    await t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: attached.storageId },
      resumeUploadToken: attached.token,
    });
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 31 * 60 * 1000);
    await t.mutation("resumeUploads:cleanupExpiredUploadSessions", {});
    expect(await t.run((ctx) => ctx.db.system.get("_storage", orphan.storageId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get("_storage", attached.storageId))).not.toBeNull();
    clock.mockRestore();
  });
});

describe("convex queries", () => {
  it("returns draft null for authenticated users without a profile", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "provider-user",
      email: "sam@example.com",
    }) as unknown as ConvexTestClient;
    await seedAuthUser(t, { email: "sam@example.com" });

    await expect(t.query("applications:getMyApplicationDraft", {})).resolves.toBeNull();
  });

  it("returns submitted profile draft metadata after registration", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "provider-user",
      email: "sam@example.com",
      name: "Sam Test",
    }) as unknown as ConvexTestClient;
    await seedAuthUser(t, { email: "sam@example.com", name: "Sam Test" });

    await t.mutation("registrations:register", { data: validRegistrationPayload() });

    await expect(t.query("applications:getMyApplicationDraft", {})).resolves.toMatchObject({
      status: "submitted",
      draft: null,
    });
  });
});

describe("event config", () => {
  it("returns the default hackathon name before config is seeded", async () => {
    const t = createTest() as unknown as ConvexTestClient;
    await expect(t.query("eventConfig:getPublicEventConfig", {})).resolves.toEqual({
      name: "HackUTA 2026",
    });
  });

  it("seeds config on first profile bootstrap and allows renaming", async () => {
    const t = await authTest();
    await t.mutation("applicant:ensureApplicantApplication", {});
    await expect(t.query("eventConfig:getPublicEventConfig", {})).resolves.toEqual({
      name: "HackUTA 2026",
    });

    await t.mutation("eventConfig:setHackathonName", { name: "HackUTA XIV" });
    await expect(t.query("eventConfig:getPublicEventConfig", {})).resolves.toEqual({
      name: "HackUTA XIV",
    });
    await expect(t.query("applications:getMyApplicantDashboard", {})).resolves.toMatchObject({
      hackathon: { name: "HackUTA XIV" },
    });
  });
});

describe("convex applicant auth flows", () => {
  it("returns unauthenticated routing state without identity", async () => {
    const t = createTest() as unknown as ConvexTestClient;
    await expect(t.query("applicant:getApplicantRoutingState", {})).resolves.toMatchObject({
      authenticated: false,
      verifiedEmail: null,
      hasSubmittedRegistration: false,
    });
  });

  it("returns routing state for authenticated users", async () => {
    const t = await authTest();
    await expect(t.query("applicant:getApplicantRoutingState", {})).resolves.toMatchObject({
      authenticated: true,
      verifiedEmail: "applicant@example.com",
      hasSubmittedRegistration: false,
    });
  });

  it("stores the verified email on submitted applications", async () => {
    const t = await authTest();
    await t.mutation("registrations:register", { data: validRegistrationPayload() });
    await drainScheduledFunctions(t);
    const profile = await t.run((ctx) => ctx.db.query("applications").first());
    expect(profile?.email).toBe("applicant@example.com");
  });

  it("returns dashboard data with registration and timeline", async () => {
    const t = await authTest();
    await t.mutation("registrations:register", { data: validRegistrationPayload() });
    await drainScheduledFunctions(t);

    await expect(t.query("applications:getMyApplicantDashboard", {})).resolves.toMatchObject({
      profile: {
        verifiedEmail: "applicant@example.com",
      },
      registration: {
        status: "submitted",
        resumeStatus: "none",
      },
    });
  });

  it("includes hackathon event timeline from the shared schedule", async () => {
    const t = await authTest();

    const dashboard = await t.query("applications:getMyApplicantDashboard", {}) as {
      timeline: Array<{ id: string; label: string }>;
      hackathon: { name: string };
    };

    expect(dashboard.hackathon.name).toBe("HackUTA 2026");
    expect(dashboard.timeline.map((event) => event.id)).toEqual([
      "applications-open",
      "application-deadline",
      "decisions-out",
      "hackathon-begins",
    ]);
    expect(dashboard.timeline.map((event) => event.label)).toEqual([
      "Applications open",
      "Applications close",
      "Decisions go out",
      "The hackathon begins",
    ]);
  });

  it("returns resume status as attached when resume exists", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    });
    await drainScheduledFunctions(t);

    await expect(t.query("applications:getMyApplicantDashboard", {})).resolves.toMatchObject({
      registration: {
        resumeStatus: "attached",
      },
    });
  });

  it("marks past hackathon milestones complete in the applicant timeline", async () => {
    const t = await authTest();
    const dashboard = await t.query("applications:getMyApplicantDashboard", {}) as {
      timeline: Array<{ id: string; complete: boolean }>;
    };

    const now = Date.now();
    const applicationsOpen = dashboard.timeline.find((event) => event.id === "applications-open");
    const hackathonBegins = dashboard.timeline.find((event) => event.id === "hackathon-begins");

    expect(applicationsOpen?.complete).toBe(now >= HACKATHON_SCHEDULE.registrationOpensAt);
    expect(hackathonBegins?.complete).toBe(now >= HACKATHON_SCHEDULE.startsAt);
  });

  it("saves draft profile fields before submission", async () => {
    const t = await authTest();
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch({
        ...INITIAL_FORM,
        firstName: "Draft",
        lastName: "User",
        countryOfResidence: "Canada",
        stateOfResidence: "Outside the United States",
        internationalStudent: true,
        dietaryRestrictions: ["No Beef", "Halal"],
        otherDietaryRestrictions: "No shellfish",
      }),
    });
    const draft = await t.query("applications:getMyApplicationDraft", {});
    expect(draft).toMatchObject({
      status: "draft",
      draft: {
        firstName: "Draft",
        lastName: "User",
        countryOfResidence: "Canada",
        stateOfResidence: "",
        internationalStudent: true,
        dietaryRestrictions: ["No Beef", "Halal"],
        otherDietaryRestrictions: "No shellfish",
      },
    });
    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored).toMatchObject({
      countryOfResidence: "Canada",
      internationalStudent: true,
      dietaryRestrictions: ["No Beef", "Halal"],
      otherDietaryRestrictions: "No shellfish",
    });
    expect(stored).not.toHaveProperty("stateOfResidence");
  });

  it("saves and reloads resume metadata on draft applications", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), {
        storageId: upload.storageId,
        filename: "my-resume.pdf",
      }),
    });

    await expect(t.query("applications:getMyApplicationDraft", {})).resolves.toMatchObject({
      savedResume: { storageId: upload.storageId, filename: "my-resume.pdf" },
    });
    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored?.resumeStorageId).toBe(upload.storageId);
    expect(stored?.resumeFilename).toBe("my-resume.pdf");
  });

  it("submits a draft-attached resume without a fresh upload token", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), {
        storageId: upload.storageId,
        filename: "saved.pdf",
      }),
    });

    await t.mutation("registrations:submitRegistration", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
    });

    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored).toMatchObject({
      status: "submitted",
      resumeStorageId: upload.storageId,
      resumeFilename: "saved.pdf",
    });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", upload.storageId))).not.toBeNull();
  });

  it("clears draft resume storage when the applicant removes it", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), {
        storageId: upload.storageId,
        filename: "saved.pdf",
      }),
    });
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), null),
    });

    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored).not.toHaveProperty("resumeStorageId");
    expect(stored).not.toHaveProperty("resumeFilename");
    expect(await t.run((ctx) => ctx.db.system.get("_storage", upload.storageId))).toBeNull();
  });

  it("keeps a resume attached through upload, session cleanup, reload, and submit", async () => {
    const t = await authTest();
    const body = new Uint8Array(await pdfBytes());
    const response = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body, { [RESUME_FILENAME_HEADER]: "flow.pdf" }),
      body,
    });
    expect(response.status).toBe(201);
    const upload = await response.json() as { storageId: string; uploadToken: string };
    // convex-test does not record Blob content types; production storage does.
    await t.run((ctx) => (ctx.db.patch as unknown as (
      id: string,
      value: { contentType: string },
    ) => Promise<void>)(upload.storageId, { contentType: "application/pdf" }));

    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), {
        storageId: upload.storageId,
        filename: "flow.pdf",
      }),
    });
    await t.mutation("resumeUploads:discardUploadSession", { uploadToken: upload.uploadToken });
    await t.mutation("resumeUploads:cleanupExpiredUploadSessions", {});

    await expect(t.query("applications:getMyApplicationDraft", {})).resolves.toMatchObject({
      savedResume: { storageId: upload.storageId, filename: "flow.pdf" },
      resumeMissing: false,
    });

    await t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
    });
    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored).toMatchObject({
      status: "submitted",
      resumeStorageId: upload.storageId,
      resumeFilename: "flow.pdf",
    });
    await drainScheduledFunctions(t);
  });

  it("does not detach a saved resume when autosave omits resume fields", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), {
        storageId: upload.storageId,
        filename: "saved.pdf",
      }),
    });
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch({ ...validRegistrationForm(), firstName: "Updated" }),
    });

    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored).toMatchObject({
      firstName: "Updated",
      resumeStorageId: upload.storageId,
      resumeFilename: "saved.pdf",
    });
  });

  it("replaces a saved draft resume and deletes the previous file", async () => {
    const t = await authTest();
    const first = await verifiedUpload(t);
    const second = await verifiedUpload(t);
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), {
        storageId: first.storageId,
        filename: "first.pdf",
      }),
    });
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), {
        storageId: second.storageId,
        filename: "second.pdf",
      }),
    });

    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored).toMatchObject({ resumeStorageId: second.storageId, resumeFilename: "second.pdf" });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", first.storageId))).toBeNull();
  });

  it("rejects attaching a draft resume whose upload session expired", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    const expiredAt = Date.now() - 31 * 60 * 1000;
    await t.run(async (ctx) => {
      const session = await ctx.db.query("resumeUploadSessions").first();
      if (session) {
        await ctx.db.patch(session._id, { createdAt: expiredAt, verifiedAt: expiredAt });
      }
    });

    await expect(t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), {
        storageId: upload.storageId,
        filename: "late.pdf",
      }),
    })).rejects.toThrow(RESUME_UPLOAD_EXPIRED_MESSAGE);
  });

  it("rejects attaching another applicant's upload to a draft", async () => {
    const t = await authTest();
    const otherUserId = await t.run((ctx) => ctx.db.insert("users", {
      email: "someone-else@example.com",
      emailVerificationTime: Date.now(),
    }));
    const storageId = await storeFile(t, await pdfBytes());
    await t.run((ctx) => ctx.db.insert("resumeUploadSessions", {
      token: crypto.randomUUID(),
      authUserId: otherUserId,
      storageId,
      createdAt: Date.now(),
      verifiedAt: Date.now(),
    }));

    await expect(t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), { storageId, filename: "theirs.pdf" }),
    })).rejects.toThrow(RESUME_UPLOAD_EXPIRED_MESSAGE);
    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored?.resumeStorageId).toBeUndefined();
  });

  it.each([
    ["a non-PDF name", "resume.exe"],
    ["a path", "../resume.pdf"],
    ["an overly long name", `${"a".repeat(260)}.pdf`],
  ])("rejects a draft resume with %s", async (_label, filename) => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await expect(t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), { storageId: upload.storageId, filename }),
    })).rejects.toThrow("Please select a PDF file.");
  });

  it("reports a saved resume whose file is missing and still allows removal and submit", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), {
        storageId: upload.storageId,
        filename: "gone.pdf",
      }),
    });
    await t.run((ctx) => ctx.storage.delete(upload.storageId));

    await expect(t.query("applications:getMyApplicationDraft", {})).resolves.toMatchObject({
      savedResume: null,
      resumeMissing: true,
    });
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
    })).rejects.toThrow(RESUME_MISSING_MESSAGE);

    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), null),
    });
    await t.mutation("registrations:register", { data: validRegistrationPayload() });
    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored?.status).toBe("submitted");
    expect(stored).not.toHaveProperty("resumeStorageId");
    expect(stored).not.toHaveProperty("resumeFilename");
    await drainScheduledFunctions(t);
  });

  it("clears the saved filename when submitting with a different resume", async () => {
    const t = await authTest();
    const draftResume = await verifiedUpload(t);
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch(validRegistrationForm(), {
        storageId: draftResume.storageId,
        filename: "draft.pdf",
      }),
    });
    const fresh = await verifiedUpload(t);

    await t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: fresh.storageId },
      resumeUploadToken: fresh.token,
    });
    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored?.resumeStorageId).toBe(fresh.storageId);
    expect(stored).not.toHaveProperty("resumeFilename");
    expect(await t.run((ctx) => ctx.db.system.get("_storage", draftResume.storageId))).toBeNull();
    await drainScheduledFunctions(t);
  });

  it("reloads student email from the saved draft query", async () => {
    const t = await authTest();
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch({
        ...INITIAL_FORM,
        studentEmail: "student@mail.utexas.edu",
      }),
    });

    await expect(t.query("applications:getMyApplicationDraft", {})).resolves.toMatchObject({
      draft: { studentEmail: "student@mail.utexas.edu" },
    });
  });

  it("persists student email through submission and dashboard answers", async () => {
    const t = await authTest();
    const studentEmail = "student@mail.utexas.edu";
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch({
        ...validRegistrationForm(),
        studentEmail,
      }),
    });
    await t.mutation("registrations:submitRegistration", {
      data: {
        ...validRegistrationPayload(),
        studentEmail,
      },
    });

    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored?.studentEmail).toBe(studentEmail);

    const dashboard = await t.query("applications:getMyApplicantDashboard", {}) as {
      registration: { answers: Record<string, unknown> };
    };
    expect(dashboard.registration.answers.studentEmail).toBe(studentEmail);
    await drainScheduledFunctions(t);
  });

  it("reloads other dietary restrictions from the saved draft query", async () => {
    const t = await authTest();
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch({
        ...INITIAL_FORM,
        otherDietaryRestrictions: "No shellfish",
      }),
    });

    await expect(t.query("applications:getMyApplicationDraft", {})).resolves.toMatchObject({
      draft: { otherDietaryRestrictions: "No shellfish" },
    });
  });

  it("persists other dietary restrictions through submission and dashboard answers", async () => {
    const t = await authTest();
    const otherDietaryRestrictions = "Low sodium meals only";
    await t.mutation("applications:saveApplicationDraft", {
      patch: formToDraftPatch({
        ...validRegistrationForm(),
        otherDietaryRestrictions,
      }),
    });
    await t.mutation("registrations:submitRegistration", {
      data: {
        ...validRegistrationPayload(),
        otherDietaryRestrictions,
      },
    });

    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored?.otherDietaryRestrictions).toBe(otherDietaryRestrictions);

    const dashboard = await t.query("applications:getMyApplicantDashboard", {}) as {
      registration: { answers: Record<string, unknown> };
    };
    expect(dashboard.registration.answers.otherDietaryRestrictions).toBe(
      otherDietaryRestrictions,
    );
    await drainScheduledFunctions(t);
  });

  it("migrates legacy No beef/pork answers into dietary restrictions and strips legacy fields", async () => {
    const looseSchema = Object.assign(Object.create(Object.getPrototypeOf(schema)), schema, {
      schemaValidation: false,
    }) as typeof schema;
    const t = convexTest(looseSchema, modules);
    const authUserId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "legacy@example.com",
        emailVerificationTime: 1,
      }),
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("applications", {
        authUserId,
        email: "legacy@example.com",
        status: "draft",
        eligibilityStatus: "unreviewed",
        confirmationStatus: "unconfirmed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        dietaryRestrictions: ["Halal"],
        eatsBeef: false,
        eatsPork: true,
      } as never);
    });

    await expect(t.mutation(migrateMeatPreferences, {})).resolves.toEqual({ ok: true, updated: 1 });

    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored?.dietaryRestrictions).toEqual(["Halal", "No Beef"]);
    expect(stored).not.toHaveProperty("eatsBeef");
    expect(stored).not.toHaveProperty("eatsPork");

    await expect(t.mutation(migrateMeatPreferences, {})).resolves.toEqual({ ok: true, updated: 0 });
  });

  it("leaves dietary restrictions unchanged when legacy meat answers were Yes", async () => {
    const looseSchema = Object.assign(Object.create(Object.getPrototypeOf(schema)), schema, {
      schemaValidation: false,
    }) as typeof schema;
    const t = convexTest(looseSchema, modules);
    const authUserId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "legacy-yes@example.com",
        emailVerificationTime: 1,
      }),
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("applications", {
        authUserId,
        email: "legacy-yes@example.com",
        status: "draft",
        eligibilityStatus: "unreviewed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        dietaryRestrictions: ["Halal"],
        eatsBeef: true,
        eatsPork: true,
      } as never);
    });

    await expect(t.mutation(migrateMeatPreferences, {})).resolves.toEqual({ ok: true, updated: 1 });

    const stored = await t.run((ctx) => ctx.db.query("applications").first());
    expect(stored?.dietaryRestrictions).toEqual(["Halal"]);
    expect(stored).not.toHaveProperty("eatsBeef");
    expect(stored).not.toHaveProperty("eatsPork");
  });
});
