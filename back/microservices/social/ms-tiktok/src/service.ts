import type {
  TikTokService,
  TikTokPostInput,
  TikTokCredentials,
  TikTokPostResult,
} from "./types";

export class TikTokServiceImpl implements TikTokService {
  async publishVideo(
    input: TikTokPostInput,
    credentials: TikTokCredentials,
  ): Promise<TikTokPostResult> {
    if (!credentials.apiBaseUrl) {
      return {
        success: false,
        error: "TikTok apiBaseUrl is required for publish flow",
      };
    }

    if (!input.video?.url && !input.video?.data) {
      return { success: false, error: "Video data or URL is required" };
    }

    try {
      const result = await this.publishWithCustomEndpoint(
        input,
        credentials,
      );
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async publishWithCustomEndpoint(
    input: TikTokPostInput,
    credentials: TikTokCredentials,
  ): Promise<TikTokPostResult> {
    const url = credentials.apiBaseUrl ?? "";
    const payload: Record<string, unknown> = {
      caption: input.caption,
      openId: credentials.openId,
      videoUrl: input.video.url,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await this.safeJson(response);
    if (!response.ok) {
      return {
        success: false,
        error: data?.message ?? `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      postId: data?.data?.id ?? data?.data?.publish_id ?? data?.id,
    };
  }

  private async safeJson(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
}

export default TikTokServiceImpl;
