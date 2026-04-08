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
  "filePath": "../types/tiktok.ts",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "TikTokVideoInput",
      "definition": "{\n  data?: Uint8Array;\n  url?: string;\n  mimeType?: string;\n}"
    },
    {
      "name": "TikTokPostInput",
      "definition": "{\n  caption?: string;\n  video: TikTokVideoInput;\n}"
    },
    {
      "name": "TikTokCredentials",
      "definition": "{\n  accessToken: string;\n  openId?: string;\n  apiBaseUrl?: string;\n}"
    },
    {
      "name": "TikTokPostResult",
      "definition": "{\n  success: boolean;\n  postId?: string;\n  error?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface TikTokService {
  publishVideo(input: TikTokPostInput, credentials: TikTokCredentials): Promise<any>;
}

// Client interface
export interface TikTokServiceClient {
  publishVideo(input: TikTokPostInput, credentials: TikTokCredentials): Promise<any>;
}

// Factory function
export function createTikTokServiceClient(
  config?: { baseUrl?: string },
): TikTokServiceClient {
  return createHttpClient<TikTokServiceClient>(metadata, config);
}

// Ready-to-use client
export const tiktokClient = createTikTokServiceClient();
