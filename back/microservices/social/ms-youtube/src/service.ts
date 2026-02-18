import type {
  YouTubeService,
  YouTubeShortsInput,
  YouTubeCredentials,
  YouTubeUploadResult,
} from "./types";

const UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3/videos";

export class YouTubeServiceImpl implements YouTubeService {
  async uploadShort(
    input: YouTubeShortsInput,
    credentials: YouTubeCredentials,
  ): Promise<YouTubeUploadResult> {
    try {
      const videoData = await this.resolveVideoData(input);
      if (!videoData) {
        return { success: false, error: "Video data is required" };
      }

      const { data, mimeType } = videoData;
      const initResponse = await fetch(
        `${UPLOAD_BASE}?uploadType=resumable&part=snippet,status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": mimeType,
            "X-Upload-Content-Length": data.byteLength.toString(),
          },
          body: JSON.stringify({
            snippet: {
              title: input.title,
              description: input.description ?? "",
              tags: input.tags ?? [],
            },
            status: {
              privacyStatus: input.privacyStatus ?? "public",
            },
          }),
        },
      );

      if (!initResponse.ok) {
        const data = await this.safeJson(initResponse);
        return {
          success: false,
          error: this.extractError(data) ?? `HTTP ${initResponse.status}`,
        };
      }

      const uploadUrl = initResponse.headers.get("location");
      if (!uploadUrl) {
        return { success: false, error: "Missing upload URL" };
      }

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": mimeType,
          "Content-Length": data.byteLength.toString(),
        },
        body: data,
      });

      const uploadData = await this.safeJson(uploadResponse);
      if (!uploadResponse.ok) {
        return {
          success: false,
          error: this.extractError(uploadData) ?? `HTTP ${uploadResponse.status}`,
        };
      }

      return {
        success: true,
        postId: uploadData?.id,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async resolveVideoData(
    input: YouTubeShortsInput,
  ): Promise<{ data: Uint8Array; mimeType: string } | null> {
    if (input.video?.data) {
      return {
        data: input.video.data,
        mimeType: input.video.mimeType ?? "video/mp4",
      };
    }

    if (input.video?.url) {
      const response = await fetch(input.video.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch video URL: ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      const mimeType =
        input.video.mimeType ??
        response.headers.get("content-type") ??
        "video/mp4";
      return { data: new Uint8Array(buffer), mimeType };
    }

    return null;
  }

  private async safeJson(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private extractError(data: any): string | undefined {
    const message = data?.error?.message;
    if (typeof message === "string") {
      return message;
    }
    const detail = data?.errors?.[0]?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    return undefined;
  }
}

export default YouTubeServiceImpl;
