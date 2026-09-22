import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = join(root, "convex", "_generated");
const target = join(targetDir, "server.ts");
const source = join(root, "scripts", "convex-server-stub.ts");

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
