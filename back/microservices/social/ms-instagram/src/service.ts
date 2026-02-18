import type {
  InstagramService,
  InstagramPostInput,
  InstagramCredentials,
  InstagramPostResult,
  InstagramMediaInput,
} from "./types";

const DEFAULT_GRAPH_BASE = "https://graph.facebook.com/v20.0";

export class InstagramServiceImpl implements InstagramService {
  async publishPost(
    input: InstagramPostInput,
    credentials: InstagramCredentials,
  ): Promise<InstagramPostResult> {
    if (!input.media.length) {
      return { success: false, error: "No media provided" };
    }

    const baseUrl = credentials.apiBaseUrl ?? DEFAULT_GRAPH_BASE;

    try {
      let creationId: string;

      if (input.media.length === 1) {
        creationId = await this.createContainer(
          baseUrl,
          credentials,
          input.media[0],
          input.caption,
          false,
        );
      } else {
        const children: string[] = [];
        for (const media of input.media) {
          const childId = await this.createContainer(
            baseUrl,
            credentials,
            media,
            undefined,
            true,
          );
          children.push(childId);
        }

        creationId = await this.createCarouselContainer(
          baseUrl,
          credentials,
          children,
          input.caption,
        );
      }

      const publishUrl = `${baseUrl}/${credentials.igUserId}/media_publish`;
      const publishParams = new URLSearchParams({
        creation_id: creationId,
        access_token: credentials.accessToken,
      });

      const publishResponse = await fetch(publishUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: publishParams.toString(),
      });

      const publishData = await this.safeJson(publishResponse);
      if (!publishResponse.ok) {
        return {
          success: false,
          error: this.extractError(publishData) ?? `HTTP ${publishResponse.status}`,
        };
      }

      return {
        success: true,
        postId: publishData?.id,
        containerId: creationId,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async createCarouselContainer(
    baseUrl: string,
    credentials: InstagramCredentials,
    children: string[],
    caption?: string,
  ): Promise<string> {
    const url = `${baseUrl}/${credentials.igUserId}/media`;
    const params = new URLSearchParams({
      access_token: credentials.accessToken,
      media_type: "CAROUSEL",
      children: children.join(","),
    });

    if (caption) {
      params.set("caption", caption);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await this.safeJson(response);
    if (!response.ok || !data?.id) {
      throw new Error(
        this.extractError(data) ?? `HTTP ${response.status} creating carousel`,
      );
    }

    return data.id as string;
  }

  private async createContainer(
    baseUrl: string,
    credentials: InstagramCredentials,
    media: InstagramMediaInput,
    caption: string | undefined,
    isCarouselItem: boolean,
  ): Promise<string> {
    const url = `${baseUrl}/${credentials.igUserId}/media`;
    const params = new URLSearchParams({
      access_token: credentials.accessToken,
    });

    if (media.type === "image") {
      params.set("image_url", media.url);
    } else {
      params.set("video_url", media.url);
      params.set("media_type", "VIDEO");
    }

    if (caption) {
      params.set("caption", caption);
    }

    if (isCarouselItem) {
      params.set("is_carousel_item", "true");
    }

    if (media.coverUrl) {
      params.set("cover_url", media.coverUrl);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await this.safeJson(response);
    if (!response.ok || !data?.id) {
      throw new Error(
        this.extractError(data) ?? `HTTP ${response.status} creating media`,
      );
    }

    return data.id as string;
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

export default InstagramServiceImpl;
