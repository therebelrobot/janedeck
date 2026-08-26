// scripts/write-templates.mjs — Write the downloadable CSV templates to docs/templates/
//
// The templates are generated from the same functions the app's "Download
// Template" buttons call, so the files people grab from GitHub can't drift
// away from what the app produces. Run after changing anything in
// src/client/utils/csv.ts:
//
//   npm run templates
//
// CI re-runs this and fails if the committed files come out different (see
// .github/workflows/templates.yml).
//
// csv.ts is TypeScript and imports through the `@/shared` alias, so it's
// loaded via Vite's SSR module loader rather than Node directly. The Vite
// config here is inline and minimal on purpose — loading vite.config.ts would
// drag in the Cloudflare plugin, which has no business running for this.

import { createServer } from "vite";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "docs", "templates");

/** Which generator function produces which file. */
const TEMPLATES = [
  { fn: "templateCSV", file: "janedeck-trivia-template.csv" },
  { fn: "bingoTemplateCSV", file: "janedeck-bingo-template.csv" },
];

const server = await createServer({
  configFile: false,
  root: ROOT,
  logLevel: "warn",
  appType: "custom",
  server: { middlewareMode: true },
  // Nothing here needs pre-bundled browser deps, and letting Vite scan
  // index.html for them just produces a wall of errors when the server closes
  // mid-scan.
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: {
    alias: {
      "@/shared": path.join(ROOT, "src/shared"),
      "@/client": path.join(ROOT, "src/client"),
      "@/server": path.join(ROOT, "src/server"),
    },
  },
});

let changed = 0;
try {
  const csv = await server.ssrLoadModule("/src/client/utils/csv.ts");
  mkdirSync(OUT_DIR, { recursive: true });

  for (const { fn, file } of TEMPLATES) {
    if (typeof csv[fn] !== "function") {
      throw new Error(`src/client/utils/csv.ts no longer exports ${fn}()`);
    }
    const contents = csv[fn]();
    const target = path.join(OUT_DIR, file);
    const existing = existsSync(target) ? readFileSync(target, "utf8") : null;

    if (existing === contents) {
      console.log(`unchanged  docs/templates/${file}`);
      continue;
    }
    writeFileSync(target, contents);
    console.log(`written    docs/templates/${file}`);
    changed++;
  }
} finally {
  await server.close();
}

console.log(
  changed === 0
    ? "Templates are up to date."
    : `Wrote ${changed} template${changed === 1 ? "" : "s"}.`,
);
