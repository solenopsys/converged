import { createAuthServiceClient } from "g-auth";
import { createRuntimeGatesServiceClient } from "g-rt-gates";
import { LocaleController } from "front-core";

export const authClient = createAuthServiceClient({ baseUrl: "/services" });
export const gatesClient = createRuntimeGatesServiceClient({ baseUrl: "/runtime" });

export async function sendMagicLink(email: string, returnTo?: string): Promise<void> {
  // Absolute URL on purpose: the magic link and the post-verify redirect must
  // stay on the domain the user is actually on. Each site is independent, so the
  // origin travels with returnTo instead of relying on a static backend config.
  const fallbackReturnTo =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
      : undefined;
  const locale = LocaleController.getInstance().getActiveLocale();

  await gatesClient.sendMagicLink({
    email,
    returnTo: returnTo ?? fallbackReturnTo,
    locale,
  });
}

export type TemporaryAuthSession = {
  token: string;
  userId: string;
  email: string;
  temporary: true;
};
