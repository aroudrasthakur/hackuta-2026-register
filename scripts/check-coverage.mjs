import istanbulCoverage from "istanbul-lib-coverage";
import istanbulReport from "istanbul-lib-report";
import istanbulReports from "istanbul-reports";
const { createCoverageMap } = istanbulCoverage;
const { createContext } = istanbulReport;
import fs from "node:fs";
import path from "node:path";

const coverageDir = path.resolve(".nyc_output");
const reportDir = path.resolve("coverage");
const excludedSuffixes = [
  "src/main.tsx",
  "src/components/",
  "src/constants/images.ts",
  "src/convex/client.ts",
  "src/pages/Register/RegisterPage.tsx",
];

const thresholds = {
  lines: 80,
  statements: 80,
  functions: 80,
  branches: 80,
};

const map = createCoverageMap({});

for (const file of fs.readdirSync(coverageDir)) {
  if (!file.endsWith(".json")) continue;
  if (file.includes("summary") || file.includes("merged")) continue;

  const content = JSON.parse(fs.readFileSync(path.join(coverageDir, file), "utf8"));
  const filtered = Object.fromEntries(
    Object.entries(content).filter(([filePath]) => {
      const normalized = filePath.replace(/\\/g, "/");
      return !excludedSuffixes.some((suffix) =>
        suffix.endsWith("/") ? normalized.includes(suffix) : normalized.endsWith(suffix),
      );
    }),
  );
  map.merge(filtered);
}

fs.mkdirSync(reportDir, { recursive: true });

const context = createContext({ dir: reportDir, coverageMap: map });
istanbulReports.create("text").execute(context);
istanbulReports.create("text-summary").execute(context);

const summary = map.getCoverageSummary();
let failed = false;

for (const [metric, minimum] of Object.entries(thresholds)) {
  const pct = summary[metric].pct;
  if (pct + 1e-6 < minimum) {
    console.error(`ERROR: Coverage for ${metric} (${pct}%) does not meet global threshold (${minimum}%)`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
