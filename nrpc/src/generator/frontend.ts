#!/usr/bin/env node
// generate-frontend.ts
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { ServiceMetadata, TypeMetadata } from '../types';

class FrontendGenerator {
  generateFrontend(metadata: ServiceMetadata, outputFile: string) {
    const typeDefinitions = this.generateTypeDefinitions(metadata.types);
    const serviceClient = this.generateServiceClient(metadata);
    
    const code = `// Auto-generated frontend client
import { createHttpClient } from 'nrpc';

${typeDefinitions}

const metadata = ${JSON.stringify(metadata, null, 2)};

${serviceClient}

// Export ready-to-use client
export const ${metadata.serviceName}Client = create${metadata.interfaceName}Client();
`;

    writeFileSync(outputFile, code);
  }
  
  private generateTypeDefinitions(types: TypeMetadata[]): string {
    return types.map(type => {
      if (type.properties && type.properties.length > 0) {
        const props = type.properties.map(prop => {
          const optional = prop.optional ? '?' : '';
          const arrayType = prop.isArray ? '[]' : '';
          return `  ${prop.name}${optional}: ${prop.type}${arrayType};`;
        }).join('\n');
        
        return `export interface ${type.name} {\n${props}\n}`;
      } else {
        return `export type ${type.name} = ${type.definition || 'any'};`;
      }
    }).join('\n\n');
  }
  
  private generateServiceClient(metadata: ServiceMetadata): string {
    const methods = metadata.methods.map(method => {
      const params = method.parameters.map(p => {
        const optional = p.optional ? '?' : '';
        const arrayType = p.isArray ? '[]' : '';
        return `${p.name}${optional}: ${p.type}${arrayType}`;
      }).join(', ');
      
      const returnTypeArray = method.returnTypeIsArray ? '[]' : '';
      
      // Определяем тип возвращаемого значения
      let returnType: string;
      if (method.returnType === 'void') {
        returnType = 'void';
      } else if (method.isAsyncIterable) {
        // Для AsyncIterable методов возвращаем AsyncIterable<T>
        returnType = `AsyncIterable<${method.returnType}${returnTypeArray}>`;
      } else {
        // Для обычных методов возвращаем Promise<T>
        returnType = `${method.returnType}${returnTypeArray}`;
      }
      
      const asyncPrefix = method.isAsyncIterable ? '' : 'Promise<';
      const asyncSuffix = method.isAsyncIterable ? '' : '>';
      
      return `  ${method.name}(${params}): ${asyncPrefix}${returnType}${asyncSuffix};`;
    }).join('\n');

    return `// Service client interface
export interface ${metadata.interfaceName}Client {
${methods}
}

// Factory function
export function create${metadata.interfaceName}Client(config?: { baseUrl?: string }): ${metadata.interfaceName}Client {
  return createHttpClient<${metadata.interfaceName}Client>(metadata, config);
}`;
  }
}

// CLI interface
function main() {
  const [,, metadataFile, outputFile] = process.argv;
  
  if (!metadataFile || !outputFile) {
    console.error('Usage: generate-frontend <metadata-file> <output-file>');
    process.exit(1);
  }
  
  try {
    const metadata = JSON.parse(readFileSync(resolve(metadataFile), 'utf-8'));
    
    const generator = new FrontendGenerator();
    generator.generateFrontend(metadata, outputFile);
    
    console.log(`✅ Frontend client generated: ${outputFile}`);
  } catch (error) {
    console.error('❌ Error generating frontend:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { FrontendGenerator };