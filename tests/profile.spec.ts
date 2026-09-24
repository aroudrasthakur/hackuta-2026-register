import { test, expect } from "./playwright-coverage";
import { navigateToProfile, signUpAsNewApplicant } from "./fixtures/playwrightAuth";
import { signUpAndSubmitApplication } from "./fixtures/playwrightRegistration";
import {
  expectSignOutAfterOverviewGrid,
  expectSignOutClickable,
  expectSignOutInViewport,
} from "./fixtures/profileLayout";

test.describe("profile layout", () => {
  test("keeps the unsubmitted profile panel and sign-out in view on mobile", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 375, height: 812 });

    await signUpAsNewApplicant(page);
    await navigateToProfile(page);

    await expect(page.getByRole("heading", { name: "Your Journey" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your application" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start application" })).toBeVisible();
    await expectSignOutAfterOverviewGrid(page);
    await expectSignOutInViewport(page);
    await expectSignOutClickable(page);
  });

  test("keeps the profile panel and sign-out in view on desktop after registration", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 800 });

    await signUpAndSubmitApplication(page);

    await expect(page.getByRole("heading", { name: "Your Journey" })).toBeVisible();
    await expectSignOutAfterOverviewGrid(page);
    await expectSignOutInViewport(page);
    await expectSignOutClickable(page);
  });

  test("keeps the profile panel and sign-out in view on mobile after registration", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 375, height: 812 });

    await signUpAndSubmitApplication(page);

    await expect(page.getByRole("heading", { name: "Your Journey" })).toBeVisible();
    await expectSignOutAfterOverviewGrid(page);
    await expectSignOutInViewport(page);
  });
});
