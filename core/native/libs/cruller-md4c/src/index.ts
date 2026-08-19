import { dlopen, FFIType, ptr, read } from "bun:ffi";
import { existsSync } from "fs";
import { join } from "path";

const SYMBOLS = {
  md4c_to_json: {
    args: [FFIType.ptr, FFIType.u64, FFIType.ptr, FFIType.ptr, FFIType.u32],
    returns: FFIType.i32,
  },
  md4c_free: {
    args: [FFIType.u64, FFIType.u64],
    returns: FFIType.void,
  },
} as const;

function resolveArch(runtimeArch: string): string {
  switch (runtimeArch) {
    case "x64":
      return "x86_64";
    case "arm64":
      return "aarch64";
    default:
      throw new Error(`Unsupported architecture '${runtimeArch}' for md4c native bindings`);
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
  const filename = `libmd4c-${arch}-${libc}.so`;
  const binLibsDir = process.env.BIN_LIBS_PATH;
  if (binLibsDir && binLibsDir.length > 0) {
    return join(binLibsDir, filename);
  }
  return `${import.meta.dir}/../bin-libs/${filename}`;
}

const lib = dlopen(getLibPath(), SYMBOLS);

// MD4C parser flags
export const MD_FLAG_COLLAPSEWHITESPACE = 0x0001;
export const MD_FLAG_PERMISSIVEATXHEADERS = 0x0002;
export const MD_FLAG_PERMISSIVEURLAUTOLINKS = 0x0004;
export const MD_FLAG_PERMISSIVEEMAILAUTOLINKS = 0x0008;
export const MD_FLAG_NOINDENTEDCODEBLOCKS = 0x0010;
export const MD_FLAG_NOHTMLBLOCKS = 0x0020;
export const MD_FLAG_NOHTMLSPANS = 0x0040;
export const MD_FLAG_TABLES = 0x0100;
export const MD_FLAG_STRIKETHROUGH = 0x0200;
export const MD_FLAG_PERMISSIVEWWWAUTOLINKS = 0x0400;
export const MD_FLAG_TASKLISTS = 0x0800;
export const MD_FLAG_LATEXMATHSPANS = 0x1000;
export const MD_FLAG_WIKILINKS = 0x2000;
export const MD_FLAG_UNDERLINE = 0x4000;

// Commonly used flag combinations
export const MD_DIALECT_GITHUB =
  MD_FLAG_PERMISSIVEATXHEADERS |
  MD_FLAG_PERMISSIVEURLAUTOLINKS |
  MD_FLAG_PERMISSIVEEMAILAUTOLINKS |
  MD_FLAG_PERMISSIVEWWWAUTOLINKS |
  MD_FLAG_TABLES |
  MD_FLAG_STRIKETHROUGH |
  MD_FLAG_TASKLISTS;

export interface MarkdownASTNode {
  type: string;
  text?: string;
  details?: Record<string, any>;
  children?: MarkdownASTNode[];
}

export interface ParseOptions {
  flags?: number;
}

export function mdToJson(
  markdown: string,
  options: ParseOptions = {},
): MarkdownASTNode {
  if (!markdown) {
    return { type: "root", children: [] };
  }
  const input = Buffer.from(markdown);
  const outputPtr = new BigUint64Array(1);
  const outputLen = new BigUint64Array(1);

  const flags = options.flags ?? MD_DIALECT_GITHUB;

  const rc = lib.symbols.md4c_to_json(
    ptr(input),
    BigInt(input.length),
    ptr(outputPtr),
    ptr(outputLen),
    flags,
  );

  if (rc !== 0) {
    throw new Error(`Failed to parse markdown: error code ${rc}`);
  }

  const resultPtr = Number(outputPtr[0]);
  const resultLen = Number(outputLen[0]);

  if (resultPtr === 0 || resultLen === 0) {
    throw new Error("Failed to parse markdown: no output generated");
  }

  // Read the JSON string from memory using Bun's FFI read utilities
  const jsonBytes = new Uint8Array(resultLen);
  for (let i = 0; i < resultLen; i++) {
    jsonBytes[i] = read.u8(resultPtr as any, i);
  }

  const jsonString = new TextDecoder().decode(jsonBytes);

  // Free the allocated memory
  lib.symbols.md4c_free(outputPtr[0], BigInt(resultLen));

  // Parse and return the JSON
  try {
    return JSON.parse(jsonString) as MarkdownASTNode;
  } catch (e) {
    console.error("Failed to parse JSON. Raw output:");
    console.error(jsonString.substring(0, 500));
    throw new Error(`Failed to parse JSON result: ${e}`);
  }
}
