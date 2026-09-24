import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { MIN_GRADUATION_YEAR } from "../../shared/registration/constants";
import { signUpAsNewApplicant } from "./playwrightAuth";

async function selectListboxOption(page: Page, triggerId: string, optionName: string) {
  await page.locator(`#${triggerId}`).click();
  await page.getByRole("button", { name: optionName, exact: true }).click();
}

export async function fillApplicationForm(page: Page) {
  await page.getByLabel("First name", { exact: false }).fill("Sam");
  await page.getByLabel("Last name", { exact: false }).fill("Test");
  await page.getByLabel("Phone number", { exact: false }).fill("5551234567");
  await page.locator("#age").fill("20");
  await page.locator("#school").fill("Texas at Arlington");
  await page.getByRole("button", { name: "The University of Texas at Arlington" }).click();
  await page.getByLabel(/Student email \(optional\)/).fill("student@mail.utexas.edu");
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
  await page.getByRole("group", { name: /Dietary restrictions/ })
    .getByLabel("No Beef").check({ force: true });
  await page.getByRole("group", { name: /Dietary restrictions/ })
    .getByLabel("No Pork").check({ force: true });
  await page.getByRole("group", { name: /Is this your first hackathon/ })
    .getByLabel("Yes").check({ force: true });
  await selectListboxOption(page, "hearAbout", "Discord");
  await page.getByLabel("Emergency contact name", { exact: false }).fill("Jane Test");
  await page.getByLabel("Emergency contact phone", { exact: false }).fill("5559876543");
  await page.getByRole("checkbox", { name: /MLH Code of Conduct/i }).check({ force: true });
  await page.getByRole("checkbox", { name: /authorize HackUTA to share/i }).check({ force: true });
}

export async function signUpAndSubmitApplication(page: Page) {
  await signUpAsNewApplicant(page);
  await fillApplicationForm(page);

  const resume = Buffer.from("%PDF-1.7\nTest resume\n%%EOF");
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
}
