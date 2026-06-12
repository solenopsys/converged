import { resolve, basename } from "path";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { pathToFileURL } from "url";
import { generateServiceToken, configureNrpcClientEnv } from "nrpc";

type Processor = {
  commands?: string[];
  processCommand: (command: string, param?: string) => Promise<void>;
};

// Parse --commands=dir1,dir2 from argv
const commandsDirs: string[] = [];
const passArgs: string[] = [];

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--commands=")) {
    commandsDirs.push(...arg.slice("--commands=".length).split(","));
  } else {
    passArgs.push(arg);
  }
}

const [section, command, ...paramParts] = passArgs;
const param = paramParts.length > 0 ? paramParts.join(" ") : undefined;

function readSessionToken(): string | undefined {
  const sessionPath = process.env.GESTALT_CLI_SESSION || join(homedir(), ".config", "gestalt", "cli", "session.json");
  try {
    const session = JSON.parse(readFileSync(sessionPath, "utf8"));
    const token = session?.token?.trim();
    return token || undefined;
  } catch {
    return undefined;
  }
}

async function resolveToken(): Promise<string | undefined> {
  const envToken = process.env.SERVICE_TOKEN?.trim();
  if (envToken) return envToken;

  const sessionToken = readSessionToken();
  if (sessionToken) return sessionToken;

  const secret = process.env.ACCESS_JWT_SECRET?.trim();
  if (!secret) return undefined;

  try {
    return await generateServiceToken(secret);
  } catch (error) {
    console.warn("[cli] Failed to generate SERVICE_TOKEN:", error);
    return undefined;
  }
}

const resolvedToken = await resolveToken();
if (resolvedToken) {
  configureNrpcClientEnv({ serviceToken: resolvedToken });
}

// Scan directories and load command modules
const processors: Record<string, Processor> = {};

for (const dir of commandsDirs) {
  const absDir = resolve(dir);
  const files = readdirSync(absDir).filter(
    (f) => f.endsWith(".ts") && f !== "package.json" && f !== "index.ts",
  );

  for (const file of files) {
    const name = basename(file, ".ts");
    const mod = await import(pathToFileURL(resolve(absDir, file)).href);
    const factory = mod.default ?? mod;
    if (typeof factory === "function") {
      processors[name] = factory();
    }
  }
}

if (section && processors[section]) {
  processors[section].processCommand(command, param);
} else {
  if (section) {
    console.log(`Unknown section: ${section}\n`);
  }
  console.log("\nSupported commands\n");
  console.log("  Usage: bun cli <section> <command> [param]\n");
  for (const name of Object.keys(processors).sort()) {
    const cmds = processors[name].commands;
    console.log(`  ${name} ${cmds?.length ? `[${cmds.join(", ")}]` : ""}`);
  }
}
