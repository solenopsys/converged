import { createAuthServiceClient } from "g-auth";
import { createRuntimeGatesServiceClient } from "g-rt-gates";
import { LocaleController } from "front-core";

export const authClient = createAuthServiceClient({ baseUrl: "/services" });
export const gatesClient = createRuntimeGatesServiceClient({ baseUrl: "/runtime" });

export async function sendMagicLink(email: string, returnTo?: string): Promise<void> {
  const fallbackReturnTo =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
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
