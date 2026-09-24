/**
 * Enforce the coverage policy (scripts/coverage-policy.mjs) on collected Istanbul data.
 *
 * Reads unit coverage from coverage/unit/coverage-final.json and, when present,
 * Playwright coverage from .nyc_output/*.json. Checks every metric globally and
 * per functional area, prints a table, and appends a Markdown summary to
 * $GITHUB_STEP_SUMMARY when running in GitHub Actions. Exits 1 on any miss.
 */
import istanbulCoverage from "istanbul-lib-coverage";
import istanbulReport from "istanbul-lib-report";
import istanbulReports from "istanbul-reports";
import { createInstrumenter } from "istanbul-lib-instrument";
import { globSync } from "glob";
import picomatch from "picomatch";
import fs from "node:fs";
import path from "node:path";
import {
  COVERAGE_AREAS,
  COVERAGE_EXCLUDE,
  COVERAGE_INCLUDE,
  METRICS,
  MINIMUM,
} from "./coverage-policy.mjs";

const { createCoverageMap } = istanbulCoverage;
const { createContext } = istanbulReport;

const instrumenter = createInstrumenter({
  parserPlugins: ["typescript", "jsx"],
});

function zeroCoverageForFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  instrumenter.instrumentSync(source, filePath);
  const coverage = instrumenter.lastFileCoverage();
  for (const key of Object.keys(coverage.s)) {
    coverage.s[key] = 0;
  }
  for (const key of Object.keys(coverage.f)) {
    coverage.f[key] = 0;
  }
  for (const key of Object.keys(coverage.b)) {
    coverage.b[key] = coverage.b[key].map(() => 0);
  }
  return coverage;
}

const root = process.cwd();
const unitCoverageFile = path.resolve("coverage/unit/coverage-final.json");
const e2eCoverageDir = path.resolve(".nyc_output");
const reportDir = path.resolve("coverage/merged");

const isIncluded = picomatch(COVERAGE_INCLUDE);
const isExcluded = picomatch(COVERAGE_EXCLUDE);

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function inScope(filePath) {
  const rel = relative(filePath);
  return isIncluded(rel) && !isExcluded(rel);
}

function scopedSourceFiles() {
  const files = new Set();
  for (const pattern of COVERAGE_INCLUDE) {
    for (const file of globSync(pattern, { cwd: root, nodir: true, absolute: true })) {
      if (inScope(file)) {
        files.add(path.resolve(file));
      }
    }
  }
  return [...files];
}

function coverageInputs() {
  const inputs = [];
  if (fs.existsSync(unitCoverageFile)) inputs.push(unitCoverageFile);
  if (fs.existsSync(e2eCoverageDir)) {
    for (const file of fs.readdirSync(e2eCoverageDir)) {
      if (file.endsWith(".json")) inputs.push(path.join(e2eCoverageDir, file));
    }
  }
  return inputs;
}

const inputs = coverageInputs();
if (inputs.length === 0) {
  console.error("ERROR: No coverage data found. Run `npm run test:unit:coverage` first.");
  process.exit(1);
}

// Only raw per-file coverage (with statement maps) can be merged; skip summaries.
function isFileCoverage(value) {
  return Boolean(value) && typeof value === "object" && "statementMap" in value;
}

const map = createCoverageMap({});
for (const file of inputs) {
  const content = JSON.parse(fs.readFileSync(file, "utf8"));
  map.merge(
    Object.fromEntries(
      Object.entries(content).filter(([filePath, value]) => isFileCoverage(value) && inScope(filePath)),
    ),
  );
}

/** Match Vitest `coverage.all` — untested files count as 0%, not as absent. */
function addMissingScopedFiles() {
  const covered = new Set(map.files().map((file) => path.resolve(file)));
  for (const file of scopedSourceFiles()) {
    if (covered.has(file)) {
      continue;
    }
    map.addFileCoverage(zeroCoverageForFile(file));
  }
}

addMissingScopedFiles();

fs.mkdirSync(reportDir, { recursive: true });
const context = createContext({ dir: reportDir, coverageMap: map });
istanbulReports.create("text-summary").execute(context);

function summarize(files) {
  const summary = istanbulCoverage.createCoverageSummary();
  for (const file of files) summary.merge(map.fileCoverageFor(file).toSummary());
  return summary;
}

const allFiles = map.files();
const rows = [["All files", summarize(allFiles), allFiles.length]];
for (const [name, glob] of Object.entries(COVERAGE_AREAS)) {
  const matches = picomatch(glob);
  const files = allFiles.filter((file) => matches(relative(file)));
  rows.push([name, summarize(files), files.length]);
}

const failures = [];
for (const [name, summary, fileCount] of rows) {
  if (fileCount === 0) {
    failures.push(`${name}: no files matched`);
    continue;
  }
  for (const metric of METRICS) {
    const pct = summary[metric].pct;
    if (pct + 1e-6 < MINIMUM) failures.push(`${name}: ${metric} ${pct}% < ${MINIMUM}%`);
  }
}

const header = ["Area", "Files", ...METRICS.map((m) => m[0].toUpperCase() + m.slice(1))];
const table = rows.map(([name, summary, fileCount]) => [
  name,
  String(fileCount),
  ...METRICS.map((metric) => `${summary[metric].pct.toFixed(2)}%`),
]);

console.log(`\nCoverage by functional area (minimum ${MINIMUM}% per metric)`);
console.table(Object.fromEntries(table.map(([name, ...cells]) => [name, Object.fromEntries(header.slice(1).map((h, i) => [h, cells[i]]))])));

if (process.env.GITHUB_STEP_SUMMARY) {
  const markdown = [
    `### Unit test coverage (minimum ${MINIMUM}%)`,
    "",
    `| ${header.join(" | ")} |`,
    `| ${header.map((_, i) => (i === 0 ? "---" : "---:")).join(" | ")} |`,
    ...table.map((cells) => `| ${cells.join(" | ")} |`),
    "",
    failures.length ? `**Failed:**\n${failures.map((f) => `- ${f}`).join("\n")}` : "All thresholds met.",
    "",
  ].join("\n");
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
}

if (failures.length) {
  for (const failure of failures) console.error(`ERROR: ${failure}`);
  process.exit(1);
}
