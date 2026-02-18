export type OAuthProviderName =
  | "apple"
  | "google"
  | "meta"
  | "microsoft"
  | "github";

type ProviderRecord = {
  provider: OAuthProviderName;
  displayName?: string;
};

export const oauthClient = {
  async listProviderTemplates(): Promise<ProviderRecord[]> {
    return [
      { provider: "google", displayName: "Google" },
      { provider: "apple", displayName: "Apple" },
      { provider: "microsoft", displayName: "Microsoft" },
      { provider: "meta", displayName: "Meta" },
      { provider: "github", displayName: "GitHub" },
    ];
  },
  async listEnabledProviders(): Promise<ProviderRecord[]> {
    return [
      { provider: "google" },
      { provider: "github" },
      { provider: "microsoft" },
      { provider: "apple" },
      { provider: "meta" },
    ];
  },
};
