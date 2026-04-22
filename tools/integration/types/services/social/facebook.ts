export type FacebookMediaType = "photo" | "video";

export type FacebookMediaInput = {
  type: FacebookMediaType;
  url: string;
};

export type FacebookPostInput = {
  message?: string;
  media: FacebookMediaInput[];
};

export type FacebookCredentials = {
  accessToken: string;
  pageId: string;
  apiBaseUrl?: string;
};

export type FacebookPostResult = {
  success: boolean;
  postId?: string;
  error?: string;
};

export interface FacebookService {
  publishPost(
    input: FacebookPostInput,
    credentials: FacebookCredentials,
  ): Promise<FacebookPostResult>;
}
