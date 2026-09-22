// Copy shared Convex env from production onto the linked dev deployment,
// while keeping dev-specific auth/origin settings.
// Run: node scripts/sync-dev-convex-env.mjs
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const convexCli = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  "convex",
  "bin",
  "main.js",
);

/** Copied from prod so dev can send OTP, confirmations, and contact mail. */
const COPY_FROM_PROD = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "EMAIL_FROM",
  "CONTACT_EMAIL_TO",
  "REGISTRATION_ADMIN_IDENTITY_KEYS",
];

/** Dev-only values — never copied from prod. */
const DEV_ONLY = {
  SITE_URL: "http://127.0.0.1:5273",
  REGISTRATION_ALLOWED_ORIGINS: "http://127.0.0.1:5273,http://localhost:5273",
  REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS: "true",
};

function runConvex(args, { prod = false } = {}) {
  const argv = [convexCli, ...args];
  if (prod) argv.push("--prod");
  return execFileSync(process.execPath, argv, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function setDevEnv(name, value) {
  execFileSync(process.execPath, [convexCli, "env", "set", "--", name, value], {
    stdio: ["ignore", "inherit", "pipe"],
  });
}

function getProdEnv(name) {
  try {
    return runConvex(["env", "get", name], { prod: true });
  } catch {
    return "";
  }
}

for (const name of COPY_FROM_PROD) {
  const value = getProdEnv(name);
  if (!value) {
    console.log(`skip ${name} (not set on prod)`);
    continue;
  }
  setDevEnv(name, value);
  console.log(`✔ ${name}`);
}

for (const [name, value] of Object.entries(DEV_ONLY)) {
  setDevEnv(name, value);
  console.log(`✔ ${name} (dev)`);
}

console.log("\nDev JWT keys are unchanged. If missing, run: node scripts/generateAuthKeys.mjs");
