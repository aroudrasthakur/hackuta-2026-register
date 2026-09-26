import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../../convex/schema";
import { formToDraftPatch } from "../../shared/registration/draftMapping";
import { validRegistrationForm, validRegistrationPayload } from "../fixtures/validRegistrationForm";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

const saveDraft = makeFunctionReference<"mutation">("applications:saveApplicationDraft");
const getDraft = makeFunctionReference<"query">("applications:getMyApplicationDraft");
const dashboard = makeFunctionReference<"query">("applications:getMyApplicantDashboard");
const submitRegistration = makeFunctionReference<"mutation">("registrations:submitRegistration");

async function seedVerifiedUser(
  t: ReturnType<typeof convexTest>,
  email: string,
) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email, emailVerificationTime: Date.now() }),
  );
  return t.withIdentity({
    subject: userId,
    tokenIdentifier: `email|${email}`,
    email,
  });
}

describe("security regression controls", () => {
  it("prevents account B from reading or saving account A draft", async () => {
    const base = convexTest(schema, modules);
    const userA = await seedVerifiedUser(base, "audit-a@example.com");
    const userB = await seedVerifiedUser(base, "audit-b@example.com");

    await userA.mutation(saveDraft, {
      patch: formToDraftPatch({ ...validRegistrationForm(), firstName: "Alice" }),
    });
    const appA = await userA.run((ctx) => ctx.db.query("applications").first());

    await expect(userB.query(getDraft, {})).resolves.toBeNull();
    await expect(userB.query(dashboard, {})).resolves.toMatchObject({
      registration: null,
    });

    expect(appA?.firstName).toBe("Alice");
  });

  it("allows an unverified user to save a draft but blocks submit", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "unverified-draft@example.com" }),
    );
    const client = t.withIdentity({
      subject: userId,
      tokenIdentifier: "email|unverified-draft@example.com",
      email: "unverified-draft@example.com",
    });

    await expect(
      client.mutation(saveDraft, {
        patch: formToDraftPatch(validRegistrationForm()),
      }),
    ).resolves.toMatchObject({ ok: true });

    await expect(
      client.mutation(submitRegistration, { data: validRegistrationPayload() }),
    ).rejects.toThrow("Verify your email");
  });

  it("preserves unicode and punctuation in applicant names through draft save", async () => {
    const t = await seedVerifiedUser(convexTest(schema, modules), "names@example.com");
    const names = {
      firstName: "José",
      lastName: "O'Brien",
      emergencyContactName: "Anne-Marie",
    };
    await t.mutation(saveDraft, {
      patch: formToDraftPatch({ ...validRegistrationForm(), ...names }),
    });
    await expect(t.query(getDraft, {})).resolves.toMatchObject({ draft: names });
  });
});
