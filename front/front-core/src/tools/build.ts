import { mkdirSync, statSync, writeFileSync } from "fs";

const EXTERNAL_PACKAGES = [
  "@solenopsys/converged-reactive",
  "@solenopsys/converged-renderer",
  "@solenopsys/converged-router",
  "@solenopsys/converged-style",
];

const size = (p: string) => {
  try {
    return `${(statSync(p).size / 1024).toFixed(1)}kb`;
  } catch {
    return "0kb";
  }
};

mkdirSync("dist", { recursive: true });

const importMap = { imports: {} as Record<string, string> };
writeFileSync("dist/import-map.json", JSON.stringify(importMap, null, 2));
console.log(
  `📋 import-map.json - ${Object.keys(importMap.imports).length} packages`,
);

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  format: "esm",
  minify: true,
  sourcemap: "linked",
  target: "browser",
  external: EXTERNAL_PACKAGES,
  tsconfig: "./tsconfig.json",
});

console.log(`📦 index.js - ${size("dist/index.js")}`);
