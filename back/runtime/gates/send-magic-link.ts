import { createAuthServiceClient } from "g-auth";
import { sendNotification } from "./send-notification";

const host = process.env.SERVICES_BASE ?? "http://localhost:3000/services";
const magicHost =
  process.env.MAGIC_HOST ??
  process.env.FRONTEND_URL ??
  "http://localhost:3000";

const auth = createAuthServiceClient({ baseUrl: host });

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
    magicHost,
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
