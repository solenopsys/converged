import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.argv[2];

if (!projectRoot) {
  console.error("[prune-container-tools] Usage: bun prune-container-tools.ts <project-root>");
  process.exit(1);
}

const toolsDir = resolve(projectRoot, "tools");
if (existsSync(toolsDir)) {
  for (const entry of readdirSync(toolsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "integration") continue;
    rmSync(resolve(toolsDir, entry.name), { recursive: true, force: true });
  }
}

const packageJsonPath = resolve(projectRoot, "package.json");
if (!existsSync(packageJsonPath)) {
  console.error(`[prune-container-tools] package.json not found at ${packageJsonPath}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));

if (Array.isArray(pkg.workspaces)) {
  pkg.workspaces = pkg.workspaces.filter(
    (workspace: string) =>
      workspace !== "tools/*" && workspace !== "../converged-portal/tools/*",
  );

  const requiredWorkspaces = [
    "tools/integration/*",
    "tools/integration/generated/*",
    "../converged-portal/tools/integration/*",
    "../converged-portal/tools/integration/generated/*",
  ];

  for (const workspace of requiredWorkspaces) {
    if (!pkg.workspaces.includes(workspace)) {
      pkg.workspaces.push(workspace);
    }
  }
}

writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`[prune-container-tools] Done for ${projectRoot}`);
