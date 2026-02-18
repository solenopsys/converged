import { Database, type DatabaseOptions } from "bun:sqlite";
import { existsSync } from "fs";
import { join } from "path";

const DEFAULT_ENTRYPOINT = "sqlite3_stanchion_init";
const EXTENSION_ENV_VAR = "BUN_STANCHION_EXTENSION";

function resolveArch(runtimeArch: string): string {
  switch (runtimeArch) {
    case "x64":
      return "x86_64";
    case "arm64":
      return "aarch64";
    default:
      throw new Error(
        `Unsupported architecture '${runtimeArch}' for stanchion native bindings`,
      );
  }
}

function detectLibcVariant(): "gnu" | "musl" | undefined {
  if (process.platform !== "linux") {
    return undefined;
  }

  const report = (process as any).report?.getReport?.();
  const glibcVersion = report?.header?.glibcVersionRuntime;
  if (typeof glibcVersion === "string" && glibcVersion.length > 0) {
    return "gnu";
  }

  const muslMarkers = [
    "/lib/ld-musl-x86_64.so.1",
    "/lib/ld-musl-aarch64.so.1",
    "/lib/ld-musl.so.1",
  ];

  if (muslMarkers.some((marker) => existsSync(marker))) {
    return "musl";
  }

  return undefined;
}

function getLibPath(): string {
  const arch = resolveArch(process.arch);
  const libc = detectLibcVariant() || "gnu";
  const filename = `libstanchion-${arch}-${libc}.so`;
  return join(import.meta.dir, "..", "bin-libs", filename);
}

function resolveExtensionPath(customPath?: string): string {
  if (customPath) {
    return customPath;
  }

  const envPath = process.env[EXTENSION_ENV_VAR];
  if (envPath) {
    return envPath;
  }

  return getLibPath();
}

export interface StanchionLoadOptions {
  extensionPath?: string;
  entryPoint?: string;
}

export function loadStanchion(
  db: Database,
  options: StanchionLoadOptions = {},
): void {
  const extensionPath = resolveExtensionPath(options.extensionPath);
  if (!existsSync(extensionPath)) {
    throw new Error(`Stanchion extension not found at '${extensionPath}'`);
  }

  db.loadExtension(extensionPath, options.entryPoint ?? DEFAULT_ENTRYPOINT);
}

export interface StanchionDatabaseOptions
  extends DatabaseOptions, StanchionLoadOptions {}

export class StanchionDatabase extends Database {
  constructor(filename: string, options: StanchionDatabaseOptions = {}) {
    const { extensionPath, entryPoint, ...dbOptions } = options;
    const hasDbOptions = Object.keys(dbOptions).length > 0;
    super(filename, hasDbOptions ? dbOptions : undefined);
    loadStanchion(this, { extensionPath, entryPoint });
  }
}
