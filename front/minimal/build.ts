import { build } from "bun";

await build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  target: "browser",
  format: "esm",
  minify: false,
  sourcemap: "external",
  external: [
    "@solenopsys/converged-style",
    "@solenopsys/converged-renderer",
    "@solenopsys/converged-reactive",
  ],
});

console.log("Build complete!");
