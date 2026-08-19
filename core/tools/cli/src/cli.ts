import { resolve, basename } from "path";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { pathToFileURL } from "url";
import { configureNrpcClientEnv } from "nrpc";
import { setCliSessionJwt } from "./ws";
import { runCli } from "./runner";
import { attachCliLogger } from "./state";

type Processor = {
  commands?: string[];
  // Set to false for sections that talk plain HTTP (e.g. fujin diagnostics)
  // and must not open the Fujin WebSocket channel.
  needsChannel?: boolean;
  processCommand: (command: string, param?: string) => Promise<void>;
};

// Parse --commands=dir1,dir2 from argv
const commandsDirs: string[] = [];
const passArgs: string[] = [];

let verbose = false;

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--commands=")) {
    commandsDirs.push(...arg.slice("--commands=".length).split(","));
  } else if (arg === "--verbose" || arg === "-v") {
    verbose = true;
  } else {
    passArgs.push(arg);
  }
}

// One switch traces the whole run, because every command goes through the model.
attachCliLogger(verbose || process.env.CLI_LOG === "1");

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
	const sessionToken = readSessionToken();
	if (sessionToken) return sessionToken;

	const envToken = process.env.SERVICE_TOKEN?.trim();
	if (envToken) return envToken;
	return undefined;
}

const resolvedToken = await resolveToken();
setCliSessionJwt(readSessionToken());
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
  // A command execution only needs its selected section. Loading every module
  // makes unrelated optional commands prevent or pollute normal CLI workflows.
  const filesToLoad = section ? files.filter((file) => basename(file, ".ts") === section) : files;

  for (const file of filesToLoad) {
    const name = basename(file, ".ts");
    let mod;
    try {
      mod = await import(pathToFileURL(resolve(absDir, file)).href);
    } catch (error) {
      console.warn(`[cli] Skipping broken command module ${file}:`, error instanceof Error ? error.message : error);
      continue;
    }
    const factory = mod.default ?? mod;
    if (typeof factory === "function") {
      processors[name] = factory();
    }
  }
}

if (section && processors[section]) {
	const exitCode = await runCli({
		section,
		command,
		param,
		processor: processors[section],
		sessionToken: readSessionToken(),
	});
	if (exitCode !== 0) process.exit(exitCode);
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
