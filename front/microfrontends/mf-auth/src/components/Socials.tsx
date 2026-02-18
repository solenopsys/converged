import { useEffect, useMemo, useState } from "react";
import { Button } from "front-core";
import { useMicrofrontendTranslation } from "front-core";
import { oauthClient, type OAuthProviderName } from "g-oauth";

const AUTH_MF_ID = "auth-mf";

type ProviderTemplate = {
  provider: OAuthProviderName;
  displayName: string;
};

const FALLBACK_TEMPLATES: ProviderTemplate[] = [
  { provider: "google", displayName: "Google" },
  // { provider: "apple", displayName: "Apple" },
  { provider: "microsoft", displayName: "Microsoft" },
  { provider: "facebook", displayName: "Facebook" },
  { provider: "github", displayName: "GitHub" },
];

function normalizeProviderDisplayName(
  provider: OAuthProviderName,
  displayName?: string,
): string {
  if (provider === "meta" || provider === "facebook") return "Facebook";
  return displayName && displayName.trim().length > 0 ? displayName : provider;
}

function SocialIcon({ provider }: { provider: OAuthProviderName }) {
  const base = "size-4 shrink-0";

  if (provider === "microsoft") {
    return (
      <svg className={base} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 3h9v9H2V3zM13 3h9v9h-9V3zM2 14h9v9H2v-9zM13 14h9v9h-9v-9z" fill="currentColor" />
      </svg>
    );
  }
  if (provider === "apple") {
    return (
      <svg className={base} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04-2.04.03-3.91 1.18-4.96 3.01-2.12 3.68-.55 9.1 1.52 12.09 1.01 1.46 2.21 3.09 3.79 3.04 1.52-.07 2.09-.99 3.94-.99 1.83 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.15-1.69 1.63-3.33 1.66-3.41-.04-.01-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56-1.43-2.09-3.62-2.32-4.39-2.38-2-.16-3.68 1.09-4.61 1.09zM15.53 3.83c.84-1.01 1.4-2.43 1.24-3.83-1.2.05-2.66.81-3.53 1.82-.78.9-1.45 2.34-1.27 3.71 1.34.1 2.71-.69 3.56-1.7"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (provider === "github") {
    return (
      <svg className={base} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.57.1.78-.25.78-.55 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.7 1.25 3.35.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18A10.98 10.98 0 0 1 12 6.1c.98 0 1.97.13 2.88.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.54-.01 2.78-.01 3.16 0 .31.2.67.79.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (provider === "facebook" || provider === "meta") {
    return (
      <svg className={base} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.022 4.388 11.014 10.125 11.927v-8.437H7.078v-3.49h3.047V9.413c0-3.03 1.792-4.7 4.533-4.7 1.313 0 2.686.236 2.686.236v2.973H15.83c-1.491 0-1.955.93-1.955 1.885v2.266h3.328l-.532 3.49h-2.796V24C19.612 23.087 24 18.095 24 12.073z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg className={base} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.19-1.79 4.13-1.15 1.15-2.93 2.4-6.05 2.4-4.83 0-8.6-3.89-8.6-8.72s3.77-8.72 8.6-8.72c2.6 0 4.51 1.03 5.91 2.35l2.31-2.31C18.75 1.44 16.13 0 12.48 0 5.87 0 .31 5.39.31 12s5.56 12 12.17 12c3.57 0 6.27-1.17 8.37-3.36 2.16-2.16 2.84-5.21 2.84-7.67 0-.76-.05-1.47-.17-2.05h-11.04z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SocialsPanel() {
  const { t } = useMicrofrontendTranslation(AUTH_MF_ID);
  const [templates, setTemplates] = useState<ProviderTemplate[]>(FALLBACK_TEMPLATES);

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      try {
        const response = await oauthClient.listProviderTemplates();
        if (cancelled) return;

        const next = Array.isArray(response)
          ? response
              .map((item) => {
                const provider = item?.provider as OAuthProviderName | undefined;
                if (!provider) return null;
                return {
                  provider,
                  displayName: normalizeProviderDisplayName(provider, item?.displayName),
                } as ProviderTemplate;
              })
              .filter(Boolean) as ProviderTemplate[]
          : [];

        setTemplates(next.length > 0 ? next : FALLBACK_TEMPLATES);
      } catch {
        if (!cancelled) setTemplates(FALLBACK_TEMPLATES);
      }
    };

    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  const continueWith = t("button.continueWith");
  const continueWithText =
    continueWith && continueWith !== "button.continueWith"
      ? continueWith
      : "Continue with";

  const uniqueProviders = useMemo(() => {
    const seen = new Set<OAuthProviderName>();
    return templates.filter((item) => {
      if (item.provider === "apple") return false;
      if (seen.has(item.provider)) return false;
      seen.add(item.provider);
      return true;
    });
  }, [templates]);

  const handleSocialLogin = (provider: OAuthProviderName) => {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.href = `/services/oauth/connect/${provider}?returnTo=${encodeURIComponent(returnTo)}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative text-center text-xs text-muted-foreground">
        <div className="absolute inset-0 top-1/2 flex -translate-y-1/2 items-center">
          <span className="w-full border-t" />
        </div>
        <span className="relative bg-background px-2">{continueWithText}</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {uniqueProviders.map((item) => (
          <Button
            key={item.provider}
            variant="outline"
            type="button"
            className="w-full justify-start gap-2"
            onClick={() => handleSocialLogin(item.provider)}
          >
            <SocialIcon provider={item.provider} />
            <span>{item.displayName}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
