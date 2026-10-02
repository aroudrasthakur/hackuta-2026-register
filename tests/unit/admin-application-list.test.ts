import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, expect, it, vi } from "vitest";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const list = makeFunctionReference<"query">("admin/applications:list");
const access = makeFunctionReference<"query">("admin/access:getAccess");
afterEach(() => vi.unstubAllEnvs());

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const admin = await ctx.db.insert("users", { email: "admin@example.com", emailVerificationTime: 1 });
    const reviewer = await ctx.db.insert("users", { email: "reviewer@example.com", emailVerificationTime: 1 });
    const applicant = await ctx.db.insert("users", { email: "applicant@example.com", emailVerificationTime: 1 });
    const unverified = await ctx.db.insert("users", { email: "unverified@example.com" });
    for (const [index, status] of [null, "under_review", "accepted", "waitlisted", "rejected", "withdrawn"].entries()) {
      const id = await ctx.db.insert("applications", {
        authUserId: applicant, email: `sample${index}@example.com`, createdAt: 1,
        firstName: "Alex", lastName: "Rivera", school: "Other (Please Specify)", otherSchool: "Example University",
        submittedAt: index + 10,
      });
      if (status) await ctx.db.insert("applicationReviews", {
        applicationId: id, status: status as "under_review" | "accepted" | "waitlisted" | "rejected" | "withdrawn",
        createdAt: 1, updatedAt: 1, ...(index === 1 ? { reviewedBy: reviewer, reviewedAt: 2 } : {}),
      });
    }
    const untouched = await ctx.db.insert("applications", { authUserId: applicant, email: "untouched@example.com", createdAt: 1, submittedAt: 30 });
    await ctx.db.insert("applicationReviews", { applicationId: untouched, status: "under_review", createdAt: 30, updatedAt: 30 });
    await ctx.db.insert("applications", { authUserId: applicant, email: "draft@example.com", createdAt: 1 });
    return { admin, reviewer, applicant, unverified };
  });
  vi.stubEnv("ADMIN_USER_IDS", `${ids.admin},${ids.unverified}`);
  vi.stubEnv("REVIEWER_USER_IDS", ids.reviewer);
  return { t, ids };
}

it("denies anonymous, ordinary, and unverified accounts", async () => {
  const { t, ids } = await setup();
  await expect(t.query(list, {})).rejects.toThrow("Organizer access required");
  for (const id of [ids.applicant, ids.unverified]) {
    const user = t.withIdentity({ subject: id });
    expect(await user.query(access, {})).toEqual({ role: null });
    await expect(user.query(list, {})).rejects.toThrow("Organizer access required");
  }
});

it("returns the same complete read-only queue for both roles", async () => {
  const { t, ids } = await setup();
  const snapshot = () => t.run(async (ctx) => ({
    applications: await ctx.db.query("applications").collect(),
    reviews: await ctx.db.query("applicationReviews").collect(),
    submissionLogs: await ctx.db.query("applicationSubmissionLogs").collect(),
  }));
  const before = await snapshot();
  const admin = t.withIdentity({ subject: ids.admin });
  const reviewer = t.withIdentity({ subject: ids.reviewer });
  expect(await admin.query(access, {})).toEqual({ role: "admin" });
  expect(await reviewer.query(access, {})).toEqual({ role: "reviewer" });
  const rows = await admin.query(list, {});
  expect(await reviewer.query(list, {})).toEqual(rows);
  expect(rows).toHaveLength(6);
  expect(rows.map((row: { status: string }) => row.status)).toEqual([
    "Unreviewed", "Under Review", "Accepted", "Waitlisted", "Rejected", "Unreviewed",
  ]);
  expect(rows[0].school).toBe("Example University");
  expect(rows[0].submittedAt).toBe(10);
  expect(await snapshot()).toEqual(before);
});

it("revokes access when the server role lists are empty", async () => {
  const { t, ids } = await setup();
  vi.stubEnv("ADMIN_USER_IDS", "");
  vi.stubEnv("REVIEWER_USER_IDS", "");
  await expect(t.withIdentity({ subject: ids.admin }).query(list, {})).rejects.toThrow("Organizer access required");
});
