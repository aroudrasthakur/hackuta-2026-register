import fs from "node:fs";
import path from "node:path";
import { test as base, expect } from "@playwright/test";

const coverageEnabled = process.env.VITE_COVERAGE === "true";
const coverageDir = path.join(process.cwd(), ".nyc_output");

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await use(page);

    if (!coverageEnabled) return;

    const coverage = await page.evaluate(() => (window as Window & { __coverage__?: object }).__coverage__);
    if (!coverage) return;

    fs.mkdirSync(coverageDir, { recursive: true });
    const safeId = testInfo.testId.replace(/[^\w-]/g, "_");
    fs.writeFileSync(
      path.join(coverageDir, `playwright-${testInfo.parallelIndex}-${safeId}.json`),
      JSON.stringify(coverage),
    );
  },
});

export { expect };
