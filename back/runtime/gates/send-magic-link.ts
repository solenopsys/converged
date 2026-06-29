import { createAuthServiceClient } from "g-auth";
import { required } from "back-core";
import { sendNotification } from "./send-notification";
import { requireServicesBaseUrl } from "../env";

const host = requireServicesBaseUrl();

const auth = createAuthServiceClient({ baseUrl: host });

// The link must point back to the exact site the user is on. The browser sends
// returnTo as an absolute URL, so its origin is the source of truth; the static
// env is only a fallback for non-browser callers.
function resolveMagicHost(returnTo?: string): string {
  if (returnTo && /^https?:\/\//i.test(returnTo)) {
    try {
      return new URL(returnTo).origin;
    } catch {
      // fall through to the configured host
    }
  }
  return process.env.MAGIC_HOST ?? required("FRONTEND_URL");
}

const SUPPORTED_LOCALES = new Set(["en", "ru", "de", "es", "fr", "it", "pt"]);

function normalizeLocale(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace("_", "-");
  if (!normalized) return undefined;
  const short = normalized.split("-")[0];
  if (!short || !SUPPORTED_LOCALES.has(short)) return undefined;
  return short;
}

function detectLocaleFromReturnTo(returnTo?: string): string | undefined {
  if (!returnTo) return undefined;
  try {
    const path = returnTo.startsWith("http://") || returnTo.startsWith("https://")
      ? new URL(returnTo).pathname
      : new URL(returnTo, "http://localhost").pathname;
    const firstSegment = path.split("/").filter(Boolean)[0];
    return normalizeLocale(firstSegment);
  } catch {
    return undefined;
  }
}

function joinHostAndPath(base: string, path: string): string {
  const hostPart = base.replace(/\/+$/, "");
  const pathPart = path.startsWith("/") ? path : `/${path}`;
  return `${hostPart}${pathPart}`;
}

export async function sendMagicLink({
  email,
  returnTo,
  locale,
  channel = process.env.MAGIC_LINK_CHANNEL ?? "smtp",
  templateId = "magic-link",
}: {
  email: string;
  returnTo?: string;
  locale?: string;
  channel?: string;
  templateId?: string;
}): Promise<void> {
  const { token } = await auth.getMagicLink(email, returnTo);
  const requestedLocale = normalizeLocale(locale);
  const resolvedLocale =
    requestedLocale ??
    detectLocaleFromReturnTo(returnTo) ??
    normalizeLocale(process.env.DEFAULT_LOCALE);
  const link = joinHostAndPath(
    resolveMagicHost(returnTo),
    `/services/auth/verify/${encodeURIComponent(token)}`,
  );
  await sendNotification({
    channel,
    templateId,
    recipient: email,
    locale: resolvedLocale,
    params: { link, email, token, locale: resolvedLocale ?? "" },
  });
}
