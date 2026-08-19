#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "fs";
import { resolve, join, relative } from "path";
import { InterfaceParser } from "./generator/parser";
import type { MethodMetadata, TypeMetadata } from "./types";

function derivePackageName(relPath: string): string {
  const parts = relPath.replace(/\.ts$/, "").split("/");
  const fileName = parts[parts.length - 1];
  const prefixMap: Record<string, string> = { runtime: "rt" };
  const prefix = prefixMap[parts[0]];
  return prefix ? `g-${prefix}-${fileName}` : `g-${fileName}`;
}

function generateTypeDefinitions(types: TypeMetadata[]): string {
  return types
    .map((type) => {
      if (type.kind === "raw") {
        return type.definition;
      }
      if (type.properties && type.properties.length > 0) {
        const props = type.properties
          .map((prop) => {
            const optional = prop.optional ? "?" : "";
            const arrayType = prop.isArray ? "[]" : "";
            return `  ${prop.name}${optional}: ${prop.type}${arrayType};`;
          })
          .join("\n");

        return `export interface ${type.name}${type.typeParameters || ""} {\n${props}\n}`;
      }
      return `export type ${type.name}${type.typeParameters || ""} = ${type.definition || "any"};`;
    })
    .join("\n\n");
}

function renderParams(method: MethodMetadata): string {
  return method.parameters
    .map((p) => {
      const optional = p.optional ? "?" : "";
      const arrayType = p.isArray ? "[]" : "";
      return `${p.name}${optional}: ${p.type}${arrayType}`;
    })
    .join(", ");
}

function renderServerReturnType(method: MethodMetadata): string {
  const returnTypeArray = method.returnTypeIsArray ? "[]" : "";

  if (method.isAsyncIterable) {
    return `AsyncIterable<${method.returnType}${returnTypeArray}>`;
  }
  if (method.isAsync) {
    if (method.returnType === "void") {
      return "Promise<void>";
    }
    return `Promise<${method.returnType}${returnTypeArray}>`;
  }
  return `${method.returnType}${returnTypeArray}`;
}

function renderClientReturnType(method: MethodMetadata): string {
  const returnTypeArray = method.returnTypeIsArray ? "[]" : "";

  if (method.isAsyncIterable) {
    return `AsyncIterable<${method.returnType}${returnTypeArray}>`;
  }
  const baseType =
    method.returnType === "void"
      ? "void"
      : `${method.returnType}${returnTypeArray}`;
  return `Promise<${baseType}>`;
}

// RT client is synchronous: the RT VM runs each workflow in a single QuickJS
// evaluation, so there is no event loop to await. (Streaming is unsupported.)
function renderRtReturnType(method: MethodMetadata): string {
  const returnTypeArray = method.returnTypeIsArray ? "[]" : "";
  if (method.returnType === "void") return "void";
  return `${method.returnType}${returnTypeArray}`;
}

