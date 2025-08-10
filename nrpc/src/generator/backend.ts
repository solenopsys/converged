#!/usr/bin/env node
// generate-backend.ts
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { ServiceMetadata, BackendConfig } from '../types';

class BackendGenerator {
  generateBackend(config: BackendConfig, outputFile: string) {
    const { transport, serviceUrl, servicePath, metadata } = config;
    
    switch (transport) {
      case 'http':
        this.generateHttpBackend(metadata, serviceUrl, servicePath, outputFile);
        break;
      case 'grpc':
        throw new Error('gRPC transport not implemented yet');
      case 'ws':
        throw new Error('WebSocket transport not implemented yet');
      default:
        throw new Error(`Unknown transport: ${transport}`);
    }
  }
  
  private generateHttpBackend(
    metadata: ServiceMetadata,
    serviceUrl: string | undefined,
    servicePath: string | undefined,
    outputFile: string
  ) {
    const code = `// Auto-generated backend configuration
import { createHttpBackend } from 'nrpc';
${servicePath ? `import serviceImpl from '.${servicePath}';` : ''}

const metadata = ${JSON.stringify(metadata, null, 2)};

const config = {
  metadata,
  ${serviceUrl ? `serviceUrl: '${serviceUrl}',` : ''}
  ${servicePath ? `serviceImpl,` : ''}
};

export default createHttpBackend(config);
`;

    writeFileSync(outputFile, code);
  }
}

// CLI interface
function main() {
  const [,, metadataFile, transport, serviceRef, outputFile] = process.argv;
  
  if (!metadataFile || !transport || !outputFile) {
    console.error('Usage: generate-backend <metadata-file> <transport> [service-ref] <output-file>');
    console.error('  transport: http|grpc|ws');
    console.error('  service-ref: URL or file path to service implementation');
    process.exit(1);
  }
  
  try {
    const metadata = JSON.parse(readFileSync(resolve(metadataFile), 'utf-8'));
    
    const config: BackendConfig = {
      transport: transport as 'http' | 'grpc' | 'ws',
      metadata
    };
    
    // Определяем тип ссылки на сервис
    if (serviceRef) {
      if (serviceRef.startsWith('http://') || serviceRef.startsWith('https://')) {
        config.serviceUrl = serviceRef;
      } else {
        config.servicePath = serviceRef;
      }
    }
    
    const generator = new BackendGenerator();
    generator.generateBackend(config, outputFile);
    
    console.log(`✅ Backend configuration generated: ${outputFile}`);
  } catch (error) {
    console.error('❌ Error generating backend:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { BackendGenerator };