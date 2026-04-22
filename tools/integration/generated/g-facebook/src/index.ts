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
  "filePath": "services/social/facebook.ts",
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
      "returnType": "FacebookPostResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "FacebookMediaType",
      "kind": "type",
      "definition": "\"photo\" | \"video\""
    },
    {
      "name": "FacebookMediaInput",
      "kind": "type",
      "definition": "{\n  type: FacebookMediaType;\n  url: string;\n}"
    },
    {
      "name": "FacebookPostInput",
      "kind": "type",
      "definition": "{\n  message?: string;\n  media: FacebookMediaInput[];\n}"
    },
    {
      "name": "FacebookCredentials",
      "kind": "type",
      "definition": "{\n  accessToken: string;\n  pageId: string;\n  apiBaseUrl?: string;\n}"
    },
    {
      "name": "FacebookPostResult",
      "kind": "type",
      "definition": "{\n  success: boolean;\n  postId?: string;\n  error?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface FacebookService {
  publishPost(input: FacebookPostInput, credentials: FacebookCredentials): Promise<FacebookPostResult>;
}

// Client interface
export interface FacebookServiceClient {
  publishPost(input: FacebookPostInput, credentials: FacebookCredentials): Promise<FacebookPostResult>;
}

// Factory function
export function createFacebookServiceClient(
  config?: { baseUrl?: string },
): FacebookServiceClient {
  return createHttpClient<FacebookServiceClient>(metadata, config);
}

// Ready-to-use client
export const facebookClient = createFacebookServiceClient();
