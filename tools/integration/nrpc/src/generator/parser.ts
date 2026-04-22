#!/usr/bin/env node
// parse-interface.ts
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { parse } from "@typescript-eslint/typescript-estree";
import type {
  ServiceMetadata,
  MethodMetadata,
  TypeMetadata,
  PropertyMetadata,
} from "../types";

class InterfaceParser {
  parseInterface(filePath: string): ServiceMetadata {
    const content = readFileSync(filePath, "utf-8");
    const ast = parse(content, { loc: true, range: true, comment: true });

    const types: TypeMetadata[] = [];
    let serviceInterface: any = null;

    for (const statement of ast.body) {
      // Handle exported declarations
      const declaration =
        statement.type === "ExportNamedDeclaration" && statement.declaration
          ? statement.declaration
          : statement;

      if (!declaration) continue;

      if (declaration.type === "TSInterfaceDeclaration") {
        if (declaration.id.name.endsWith("Service")) {
          // Found the main service interface
          if (serviceInterface) {
            console.warn(
              `Multiple service interfaces found in ${filePath}. Using the first one: ${serviceInterface.id.name}`,
            );
          } else {
            serviceInterface = declaration;
          }
        } else {
          // It's a supporting interface, treat as a type
          types.push({
            name: declaration.id.name,
            definition: "", // Definition can be complex, focusing on properties
            kind: "interface",
            typeParameters: this.extractTypeParameters(declaration, content),
            properties: this.extractProperties(declaration.body.body),
          });
        }
      } else if (declaration.type === "TSTypeAliasDeclaration") {
        // It's a type alias
        types.push({
          name: declaration.id.name,
          kind: "type",
          typeParameters: this.extractTypeParameters(declaration, content),
          // A simple representation of the type definition
          definition: content.substring(
            declaration.typeAnnotation.range[0],
            declaration.typeAnnotation.range[1],
          ),
        });
      } else if (declaration.type === "TSEnumDeclaration") {
        const enumSource = content.substring(declaration.range[0], declaration.range[1]);
        types.push({
          name: declaration.id.name,
          kind: "raw",
          definition: enumSource.startsWith("export ") ? enumSource : `export ${enumSource}`,
        });
      }
    }

    if (!serviceInterface) {
      throw new Error(
        `No interface with a name ending in 'Service' found in ${filePath}`,
      );
    }

    const interfaceName = serviceInterface.id.name;
    const serviceName = this.extractDirective(content, "service") ?? this.extractServiceName(interfaceName);
    const packageName = this.extractDirective(content, "package");
    const methods = this.extractMethods(serviceInterface.body.body, content);

    return {
      interfaceName,
      serviceName,
      ...(packageName ? { packageName } : {}),
      filePath,
      methods,
      types,
    };
  }

  private extractDirective(content: string, name: "service" | "package"): string | undefined {
    const match = content.match(new RegExp(`@nrpc-${name}\\s+([a-zA-Z0-9_-]+)`));
    return match?.[1];
  }

  private extractServiceName(interfaceName: string): string {
    return interfaceName.replace("Service", "").toLowerCase();
  }

  private extractTypeParameters(node: any, sourceContent: string): string | undefined {
    const typeParameters = node.typeParameters;
    if (!typeParameters?.range) return undefined;
    return sourceContent.substring(typeParameters.range[0], typeParameters.range[1]);
  }

  private extractMethods(members: any[], sourceContent = ""): MethodMetadata[] {
    return members
      .filter((member) => member.type === "TSMethodSignature")
      .map((method) => {
        const returnTypeAnnotation = method.returnType?.typeAnnotation;
        return {
          name: method.key.name,
          parameters: this.extractParameters(method.params),
          returnType: this.extractReturnType(returnTypeAnnotation),
          isAsync: this.isAsyncMethod(returnTypeAnnotation),
          returnTypeIsArray: this.isArrayType(returnTypeAnnotation),
          isAsyncIterable: this.isAsyncIterableMethod(returnTypeAnnotation),
        };
      });
  }

  private extractParameters(params: any[]): PropertyMetadata[] {
    if (!params) return [];
    return params.map((param) => {
      const typeAnnotation = param.typeAnnotation?.typeAnnotation;
      return {
        name: param.name,
        type: this.extractType(typeAnnotation),
        optional: param.optional || false,
        isArray: this.isArrayType(typeAnnotation),
      };
    });
  }

