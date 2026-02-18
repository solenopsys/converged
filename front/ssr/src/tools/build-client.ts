import { mkdirSync } from "fs";
import { resolve } from "path";
import { externalPackages } from "front-core/runtime-config";
import { createWorkspaceResolverPlugin } from "front-core/workspace-resolver";

const landingRoot = process.cwd();
const projectRoot = process.env.PROJECT_DIR ?? resolve(landingRoot, "..", "..");
const parentProjectRoot =
  process.env.PARENT_PROJECT_DIR && process.env.PARENT_PROJECT_DIR.length > 0
    ? process.env.PARENT_PROJECT_DIR
    : undefined;

const result = await Bun.build({
  entrypoints: [resolve(landingRoot, "src", "client.tsx")],
  target: "browser",
  format: "esm",
  minify: true,
  define: {
    "process.env.NODE_ENV": "\"production\"",
    "import.meta.env.PROD": "true",
    "import.meta.env.DEV": "false",
  },
  jsx: {
    runtime: "automatic",
  },
  external: externalPackages,
  plugins: [createWorkspaceResolverPlugin(projectRoot, parentProjectRoot)],
});

if (!result.success) {
  const errors = result.logs.map((item) => item.message).join("\n");
  throw new Error(`Failed to build landing client:\n${errors}`);
}
if (result.outputs.length === 0) {
  throw new Error("Failed to build landing client: no output emitted");
}
const outPath = resolve(landingRoot, "dist", "client.js");
mkdirSync(resolve(landingRoot, "dist"), { recursive: true });
await Bun.write(outPath, result.outputs[0]);

console.log("[landing] built client.js");
