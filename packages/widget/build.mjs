import { build, context } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The widget is served by Next from apps/web/public, and by nginx at /widget.js
const outfile = path.resolve(__dirname, "../../apps/web/public/widget.js");
mkdirSync(path.dirname(outfile), { recursive: true });

/** Hard ceiling from the spec. Build fails rather than silently bloating. */
const MAX_GZIP_BYTES = 15 * 1024;

const options = {
  entryPoints: [path.resolve(__dirname, "src/index.ts")],
  outfile,
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2017"],
  platform: "browser",
  legalComments: "none",
  banner: {
    js: "/*! Nodpeak widget — AGPL-3.0 — https://github.com/nodpeakapp/nodpeak */",
  },
};

if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("[widget] watching…");
} else {
  await build(options);
  const raw = readFileSync(outfile);
  const gz = gzipSync(raw, { level: 9 }).length;
  const pct = ((gz / MAX_GZIP_BYTES) * 100).toFixed(0);
  console.log(
    `[widget] ${outfile.replace(process.cwd() + "/", "")}  ` +
      `${(statSync(outfile).size / 1024).toFixed(1)} KB raw  ·  ` +
      `${(gz / 1024).toFixed(2)} KB gzipped  (${pct}% of the 15 KB budget)`,
  );
  if (gz > MAX_GZIP_BYTES) {
    console.error(`[widget] FAIL: ${gz} bytes gzipped exceeds the ${MAX_GZIP_BYTES} byte budget.`);
    process.exit(1);
  }
}
