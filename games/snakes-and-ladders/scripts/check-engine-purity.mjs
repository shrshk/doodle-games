// The engine must stay pure so client and server replay identically.
// Fails if an engine's src (tests excluded) touches randomness, time, DOM or IO. Checks the engine
// directories given as arguments (relative to the repo root), or Snakes & Ladders' by default.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const repo = new URL("../../..", import.meta.url).pathname;
const roots = process.argv.length > 2 ? process.argv.slice(2).map((d) => join(repo, d)) : [new URL("../packages/engine/src", import.meta.url).pathname];
const banned = [
  /\bMath\.random\b/,
  /\bDate\b/,
  /\bperformance\.now\b/,
  /\b(window|document|localStorage|sessionStorage|navigator)\b/,
  /\bfetch\s*\(/,
  /\bsetTimeout\b|\bsetInterval\b/,
  /from\s+["']node:/,
];

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) files.push(p);
  }
};
roots.forEach(walk);

let failed = false;
for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (line.trim().startsWith("//")) return;
      for (const re of banned) {
        if (re.test(line)) {
          console.error(`${file}:${i + 1}: engine purity violation (${re}): ${line.trim()}`);
          failed = true;
        }
      }
    });
}
if (failed) process.exit(1);
console.log(`engine purity ok (${files.length} files)`);
