import type { Page } from "@playwright/test";
import { test, expect } from "./playwright-coverage";
import { MIN_GRADUATION_YEAR } from "../shared/registration/constants";
import { contentSecurityPolicy } from "../security/csp";
import { permissionsPolicy, referrerPolicy } from "../security/headers";
import { MOCK_OTP } from "../src/constants/mockAuth";
import vercelConfig from "../vercel.json" with { type: "json" };

const TEST_PASSWORD = "Hackuta1";

async function signUpAsNewApplicant(page: Page) {
  test.setTimeout(90_000);
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("applicant@example.com");
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel("Confirm password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();

  const otpCells = page.locator(".sign-in-otp__cell");
  await otpCells.first().click();
  await page.keyboard.type(MOCK_OTP);
  await page.getByRole("button", { name: "Verify email" }).click();
  await page.waitForURL("**/register");
}

async function selectListboxOption(page: Page, triggerId: string, optionName: string) {
  await page.locator(`#${triggerId}`).click();
  await page.getByRole("button", { name: optionName, exact: true }).click();
}

async function fillApplicationForm(page: Page) {
  await page.getByLabel("First name", { exact: false }).fill("Sam");
  await page.getByLabel("Last name", { exact: false }).fill("Test");
  await page.getByLabel("Phone number", { exact: false }).fill("5551234567");
  await page.locator("#age").fill("20");
  await page.locator("#school").fill("Texas at Arlington");
  await page.getByRole("button", { name: "The University of Texas at Arlington" }).click();
  await selectListboxOption(page, "countryOfResidence", "United States of America");
  await selectListboxOption(page, "stateOfResidence", "Texas");
  await page.getByRole("group", { name: /Are you an international student/ })
    .getByLabel("No").check({ force: true });
  await selectListboxOption(page, "levelOfStudy", "Undergraduate University (3+ year)");
  await selectListboxOption(
    page,
    "major",
    "Computer science, computer engineering, or software engineering",
  );
  await page.getByLabel("Expected graduation year", { exact: false }).fill(String(MIN_GRADUATION_YEAR));
  await selectListboxOption(page, "gender", "Man");
  await selectListboxOption(page, "tshirtSize", "M");
  await page.getByRole("group", { name: /Do you eat beef/ })
    .getByLabel("No").check({ force: true });
  await page.getByRole("group", { name: /Do you eat pork/ })
    .getByLabel("No").check({ force: true });
  await page.getByRole("group", { name: /Is this your first hackathon/ })
    .getByLabel("Yes").check({ force: true });
  await selectListboxOption(page, "hearAbout", "Discord");
  await page.getByLabel("Emergency contact name", { exact: false }).fill("Jane Test");
  await page.getByLabel("Emergency contact phone", { exact: false }).fill("5559876543");
  await page.getByRole("checkbox", { name: /MLH Code of Conduct/i }).check({ force: true });
  await page.getByRole("checkbox", { name: /authorize HackUTA to share/i }).check({ force: true });
}

test.describe("registration", () => {
  test.describe.configure({ mode: "serial" });

  test("submits a PDF resume with the application under the production CSP", async ({ page }) => {
    test.setTimeout(60_000);

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
  });

  test("shows field errors on empty submit and stays on the form", async ({ page }) => {
    await signUpAsNewApplicant(page);
    await page.getByRole("button", { name: "Submit application" }).click();

    await expect(page.getByText("First name is required.")).toBeVisible();
    await expect(page.getByText("Please select your state or territory of residence."))
      .toBeVisible();
    await expect(page.getByText("Please let us know if you are an international student."))
      .toBeVisible();
    await expect(page.getByText("Please let us know if you eat beef."))
      .toBeVisible();
    await expect(page.getByText("Please let us know if you eat pork."))
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
