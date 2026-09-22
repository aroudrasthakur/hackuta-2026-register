// One-off script to generate and set Convex Auth's JWT_PRIVATE_KEY/JWKS pair.
// Run with: node scripts/generateAuthKeys.mjs
// Sets the vars directly on the linked Convex dev deployment so the private
// key is never printed to the terminal or committed anywhere.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
const privateKeySingleLine = privateKey.trimEnd().replace(/\n/g, " ");

// Invoke the Convex CLI's JS entry directly with node.exe (not the npx.cmd
// wrapper) so argv is passed as a real array with no shell re-parsing/escaping.
const convexCli = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  "convex",
  "bin",
  "main.js",
);

function setConvexEnv(name, value) {
  try {
    // `--` stops the CLI's arg parser from treating a leading "-----BEGIN..." as a flag.
    execFileSync(process.execPath, [convexCli, "env", "set", "--", name, value], {
      stdio: ["ignore", "inherit", "pipe"],
    });
  } catch {
    // Re-throw without the original error object: it embeds the full argv (the secret value).
    throw new Error(`Failed to set ${name} via convex CLI. See stdout above for details.`);
  }
}

setConvexEnv("JWT_PRIVATE_KEY", privateKeySingleLine);
setConvexEnv("JWKS", jwks);

console.log("JWT_PRIVATE_KEY and JWKS set on the linked Convex dev deployment.");
