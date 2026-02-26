import { resolve } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import type { BuildConfig } from "../types";

const PROJECTS_DIR = resolve(import.meta.dir, "../../../../../");
const CONFS_DIR = resolve(PROJECTS_DIR, "../confs");

export interface SecretsOptions {
  projectName: string;
  envFile?: string;
  outputDir: string;
  namespace?: string;
}

function parseDotEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eqIndex = normalized.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = normalized.slice(0, eqIndex).trim();
    if (!key || !/^[a-zA-Z_]\w*$/.test(key)) continue;
    let value = normalized.slice(eqIndex + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
        .replace(/\\n/g, "\n").replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else {
      const commentIdx = value.indexOf(" #");
      if (commentIdx >= 0) value = value.slice(0, commentIdx).trim();
    }
    env[key] = value;
  }
  return env;
}

function toBase64(value: string): string {
  return Buffer.from(value).toString("base64");
}

export async function runSecrets(opts: SecretsOptions) {
  const { projectName, outputDir } = opts;

  // Load config
  const projectDir = resolve(PROJECTS_DIR, projectName);
  const configPath = resolve(projectDir, "config.json");
  if (!existsSync(configPath)) {
    console.error(`Error: config.json not found at ${configPath}`);
    process.exit(1);
  }
  const config: BuildConfig = JSON.parse(readFileSync(configPath, "utf8"));

  // Find .env file
  const envFilePath = opts.envFile
    ? resolve(CONFS_DIR, opts.envFile)
    : resolve(CONFS_DIR, `${projectName}.env`);

  if (!existsSync(envFilePath)) {
    console.error(`Error: env file not found at ${envFilePath}`);
    console.error(`Hint: pass --env-file=<path> or place it at ${envFilePath}`);
    process.exit(1);
  }

  const envVars = parseDotEnv(readFileSync(envFilePath, "utf8"));

  if (Object.keys(envVars).length === 0) {
    console.log("No variables found in env file — nothing to do.");
    return;
  }

  const namespace = opts.namespace ?? config.name;

  // Build secret data from all env vars
  const secretName = `${config.name}-secrets`;
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(envVars)) {
    data[key] = toBase64(value);
  }

  const yaml = [
    `apiVersion: v1`,
    `kind: Secret`,
    `metadata:`,
    `  name: ${secretName}`,
    `  namespace: ${namespace}`,
    `type: Opaque`,
    `data:`,
    ...Object.entries(data).map(([k, v]) => `  ${k}: ${v}`),
    "",
  ].join("\n");

  const absOutputDir = resolve(import.meta.dir, outputDir);
  mkdirSync(absOutputDir, { recursive: true });
  const outPath = resolve(absOutputDir, `${secretName}.yaml`);
  writeFileSync(outPath, yaml, "utf8");

  console.log(`Secret "${secretName}" written to ${outPath}`);
  console.log(`Keys: ${Object.keys(data).join(", ")}`);
  console.log(`\nApply with: kubectl apply -f ${outPath} -n <namespace>`);
}
