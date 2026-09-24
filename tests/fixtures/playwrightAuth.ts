import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { MOCK_OTP } from "../../src/constants/mockAuth";

export const TEST_PASSWORD = "Hackuta1";

export async function signUpAsNewApplicant(page: Page, email = "applicant@example.com") {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
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

/** Preserves in-memory mock auth; a full reload would reset the mock session. */
export async function navigateToProfile(page: Page) {
  await page.evaluate(() => {
    window.history.pushState({}, "", "/profile");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForURL("**/profile");
}
