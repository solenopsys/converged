// Auto-generated package
import { createHttpClient } from "nrpc";

export type TikTokVideoInput = {
  data?: Uint8Array;
  url?: string;
  mimeType?: string;
};

export type TikTokPostInput = {
  caption?: string;
  video: TikTokVideoInput;
};

export type TikTokCredentials = {
  accessToken: string;
  openId?: string;
  apiBaseUrl?: string;
};

export type TikTokPostResult = {
  success: boolean;
  postId?: string;
  error?: string;
};

export const metadata = {
  "interfaceName": "TikTokService",
  "serviceName": "tiktok",
  "filePath": "services/social/tiktok.ts",
  "methods": [
    {
      "name": "publishVideo",
      "parameters": [
        {
          "name": "input",
          "type": "TikTokPostInput",
          "optional": false,
          "isArray": false
        },
        {
          "name": "credentials",
          "type": "TikTokCredentials",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "TikTokPostResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "TikTokVideoInput",
      "kind": "type",
      "definition": "{\n  data?: Uint8Array;\n  url?: string;\n  mimeType?: string;\n}"
    },
    {
      "name": "TikTokPostInput",
      "kind": "type",
      "definition": "{\n  caption?: string;\n  video: TikTokVideoInput;\n}"
    },
    {
      "name": "TikTokCredentials",
      "kind": "type",
      "definition": "{\n  accessToken: string;\n  openId?: string;\n  apiBaseUrl?: string;\n}"
    },
    {
      "name": "TikTokPostResult",
      "kind": "type",
      "definition": "{\n  success: boolean;\n  postId?: string;\n  error?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface TikTokService {
  publishVideo(input: TikTokPostInput, credentials: TikTokCredentials): Promise<TikTokPostResult>;
}

// Client interface
export interface TikTokServiceClient {
  publishVideo(input: TikTokPostInput, credentials: TikTokCredentials): Promise<TikTokPostResult>;
}

// Factory function
export function createTikTokServiceClient(
  config?: { baseUrl?: string },
): TikTokServiceClient {
  return createHttpClient<TikTokServiceClient>(metadata, config);
}

// Ready-to-use client
export const tiktokClient = createTikTokServiceClient();
