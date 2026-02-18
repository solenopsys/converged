import type {
  FacebookService,
  FacebookPostInput,
  FacebookCredentials,
  FacebookPostResult,
  FacebookMediaInput,
} from "./types";

const DEFAULT_GRAPH_BASE = "https://graph.facebook.com/v20.0";

export class FacebookServiceImpl implements FacebookService {
  async publishPost(
    input: FacebookPostInput,
    credentials: FacebookCredentials,
  ): Promise<FacebookPostResult> {
    if (!input.media.length) {
      return { success: false, error: "No media provided" };
    }

    if (input.media.length > 1) {
      return {
        success: false,
        error: "Multiple media items are not supported in current flow",
      };
    }

    const media = input.media[0];
    const baseUrl = credentials.apiBaseUrl ?? DEFAULT_GRAPH_BASE;

    try {
      if (media.type === "photo") {
        return await this.publishPhoto(baseUrl, credentials, media, input.message);
      }
      return await this.publishVideo(baseUrl, credentials, media, input.message);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async publishPhoto(
    baseUrl: string,
    credentials: FacebookCredentials,
    media: FacebookMediaInput,
    message?: string,
  ): Promise<FacebookPostResult> {
    const url = `${baseUrl}/${credentials.pageId}/photos`;
    const params = new URLSearchParams({
      url: media.url,
      access_token: credentials.accessToken,
      published: "true",
    });

    if (message) {
      params.set("caption", message);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await this.safeJson(response);
    if (!response.ok) {
      return {
        success: false,
        error: this.extractError(data) ?? `HTTP ${response.status}`,
      };
    }

    return { success: true, postId: data?.post_id ?? data?.id };
  }

  private async publishVideo(
    baseUrl: string,
    credentials: FacebookCredentials,
    media: FacebookMediaInput,
    message?: string,
  ): Promise<FacebookPostResult> {
    const url = `${baseUrl}/${credentials.pageId}/videos`;
    const params = new URLSearchParams({
      file_url: media.url,
      access_token: credentials.accessToken,
    });

    if (message) {
      params.set("description", message);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await this.safeJson(response);
    if (!response.ok) {
      return {
        success: false,
        error: this.extractError(data) ?? `HTTP ${response.status}`,
      };
    }

    return { success: true, postId: data?.id };
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

export default FacebookServiceImpl;
