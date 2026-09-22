import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const csvCandidates = [
  path.resolve(repoRoot, "shared/registration/data/schools.csv"),
  path.resolve(
    repoRoot,
    "../.cursor/projects/c-Users-aroud-OneDrive-Documents-GitHub-Website-hackuta-2026-repository/uploads/schools-0.csv",
  ),
];

const csvPath = csvCandidates.find((candidate) => fs.existsSync(candidate));
if (!csvPath) {
  throw new Error("MLH schools CSV not found. Place schools.csv in shared/registration/data/.");
}

const raw = fs.readFileSync(csvPath, "utf8");
const schools = raw
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.replace(/^"|"$/g, "").trim())
  .filter(Boolean);

const priority = [
  "The University of Texas at Arlington",
  "University of Texas at Arlington",
];

const ordered = [
  ...priority.filter((name) => schools.includes(name)),
  ...schools.filter((name) => !priority.includes(name)).sort((a, b) => a.localeCompare(b)),
];

const outPath = path.resolve(repoRoot, "shared/registration/mlhSchools.ts");
const contents = `/** Generated from MLH schools.csv — do not edit by hand. */
export const MLH_SCHOOLS = ${JSON.stringify(ordered, null, 2)} as const;

export type MlhSchool = (typeof MLH_SCHOOLS)[number];

export const MLH_SCHOOLS_SET = new Set<string>(MLH_SCHOOLS);
`;

fs.writeFileSync(outPath, contents, "utf8");
console.log(`Wrote ${ordered.length} schools to ${outPath}`);