  private extractProperties(members: any[]): PropertyMetadata[] {
    return members
      .filter((member) => member.type === "TSPropertySignature")
      .map((prop) => {
        const typeAnnotation = prop.typeAnnotation?.typeAnnotation;
        return {
          name: prop.key.name,
          type: this.extractType(typeAnnotation),
          optional: prop.optional || false,
          isArray: this.isArrayType(typeAnnotation),
        };
      });
  }

  private extractType(typeNode: any): string {
    if (!typeNode) return "any";

    switch (typeNode.type) {
      case "TSStringKeyword":
        return "string";
      case "TSNumberKeyword":
        return "number";
      case "TSBooleanKeyword":
        return "boolean";
      case "TSVoidKeyword":
        return "void";
      case "TSAnyKeyword":
        return "any";
      case "TSUnknownKeyword":
        return "unknown";
      case "TSTypeReference":
        // Распознаем встроенные типы, включая Date
        const typeName = this.extractTypeName(typeNode.typeName);
        const typeArguments = (typeNode.typeArguments ?? typeNode.typeParameters)?.params;
        if (!typeArguments?.length) return typeName;
        return `${typeName}<${typeArguments.map((arg: any) => this.extractType(arg)).join(", ")}>`;
      case "TSArrayType":
        return this.extractType(typeNode.elementType);
      case "TSUnionType":
        return typeNode.types.map((item: any) => this.extractType(item)).join(" | ");
      case "TSLiteralType":
        return this.extractLiteralType(typeNode.literal);
      default:
        return "any";
    }
  }

  private extractTypeName(typeNameNode: any): string {
    if (!typeNameNode) return "any";
    if (typeNameNode.type === "Identifier") return typeNameNode.name;
    if (typeNameNode.type === "TSQualifiedName") {
      return `${this.extractTypeName(typeNameNode.left)}.${this.extractTypeName(typeNameNode.right)}`;
    }
    return "any";
  }

  private extractLiteralType(literalNode: any): string {
    if (!literalNode) return "any";
    if (literalNode.type === "Literal") return JSON.stringify(literalNode.value);
    return "any";
  }

  private extractReturnType(typeNode: any): string {
    if (!typeNode) return "void";

    // Handle AsyncIterable<T> - unwrap to get T
    if (this.isAsyncIterableType(typeNode)) {
      const innerType = (typeNode.typeArguments ?? typeNode.typeParameters)?.params[0];
      return this.extractType(innerType);
    }

    // Unwrap Promise<T> to get T
    if (
      typeNode.type === "TSTypeReference" &&
      typeNode.typeName.name === "Promise"
    ) {
      const innerType = (typeNode.typeArguments ?? typeNode.typeParameters)?.params[0];
      return this.extractType(innerType);
    }

    // Handle non-async return types
    return this.extractType(typeNode);
  }

  private isArrayType(typeNode: any): boolean {
    if (!typeNode) return false;

    // Handle AsyncIterable<T[]> - check if T is an array
    if (this.isAsyncIterableType(typeNode)) {
      const innerType = (typeNode.typeArguments ?? typeNode.typeParameters)?.params[0];
      return innerType?.type === "TSArrayType";
    }

    // Unwrap Promise<T> to check if T is an array
    if (
      typeNode.type === "TSTypeReference" &&
      typeNode.typeName.name === "Promise"
    ) {
      const innerType = (typeNode.typeArguments ?? typeNode.typeParameters)?.params[0];
      return innerType?.type === "TSArrayType";
    }

    return typeNode.type === "TSArrayType";
  }

  private isAsyncMethod(typeNode: any): boolean {
    if (!typeNode) return false;
    return (
      typeNode.type === "TSTypeReference" &&
      (typeNode.typeName.name === "Promise" ||
        this.isAsyncIterableType(typeNode))
    );
  }

  // Новый метод для определения AsyncIterable
  private isAsyncIterableMethod(typeNode: any): boolean {
    if (!typeNode) return false;
    return this.isAsyncIterableType(typeNode);
  }

  private isAsyncIterableType(typeNode: any): boolean {
    return (
      typeNode?.type === "TSTypeReference" &&
      typeNode.typeName.name === "AsyncIterable"
    );
  }
}

// CLI interface
function main() {
  const [, , interfaceFile, outputFile] = process.argv;

  if (!interfaceFile || !outputFile) {
    console.error("Usage: parse-interface <interface-file> <output-file>");
    process.exit(1);
  }

  try {
    const parser = new InterfaceParser();
    const metadata = parser.parseInterface(resolve(interfaceFile));

    writeFileSync(outputFile, JSON.stringify(metadata, null, 2));
    console.log(`✅ Interface metadata saved to ${outputFile}`);
  } catch (error) {
    console.error("❌ Error parsing interface:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { InterfaceParser };
