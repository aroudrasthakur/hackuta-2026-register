import { PDFDocument } from "pdf-lib";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import schema from "../../convex/schema";
import { RESUME_UPLOAD_BUCKET } from "../../convex/lib/rateLimitBuckets";
import { formToDraftPatch } from "../../shared/registration/draftPatch";
import { validRegistrationPayload } from "../fixtures/validRegistrationForm";
import { INITIAL_FORM } from "../../shared/registration/types";
import {
  RESUME_FILENAME_HEADER,
  RESUME_TEST_CONTENT_LENGTH_HEADER,
} from "../../shared/registration/resume";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });
const discardUpload = makeFunctionReference<"mutation">("resumeUploads:discardUploadSession");
const assertRateLimit = makeFunctionReference<"mutation">("resumeUploads:assertUploadRateLimit");
const cleanup = makeFunctionReference<"mutation">("resumeUploads:cleanupExpiredUploadSessions");

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

async function seedHackathon(t: ConvexTestClient) {
  await t.mutation("seed:seedHackathon", {});
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
  tokenIdentifier: string;
  subject?: string;
  email?: string;
  name?: string;
} = { tokenIdentifier: "email|applicant@example.com", email: "applicant@example.com" }) {
  const t = createTest().withIdentity(identity) as unknown as ConvexTestClient;
  await seedHackathon(t);
  await seedAuthUser(t, identity);
  return t;
}

type RunnableTest = Pick<ReturnType<typeof createTest>, "run">;

