// Auto-generated package
import { createHttpClient } from "nrpc";

export type YouTubeVideoInput = {
  data?: Uint8Array;
  url?: string;
  mimeType?: string;
};

export type YouTubeShortsInput = {
  title: string;
  description?: string;
  tags?: string[];
  privacyStatus?: "public" | "unlisted" | "private";
  video: YouTubeVideoInput;
};

export type YouTubeCredentials = {
  accessToken: string;
};

export type YouTubeUploadResult = {
  success: boolean;
  postId?: string;
  error?: string;
};

export const metadata = {
  "interfaceName": "YouTubeService",
  "serviceName": "youtube",
  "filePath": "../types/youtube.ts",
  "methods": [
    {
      "name": "uploadShort",
      "parameters": [
        {
          "name": "input",
          "type": "YouTubeShortsInput",
          "optional": false,
          "isArray": false
        },
        {
          "name": "credentials",
          "type": "YouTubeCredentials",
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
      "name": "YouTubeVideoInput",
      "definition": "{\n  data?: Uint8Array;\n  url?: string;\n  mimeType?: string;\n}"
    },
    {
      "name": "YouTubeShortsInput",
      "definition": "{\n  title: string;\n  description?: string;\n  tags?: string[];\n  privacyStatus?: \"public\" | \"unlisted\" | \"private\";\n  video: YouTubeVideoInput;\n}"
    },
    {
      "name": "YouTubeCredentials",
      "definition": "{\n  accessToken: string;\n}"
    },
    {
      "name": "YouTubeUploadResult",
      "definition": "{\n  success: boolean;\n  postId?: string;\n  error?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface YouTubeService {
  uploadShort(input: YouTubeShortsInput, credentials: YouTubeCredentials): Promise<any>;
}

// Client interface
export interface YouTubeServiceClient {
  uploadShort(input: YouTubeShortsInput, credentials: YouTubeCredentials): Promise<any>;
}

// Factory function
export function createYouTubeServiceClient(
  config?: { baseUrl?: string },
): YouTubeServiceClient {
  return createHttpClient<YouTubeServiceClient>(metadata, config);
}

// Ready-to-use client
export const youtubeClient = createYouTubeServiceClient();
