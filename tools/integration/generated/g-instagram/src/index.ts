// Auto-generated package
import { createHttpClient } from "nrpc";

export type InstagramMediaType = "image" | "video";

export type InstagramMediaInput = {
  type: InstagramMediaType;
  url: string;
  coverUrl?: string;
};

export type InstagramPostInput = {
  caption?: string;
  media: InstagramMediaInput[];
};

export type InstagramCredentials = {
  accessToken: string;
  igUserId: string;
  apiBaseUrl?: string;
};

export type InstagramPostResult = {
  success: boolean;
  postId?: string;
  containerId?: string;
  error?: string;
};

export const metadata = {
  "interfaceName": "InstagramService",
  "serviceName": "instagram",
  "filePath": "services/social/instagram.ts",
  "methods": [
    {
      "name": "publishPost",
      "parameters": [
        {
          "name": "input",
          "type": "InstagramPostInput",
          "optional": false,
          "isArray": false
        },
        {
          "name": "credentials",
          "type": "InstagramCredentials",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "InstagramPostResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "InstagramMediaType",
      "kind": "type",
      "definition": "\"image\" | \"video\""
    },
    {
      "name": "InstagramMediaInput",
      "kind": "type",
      "definition": "{\n  type: InstagramMediaType;\n  url: string;\n  coverUrl?: string;\n}"
    },
    {
      "name": "InstagramPostInput",
      "kind": "type",
      "definition": "{\n  caption?: string;\n  media: InstagramMediaInput[];\n}"
    },
    {
      "name": "InstagramCredentials",
      "kind": "type",
      "definition": "{\n  accessToken: string;\n  igUserId: string;\n  apiBaseUrl?: string;\n}"
    },
    {
      "name": "InstagramPostResult",
      "kind": "type",
      "definition": "{\n  success: boolean;\n  postId?: string;\n  containerId?: string;\n  error?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface InstagramService {
  publishPost(input: InstagramPostInput, credentials: InstagramCredentials): Promise<InstagramPostResult>;
}

// Client interface
export interface InstagramServiceClient {
  publishPost(input: InstagramPostInput, credentials: InstagramCredentials): Promise<InstagramPostResult>;
}

// Factory function
export function createInstagramServiceClient(
  config?: { baseUrl?: string },
): InstagramServiceClient {
  return createHttpClient<InstagramServiceClient>(metadata, config);
}

// Ready-to-use client
export const instagramClient = createInstagramServiceClient();