async function pdfBytes() {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return new Uint8Array(await pdf.save()).buffer as ArrayBuffer;
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

async function verifiedUpload(t: RunnableTest, token: string = crypto.randomUUID()) {
  const storageId = await storeFile(t, await pdfBytes());
  await t.run((ctx) => ctx.db.insert("resumeUploadSessions", {
    token,
    storageId,
    createdAt: Date.now(),
    verifiedAt: Date.now(),
  }));
  return { storageId, token };
}

describe("convex registrations", () => {
  it("creates and updates registrations", async () => {
    const t = await authTest();

    const first = await t.mutation("registrations:register", {
      data: validRegistrationPayload(),
    });
    expect(first.ok).toBe(true);
    expect(first.isNew).toBe(true);

    await drainScheduledFunctions(t);

    await expect(t.mutation("registrations:register", {
      data: validRegistrationPayload(),
    })).rejects.toThrow("already submitted");
  }, 15_000);

  it("stores a parser-verified PDF only when the matching capability is supplied", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    });
    const profile = await t.run((ctx) => ctx.db.query("profiles").first());
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
    ["application/pdf", ""],
    ["text/plain", "not a pdf"],
    ["application/pdf", "x".repeat(2 * 1024 * 1024 + 1)],
  ])("rejects invalid stored file metadata (%s)", async (type, contents) => {
    const t = await authTest();
    const storageId = await storeFile(t, contents, type);
    await expect(t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: storageId },
    })).rejects.toThrow("valid PDF resume");
  });

  it("rate limits by an API-derived client key, independent of applicant PII", async () => {
    const t = createTest();
    for (let index = 0; index < 5; index += 1) {
      await t.mutation(assertRateLimit, { requestKey: "hashed-network-client" });
    }
    await expect(t.mutation(assertRateLimit, { requestKey: "hashed-network-client" }))
      .rejects.toThrow("Too many resume upload attempts");
  });

  it("allows another upload once the rate-limit window passes", async () => {
    const t = createTest();
    for (let index = 0; index < 5; index += 1) {
      await t.mutation(assertRateLimit, { requestKey: "hashed-network-client" });
    }
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 11 * 60 * 1000);
    await expect(t.mutation(assertRateLimit, { requestKey: "hashed-network-client" })).resolves.toBeNull();
    clock.mockRestore();
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

  it("auto-seeds hackuta-2026 on first registration", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "email|applicant@example.com",
      email: "applicant@example.com",
    }) as unknown as ConvexTestClient;
    await seedAuthUser(t, { email: "applicant@example.com" });
    await expect(
      t.query("hackathons:getHackathonBySlug", { slug: "hackuta-2026" }),
    ).resolves.toBeNull();
    await t.mutation("registrations:register", { data: validRegistrationPayload() });
    await expect(
      t.query("hackathons:getHackathonBySlug", { slug: "hackuta-2026" }),
    ).resolves.toMatchObject({ slug: "hackuta-2026", name: "HackUTA 2026" });
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

    expect(await t.run((ctx) => ctx.db.query("profiles").collect())).toHaveLength(0);

    await t.mutation("registrations:register", { data: validRegistrationPayload() });

    expect(await t.run((ctx) => ctx.db.query("profiles").collect())).toHaveLength(1);
  });

  it("rejects registration when email is not verified", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "email|unverified@example.com",
      email: "unverified@example.com",
    }) as unknown as ConvexTestClient;
    await seedHackathon(t);
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

  it("rejects uploads without an allowed browser origin", async () => {
    const t = createTest();
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
    const t = createTest();
    const body = "%PDF-1.7\nnot actually a PDF";
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body),
      body,
    });
    expect(result.status).toBe(422);
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toEqual([]);
  });

  it("accepts PDF content types with parameters", async () => {
    const t = createTest();
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
    const t = createTest();
    const body = new Uint8Array(await pdfBytes());
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body, { "Content-Type": "text/plain" }),
      body,
    });
    expect(result.status).toBe(415);
  });

  it("rejects empty uploads and oversized bodies", async () => {
    const t = createTest();
    const emptyBody = new Uint8Array();
    expect((await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(emptyBody),
      body: emptyBody,
    })).status).toBe(413);

    const oversizedLength = 2 * 1024 * 1024 + 1;
    expect((await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(new Uint8Array(1), {
        [RESUME_TEST_CONTENT_LENGTH_HEADER]: String(oversizedLength),
      }),
      body: new Uint8Array(1),
    })).status).toBe(413);
  });

  it("rejects uploads without Content-Length before reading the body", async () => {
    const t = createTest();
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
    const t = createTest();
    const body = new Uint8Array(await pdfBytes());
    const result = await t.fetch("/resume-upload", {
      method: "POST",
      headers: buildUploadHeaders(body, { [RESUME_FILENAME_HEADER]: "resume.php" }),
      body,
    });
    expect(result.status).toBe(415);
  });

  it("rejects Content-Length mismatches", async () => {
    const t = createTest();
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
    const t = createTest();
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
    await seedHackathon(owner);
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
    const t = createTest();
    const upload = await verifiedUpload(t);
    await t.mutation(discardUpload, { uploadToken: "guessed-or-wrong-token" });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", upload.storageId))).not.toBeNull();
    await t.mutation(discardUpload, { uploadToken: upload.token });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", upload.storageId))).toBeNull();
  });

  it("stores the submitted resume on the application", async () => {
    const t = await authTest();
    const upload = await verifiedUpload(t);
    await t.mutation("registrations:register", {
      data: { ...validRegistrationPayload(), resumeStorageId: upload.storageId },
      resumeUploadToken: upload.token,
    });
    const profile = await t.run((ctx) => ctx.db.query("profiles").first());
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
  it("returns null for missing records", async () => {
    const t = createTest() as unknown as ConvexTestClient;

    await expect(t.query("hackathons:getHackathonBySlug", { slug: "missing" })).resolves.toBeNull();
  });

  it("seeds hackuta-2026 idempotently and finds it by slug", async () => {
    const t = createTest() as unknown as ConvexTestClient;

    const first = await t.mutation("seed:seedHackathon", {});
    const second = await t.mutation("seed:seedHackathon", {});

    expect(first).toBe(second);
    await expect(
      t.query("hackathons:getHackathonBySlug", { slug: "hackuta-2026" }),
    ).resolves.toMatchObject({ slug: "hackuta-2026", name: "HackUTA 2026" });
  });

  it("syncs stale hackathon schedule dates when seed runs again", async () => {
    const t = createTest() as unknown as ConvexTestClient;
    await t.mutation("seed:seedHackathon", {});

    await (t as unknown as TestInstance).run(async (ctx) => {
      const hackathon = await ctx.db
        .query("hackathons")
        .withIndex("by_slug", (q) => q.eq("slug", "hackuta-2026"))
        .first();
      if (!hackathon) {
        throw new Error("Hackathon seed missing.");
      }
      await ctx.db.patch(hackathon._id, {
        registrationOpensAt: Date.parse("2026-09-01T00:00:00-05:00"),
      });
    });

    await t.mutation("seed:seedHackathon", {});

    await expect(
      t.query("hackathons:getHackathonBySlug", { slug: "hackuta-2026" }),
    ).resolves.toMatchObject({
      registrationOpensAt: Date.parse("2026-09-21T00:00:00-05:00"),
    });
  });

  it("returns draft null for authenticated users without a profile", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "provider-user",
      email: "sam@example.com",
    }) as unknown as ConvexTestClient;
    await seedHackathon(t);
    await seedAuthUser(t, { email: "sam@example.com" });

    await expect(t.query("profiles:getMyProfileDraft", {})).resolves.toBeNull();
  });

  it("returns submitted profile draft metadata after registration", async () => {
    const t = createTest().withIdentity({
      tokenIdentifier: "provider-user",
      email: "sam@example.com",
      name: "Sam Test",
    }) as unknown as ConvexTestClient;
    await seedHackathon(t);
    await seedAuthUser(t, { email: "sam@example.com", name: "Sam Test" });

    await t.mutation("registrations:register", { data: validRegistrationPayload() });

    await expect(t.query("profiles:getMyProfileDraft", {})).resolves.toMatchObject({
      status: "submitted",
      draft: null,
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

  it("stores the verified email on submitted profiles", async () => {
    const t = await authTest();
    await t.mutation("registrations:register", { data: validRegistrationPayload() });
    await drainScheduledFunctions(t);
    const profile = await t.run((ctx) => ctx.db.query("profiles").first());
    expect(profile?.email).toBe("applicant@example.com");
  });

  it("returns dashboard data with registration and timeline", async () => {
    const t = await authTest();
    await t.mutation("registrations:register", { data: validRegistrationPayload() });
    await drainScheduledFunctions(t);

    await expect(t.query("profiles:getMyApplicantDashboard", {})).resolves.toMatchObject({
      profile: {
        verifiedEmail: "applicant@example.com",
      },
      registration: {
        status: "submitted",
        resumeStatus: "none",
      },
    });
  });

  it("includes hackathon event timeline when hackathon exists", async () => {
    const t = await authTest();
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("hackathons", {
        slug: "hackuta-2026",
        name: "HackUTA 2026",
        startsAt: now + 7 * 24 * 60 * 60 * 1000,
        endsAt: now + 9 * 24 * 60 * 60 * 1000,
        registrationOpensAt: now - 30 * 24 * 60 * 60 * 1000,
        registrationClosesAt: now + 1 * 24 * 60 * 60 * 1000,
        decisionsReleasedAt: now + 3 * 24 * 60 * 60 * 1000,
      });
    });

    const dashboard = await t.query("profiles:getMyApplicantDashboard", {}) as {
      timeline: Array<{ id: string; label: string }>;
      hackathon: { name: string } | null;
    };

    expect(dashboard.hackathon?.name).toBe("HackUTA 2026");
    expect(dashboard.timeline.map((event) => event.id)).toEqual([
      "applications-open",
      "application-deadline",
      "decisions-out",
      "hackathon-begins",
    ]);
    expect(dashboard.timeline.map((event) => event.label)).toEqual([
      "Applications open",
      "Deadline to apply",
      "Decisions are out",
      "Hackathon begins",
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

    await expect(t.query("profiles:getMyApplicantDashboard", {})).resolves.toMatchObject({
      registration: {
        resumeStatus: "attached",
      },
    });
  });

  it("marks past hackathon milestones complete in the applicant timeline", async () => {
    const t = await authTest();
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("hackathons", {
        slug: "hackuta-2026",
        name: "HackUTA 2026",
        startsAt: now + 14 * 24 * 60 * 60 * 1000,
        endsAt: now + 16 * 24 * 60 * 60 * 1000,
        registrationOpensAt: now - 10 * 24 * 60 * 60 * 1000,
        registrationClosesAt: now + 2 * 24 * 60 * 60 * 1000,
        decisionsReleasedAt: now + 7 * 24 * 60 * 60 * 1000,
      });
    });

    const dashboard = await t.query("profiles:getMyApplicantDashboard", {}) as {
      timeline: Array<{ id: string; complete: boolean }>;
    };

    const applicationsOpen = dashboard.timeline.find((event) => event.id === "applications-open");
    const hackathonBegins = dashboard.timeline.find((event) => event.id === "hackathon-begins");

    expect(applicationsOpen?.complete).toBe(true);
    expect(hackathonBegins?.complete).toBe(false);
  });

  it("saves draft profile fields before submission", async () => {
    const t = await authTest();
    await t.mutation("profiles:saveProfileDraft", {
      patch: formToDraftPatch({
        ...INITIAL_FORM,
        firstName: "Draft",
        lastName: "User",
      }),
    });
    const draft = await t.query("profiles:getMyProfileDraft", {});
    expect(draft).toMatchObject({
      status: "draft",
      draft: {
        firstName: "Draft",
        lastName: "User",
      },
    });
  });
});
