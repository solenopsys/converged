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

export interface InstagramService {
  publishPost(
    input: InstagramPostInput,
    credentials: InstagramCredentials,
  ): Promise<InstagramPostResult>;
}
