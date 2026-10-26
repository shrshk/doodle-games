// Prints every inbuilt board plus the cut-out page to exports/boards-a4.pdf: builds print.html as a
// static bundle, serves it with `vite preview`, loads it in headless Chrome and prints to PDF.
// A built bundle keeps printing independent of any running dev server. print.css switches every
// animation off: endless doodle animations keep headless Chrome's virtual clock from ever settling,
// so it never prints. Fonts are bundled, so no network is needed. Chrome runs async: the preview
// server lives in this process, and a sync spawn would block it from answering Chrome.
// Set CHROME=/path/to/chrome if Chrome is not in the default macOS location.
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build, preview } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outDir = resolve(root, "../../exports");
const out = join(outDir, "boards-a4.pdf");
mkdirSync(outDir, { recursive: true });

const bundle = mkdtempSync(join(tmpdir(), "snl-print-build-"));
await build({
  root,
  logLevel: "error",
  build: { outDir: bundle, emptyOutDir: true, rollupOptions: { input: resolve(root, "print.html") } },
});
const server = await preview({ root, logLevel: "error", build: { outDir: bundle }, preview: { port: 5190, strictPort: false } });
// its own throwaway profile, so an already-open Chrome does not take the job
const profile = mkdtempSync(join(tmpdir(), "snl-print-"));
try {
  await promisify(execFile)(
    chrome,
    [
      "--headless",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--disable-gpu",
      "--no-pdf-header-footer",
      "--virtual-time-budget=15000",
      `--print-to-pdf=${out}`,
      `${server.resolvedUrls.local[0]}print.html`,
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  console.log(`boards written to ${out}`);
} finally {
  await new Promise((done) => server.httpServer.close(done));
  rmSync(profile, { recursive: true, force: true });
  rmSync(bundle, { recursive: true, force: true });
}
