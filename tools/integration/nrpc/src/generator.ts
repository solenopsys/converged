#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "fs";
import { resolve, join, relative } from "path";
import { InterfaceParser } from "./generator/parser";
import type { MethodMetadata, TypeMetadata } from "./types";

// Аргументы: <types-file> <gen-parent-dir>
const typesFile = process.argv[2];
const genParentDir = process.argv[3];

if (!typesFile || !genParentDir) {
  console.error("Usage: gen <types-file> <gen-parent-dir>");
  console.error(
    "Example: gen /abs/path/to/types/markdown.ts /abs/path/to/integration/generated",
  );
  process.exit(1);
}

function generateTypeDefinitions(types: TypeMetadata[]): string {
  return types
    .map((type) => {
      if (type.properties && type.properties.length > 0) {
        const props = type.properties
          .map((prop) => {
            const optional = prop.optional ? "?" : "";
            const arrayType = prop.isArray ? "[]" : "";
            return `  ${prop.name}${optional}: ${prop.type}${arrayType};`;
          })
          .join("\n");

        return `export interface ${type.name} {\n${props}\n}`;
      }
      return `export type ${type.name} = ${type.definition || "any"};`;
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

try {
  const cwd = process.cwd();
  const typesPath = resolve(cwd, typesFile);

  console.log(`🔧 Generating from ${typesPath}...`);

  const parser = new InterfaceParser();
  const metadata = parser.parseInterface(typesPath);
  const metadataWithRelativePath = {
    ...metadata,
    filePath: relative(cwd, typesPath).replaceAll("\\", "/"),
  };

  const packageName = `g-${metadata.serviceName}`;
  const packageDir = resolve(cwd, genParentDir, packageName);
  const srcDir = join(packageDir, "src");

  mkdirSync(srcDir, { recursive: true });

  const typeDefinitions = generateTypeDefinitions(metadata.types);

  const serverMethods = metadata.methods
    .map((method) => {
      const params = renderParams(method);
      const returnType = renderServerReturnType(method);
      return `  ${method.name}(${params}): ${returnType};`;
    })
    .join("\n");

  const clientMethods = metadata.methods
    .map((method) => {
      const params = renderParams(method);
      const returnType = renderClientReturnType(method);
      return `  ${method.name}(${params}): ${returnType};`;
    })
    .join("\n");

  const indexCode = `// Auto-generated package
import { createHttpClient } from "nrpc";

${typeDefinitions}

export const metadata = ${JSON.stringify(metadataWithRelativePath, null, 2)};

// Server interface (to be implemented in microservice)
export interface ${metadata.interfaceName} {
${serverMethods}
}

// Client interface
export interface ${metadata.interfaceName}Client {
${clientMethods}
}

// Factory function
export function create${metadata.interfaceName}Client(
  config?: { baseUrl?: string },
): ${metadata.interfaceName}Client {
  return createHttpClient<${metadata.interfaceName}Client>(metadata, config);
}

// Ready-to-use client
export const ${metadata.serviceName}Client = create${metadata.interfaceName}Client();
`;

  const packageJson = {
    name: packageName,
    version: "0.0.0",
    type: "module",
    private: true,
    module: "src/index.ts",
    files: ["src", "package.json"],
    dependencies: {
      nrpc: "*",
    },
  };

  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify(packageJson, null, 2),
  );
  writeFileSync(join(srcDir, "index.ts"), indexCode);

  console.log(`✅ Generated package: ${packageDir}`);
} catch (error) {
  console.error("❌ Error:", error);
  process.exit(1);
}
