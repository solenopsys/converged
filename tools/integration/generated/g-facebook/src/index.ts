// Auto-generated package
import { createHttpClient } from "nrpc";

export type FacebookMediaType = "photo" | "video";

export type FacebookMediaInput = {
  type: FacebookMediaType;
  url: string;
};

export type FacebookPostInput = {
  message?: string;
  media: FacebookMediaInput[];
};

export type FacebookCredentials = {
  accessToken: string;
  pageId: string;
  apiBaseUrl?: string;
};

export type FacebookPostResult = {
  success: boolean;
  postId?: string;
  error?: string;
};

export const metadata = {
  "interfaceName": "FacebookService",
  "serviceName": "facebook",
  "filePath": "../types/facebook.ts",
  "methods": [
    {
      "name": "publishPost",
      "parameters": [
        {
          "name": "input",
          "type": "FacebookPostInput",
          "optional": false,
          "isArray": false
        },
        {
          "name": "credentials",
          "type": "FacebookCredentials",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "FacebookMediaType",
      "definition": "\"photo\" | \"video\""
    },
    {
      "name": "FacebookMediaInput",
      "definition": "{\n  type: FacebookMediaType;\n  url: string;\n}"
    },
    {
      "name": "FacebookPostInput",
      "definition": "{\n  message?: string;\n  media: FacebookMediaInput[];\n}"
    },
    {
      "name": "FacebookCredentials",
      "definition": "{\n  accessToken: string;\n  pageId: string;\n  apiBaseUrl?: string;\n}"
    },
    {
      "name": "FacebookPostResult",
      "definition": "{\n  success: boolean;\n  postId?: string;\n  error?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface FacebookService {
  publishPost(input: FacebookPostInput, credentials: FacebookCredentials): Promise<any>;
}

// Client interface
export interface FacebookServiceClient {
  publishPost(input: FacebookPostInput, credentials: FacebookCredentials): Promise<any>;
}

// Factory function
export function createFacebookServiceClient(
  config?: { baseUrl?: string },
): FacebookServiceClient {
  return createHttpClient<FacebookServiceClient>(metadata, config);
}

// Ready-to-use client
export const facebookClient = createFacebookServiceClient();
