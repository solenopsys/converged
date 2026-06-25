// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";



const metadata: ServiceMetadata = {
  "interfaceName": "RuntimeCronService",
  "serviceName": "cron",
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface RuntimeCronServiceRtClient {
  refreshCrons(): void;
}

export function createRuntimeCronServiceRtClient(): RuntimeCronServiceRtClient {
  return createRtClient<RuntimeCronServiceRtClient>(metadata);
}
