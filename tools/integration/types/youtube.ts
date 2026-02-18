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

export interface YouTubeService {
  uploadShort(
    input: YouTubeShortsInput,
    credentials: YouTubeCredentials,
  ): Promise<YouTubeUploadResult>;
}
