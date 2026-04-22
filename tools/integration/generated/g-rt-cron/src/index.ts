// Auto-generated package
import { createHttpClient } from "nrpc";



export const metadata = {
  "interfaceName": "RuntimeCronService",
  "serviceName": "cron",
  "packageName": "g-rt-cron",
  "filePath": "runtime/automation/cron.ts",
  "methods": [
    {
      "name": "refreshCrons",
      "parameters": [],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": []
};

// Server interface (to be implemented in microservice)
export interface RuntimeCronService {
  refreshCrons(): Promise<void>;
}

// Client interface
export interface RuntimeCronServiceClient {
  refreshCrons(): Promise<void>;
}

// Factory function
export function createRuntimeCronServiceClient(
  config?: { baseUrl?: string },
): RuntimeCronServiceClient {
  return createHttpClient<RuntimeCronServiceClient>(metadata, config);
}

// Ready-to-use client
export const cronClient = createRuntimeCronServiceClient();
