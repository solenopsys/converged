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

export interface TikTokService {
  publishVideo(
    input: TikTokPostInput,
    credentials: TikTokCredentials,
  ): Promise<TikTokPostResult>;
}
