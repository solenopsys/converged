import { build } from "bun";

await build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "browser",
  format: "esm",
  minify: true,
  naming: "renderer-runtime.js",
});

console.log("Renderer runtime build complete!");
