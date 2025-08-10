// Auto-generated frontend client
import { createHttpClient } from 'nrpc';

export type MailingStatistic = {
    warmedMailCount: number;
    mailCount:number;
};

const metadata = {
  "interfaceName": "MailingService",
  "serviceName": "mailing",
  "filePath": "/home/alexstorm/distrib/4ir/CONVERGED/private/types/mailing.ts",
  "methods": [
    {
      "name": "getStatistic",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    },
    {
      "name": "getDailyStatistic",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false
    }
  ],
  "types": [
    {
      "name": "MailingStatistic",
      "definition": "{\n    warmedMailCount: number;\n    mailCount:number;\n}"
    }
  ]
};

// Service client interface
export interface MailingServiceClient {
  getStatistic(): Promise<any>;
  getDailyStatistic(): Promise<any>;
}

// Factory function
export function createMailingServiceClient(config?: { baseUrl?: string }): MailingServiceClient {
  return createHttpClient<MailingServiceClient>(metadata, config);
}

// Export ready-to-use client
export const mailingClient = createMailingServiceClient();
