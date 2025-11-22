import { build } from "bun";

await build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "browser",
  format: "esm",
  minify: true,
  naming: "reactive-runtime.js",
});

console.log("Reactive runtime build complete!");
