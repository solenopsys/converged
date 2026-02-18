import { resolve, basename } from "path";
import { readdirSync } from "fs";
import { pathToFileURL } from "url";

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

const [section, command, param] = passArgs;

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
