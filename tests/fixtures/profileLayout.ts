import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  profileOverviewGrid,
  profilePageBody,
  profileSignOutButton,
  profileSignOutWrap,
} from "../../src/pages/Profile/profileStyles";

export async function expectSignOutAfterOverviewGrid(page: Page) {
  const layout = await page.evaluate(
    ({ bodyClass, gridClass, wrapClass }) => {
      const body = document.querySelector(`[class="${bodyClass}"]`);
      if (!body) return null;

      const grid = body.querySelector(`[class="${gridClass}"]`);
      const signOut = body.querySelector(`[class="${wrapClass}"] button`);
      if (!grid || !signOut) return null;

      return grid.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING
        ? "after"
        : "before";
    },
    {
      bodyClass: profilePageBody,
      gridClass: profileOverviewGrid,
      wrapClass: profileSignOutWrap,
    },
  );

  expect(layout).toBe("after");
}

export async function expectSignOutInViewport(page: Page) {
  const signOut = page.getByRole("button", { name: "Sign out" });
  await expect(signOut).toBeVisible();
  await expect(signOut).toHaveClass(new RegExp(profileSignOutButton.split(" ")[0]!));
  await signOut.scrollIntoViewIfNeeded();

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const fitsViewport = await signOut.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0
      && rect.height > 0
      && rect.left >= 0
      && rect.top >= 0
      && rect.right <= window.innerWidth + 1
      && rect.bottom <= window.innerHeight + 1
    );
  });
  expect(fitsViewport).toBe(true);

  const panel = page
    .locator(".rounded-2xl.border-2.border-\\(--sand\\).bg-\\(--light\\)")
    .first();
  await expect(panel).toBeVisible();
  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

export async function expectSignOutClickable(page: Page) {
  const signOut = page.getByRole("button", { name: "Sign out" });
  await expect(signOut).toBeEnabled();
  await signOut.click();
  await page.waitForURL("**/sign-in");
  await expect(
    page.getByRole("heading", { name: /Create your account|Sign in/i }),
  ).toBeVisible();
}
