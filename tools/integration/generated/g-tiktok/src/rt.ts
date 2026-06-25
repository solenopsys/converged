// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

const metadata: ServiceMetadata = {
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface TikTokServiceRtClient {
  publishVideo(input: TikTokPostInput, credentials: TikTokCredentials): TikTokPostResult;
}

export function createTikTokServiceRtClient(): TikTokServiceRtClient {
  return createRtClient<TikTokServiceRtClient>(metadata);
}
