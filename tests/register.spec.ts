import { test, expect } from "./playwright-coverage";
import { contentSecurityPolicy } from "../security/csp";
import { permissionsPolicy, referrerPolicy } from "../security/headers";
import { signUpAsNewApplicant } from "./fixtures/playwrightAuth";
import { fillApplicationForm } from "./fixtures/playwrightRegistration";
import vercelConfig from "../vercel.json" with { type: "json" };

test.describe("registration", () => {
  test.describe.configure({ mode: "serial" });

  test("submits a PDF resume with the application under the production CSP", async ({ page }) => {
    test.setTimeout(180_000);

    const deployedHeaders = Object.fromEntries(
      vercelConfig.headers
        .flatMap((rule) => rule.headers)
        .map((header) => [header.key, header.value]),
    );
    expect(deployedHeaders["Content-Security-Policy"]).toBe(contentSecurityPolicy);
    expect(deployedHeaders["Permissions-Policy"]).toBe(permissionsPolicy);
    expect(deployedHeaders["Referrer-Policy"]).toBe(referrerPolicy);

    const resume = Buffer.from("%PDF-1.7\nTest resume\n%%EOF");

    await signUpAsNewApplicant(page);
    await fillApplicationForm(page);
    await page.locator("#resume-upload").setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: resume,
    });
    await expect(page.getByText("resume.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Submit application" }).click();

    await expect(
      page.getByRole("heading", { name: "Your Journey Begins!" }).or(
        page.getByRole("heading", { name: "Your Journey" }),
      ),
    ).toBeVisible({ timeout: 20_000 });
    await page.waitForURL("**/profile", { timeout: 20_000 });
  });

  test("loads the application form at /register after mock sign-up", async ({ page }) => {
    await signUpAsNewApplicant(page);

    await expect(page.getByRole("heading", { name: "Tell us about yourself" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit application" })).toBeVisible();
    await expect(page.locator("main.sign-in-page")).toBeVisible();
    await expect(page.getByRole("group", { name: "Weather mood" })).toBeVisible();
    const dietary = page.getByRole("group", { name: /Dietary restrictions/ });
    await expect(dietary.getByLabel("No Beef")).toBeVisible();
    await expect(dietary.getByLabel("No Pork")).toBeVisible();
    await expect(page.getByRole("group", { name: /Do you eat beef/i })).toHaveCount(0);
    await expect(page.getByRole("group", { name: /Do you eat pork/i })).toHaveCount(0);
    await expect(page.getByLabel(/Student email \(optional\)/)).toBeVisible();
    await expect(
      page.getByText(
        "If you signed up with a personal email, you can provide your school email here.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel(/Other dietary restrictions \(optional\)/)).toBeVisible();
    await expect(
      page.getByText("Please describe any dietary restrictions not listed above."),
    ).toBeVisible();
  });

  test("opens the largest standard dropdown within the interaction budget", async ({ page }, testInfo) => {
    await signUpAsNewApplicant(page);

    const countryTrigger = page.locator("button[aria-controls]").filter({
      hasText: "Select one",
    }).first();
    const durationMs = await countryTrigger.evaluate(async (trigger) => {
      const startedAt = performance.now();
      (trigger as HTMLButtonElement).click();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      return performance.now() - startedAt;
    });
    await expect(page.getByRole("listbox").first()).toBeVisible();

    await testInfo.attach("country-dropdown-open-time", {
      body: JSON.stringify({ durationMs }),
      contentType: "application/json",
    });
    expect(durationMs).toBeLessThan(100);
  });

  test("shows field errors on empty submit and stays on the form", async ({ page }) => {
    await signUpAsNewApplicant(page);
    await page.getByRole("button", { name: "Submit application" }).click();

    await expect(page.getByText("First name is required.")).toBeVisible();
    await expect(page.getByText("Please select your state or territory of residence."))
      .toBeVisible();
    await expect(page.getByText("Please let us know if you are an international student."))
      .toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: /One or more of your answers is invalid/ }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Journey Begins!" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Tell us about yourself" })).toBeVisible();
  });

  test("marks invalid fields with aria-invalid", async ({ page }) => {
    await signUpAsNewApplicant(page);
    await page.getByRole("button", { name: "Submit application" }).click();

    await expect(page.locator("#firstName")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#firstName-error")).toContainText("First name is required.");
  });

  test("calms and re-enrages the storm backdrop from the register page", async ({ page }) => {
    await signUpAsNewApplicant(page);

    await expect(page.getByRole("button", { name: "Enrage" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Calm" }).click();
    await expect(page.getByRole("button", { name: "Calm" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Enrage" }).click();
    await expect(page.getByRole("button", { name: "Enrage" })).toHaveAttribute("aria-pressed", "true");
  });
});
