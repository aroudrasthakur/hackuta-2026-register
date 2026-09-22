import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const response = await fetch(
  "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json",
);
if (!response.ok) {
  throw new Error(`Failed to fetch ISO countries: ${response.status}`);
}

/** @type {Array<{ name: string }>} */
const countries = await response.json();
const names = [...new Set(countries.map((entry) => entry.name.trim()).filter(Boolean))];
const priority = ["United States of America"];
const ordered = [
  ...priority.filter((name) => names.includes(name)),
  ...names.filter((name) => !priority.includes(name)).sort((a, b) => a.localeCompare(b)),
];

const outPath = path.resolve(repoRoot, "shared/registration/countries.ts");
fs.writeFileSync(
  outPath,
  `/** ISO 3166 country names — United States first for HackUTA applicants. */
export const COUNTRIES_OF_RESIDENCE = ${JSON.stringify(ordered, null, 2)} as const;

export type CountryOfResidence = (typeof COUNTRIES_OF_RESIDENCE)[number];
`,
  "utf8",
);
console.log(`Wrote ${ordered.length} countries to ${outPath}`);
