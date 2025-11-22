import { build } from "bun";

await build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "browser",
  format: "esm",
  minify: true,
  naming: "style-runtime.js",
});

console.log("Style runtime build complete!");