function renderMethodName(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

export function generatePackage(
  typesFile: string,
  genParentDir: string,
  typesRoot?: string,
): string {
  const cwd = process.cwd();
  const typesPath = resolve(cwd, typesFile);
  const typesRootPath = typesRoot ? resolve(cwd, typesRoot) : cwd;

  console.log(`🔧 Generating from ${typesPath}...`);

  const parser = new InterfaceParser();
  const metadata = parser.parseInterface(typesPath);
  const metadataWithRelativePath = {
    ...metadata,
    filePath: relative(typesRootPath, typesPath).replaceAll("\\", "/"),
  };

  const relPath = relative(typesRootPath, typesPath).replaceAll("\\", "/");
  const packageName = derivePackageName(relPath);
  const packageDir = resolve(cwd, genParentDir, packageName);
  const srcDir = join(packageDir, "src");

  mkdirSync(srcDir, { recursive: true });

  const typeDefinitions = generateTypeDefinitions(metadata.types);

  const serverMethods = metadata.methods
    .map((method) => {
      const params = renderParams(method);
      const returnType = renderServerReturnType(method);
      return `  ${renderMethodName(method.name)}(${params}): ${returnType};`;
    })
    .join("\n");

  const clientMethods = metadata.methods
    .map((method) => {
      const params = renderParams(method);
      const returnType = renderClientReturnType(method);
      return `  ${renderMethodName(method.name)}(${params}): ${returnType};`;
    })
    .join("\n");

  const rtClientMethods = metadata.methods
    .map((method) => {
      const params = renderParams(method);
      const returnType = renderRtReturnType(method);
      return `  ${renderMethodName(method.name)}(${params}): ${returnType};`;
    })
    .join("\n");

  const clusterCode = `// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

${typeDefinitions}

export const metadata: ServiceMetadata = ${JSON.stringify(metadataWithRelativePath, null, 2)};

// Server interface (to be implemented in microservice)
export interface ${metadata.interfaceName} {
${serverMethods}
}

// Client interface
export interface ${metadata.interfaceName}Client {
${clientMethods}
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function create${metadata.interfaceName}Client(
  config: CrullerTransportClientConfig,
): ${metadata.interfaceName}Client {
  return createCrullerTransportClient<${metadata.interfaceName}Client>(metadata, config);
}

export function create${metadata.interfaceName}CrullerTransportClient(
  config: CrullerTransportClientConfig,
): ${metadata.interfaceName}Client {
  return create${metadata.interfaceName}Client(config);
}
`;

  const browserCode = `// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

${typeDefinitions}

export const metadata: ServiceMetadata = ${JSON.stringify(metadataWithRelativePath, null, 2)};

// Client interface
export interface ${metadata.interfaceName}Client {
${clientMethods}
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function create${metadata.interfaceName}Client(
  config: WebSocketClientConfig,
): ${metadata.interfaceName}Client {
  return createWebSocketClient<${metadata.interfaceName}Client>(metadata, config);
}

export function create${metadata.interfaceName}WebSocketClient(
  config: WebSocketClientConfig,
): ${metadata.interfaceName}Client {
  return create${metadata.interfaceName}Client(config);
}
`;

  // RT entrypoint: self-contained (own copy of metadata + types) so a workflow
  // bundle for the RT VM never pulls in the HTTP transport. Imported as
  // `<package>/rt`; bun tree-shakes unused methods at compile time.
  const rtCode = `// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

${typeDefinitions}

const metadata: ServiceMetadata = ${JSON.stringify(metadataWithRelativePath, null, 2)};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface ${metadata.interfaceName}RtClient {
${rtClientMethods}
}

export function create${metadata.interfaceName}RtClient(): ${metadata.interfaceName}RtClient {
  return createRtClient<${metadata.interfaceName}RtClient>(metadata);
}
`;

  const packageJson = {
    name: packageName,
    version: "0.0.0",
    type: "module",
    private: true,
    module: "src/index.ts",
    browser: "./src/browser.ts",
    exports: {
      ".": {
        browser: "./src/browser.ts",
        default: "./src/index.ts",
      },
      "./browser": "./src/browser.ts",
      "./cluster": "./src/index.ts",
      "./rt": "./src/rt.ts",
    },
    files: ["src", "package.json"],
    dependencies: {
      nrpc: "workspace:*",
    },
  };

  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify(packageJson, null, 2),
  );
  writeFileSync(join(srcDir, "index.ts"), clusterCode);
  writeFileSync(join(srcDir, "browser.ts"), browserCode);
  writeFileSync(join(srcDir, "rt.ts"), rtCode);

  console.log(`✅ Generated package: ${packageDir}`);
  return packageDir;
}

if (import.meta.main) {
  const [typesFile, genParentDir, typesRoot] = process.argv.slice(2);
  if (!typesFile || !genParentDir) {
    console.error("Usage: gen <types-file> <gen-parent-dir> [types-root]");
    console.error(
      "Example: gen /abs/path/to/types/markdown.ts /abs/path/to/integration/generated",
    );
    process.exit(1);
  }

  try {
    generatePackage(typesFile, genParentDir, typesRoot);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}
