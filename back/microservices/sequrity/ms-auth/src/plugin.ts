import { Elysia } from "elysia";
import { createHttpBackend } from "nrpc";
import { metadata } from "g-auth";
import { required } from "back-core";
import { AuthServiceImpl } from "./service";

// Last-resort base only: sites are independent, so the redirect normally rides
// the domain the verify request arrived on (see resolveBaseUrl).
const fallbackFrontendUrl = process.env.MAGIC_HOST ?? required("FRONTEND_URL");

function firstHeaderValue(value: string | undefined): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

// The verify link lives on the user's own site, so the request Host is the
// correct origin for every redirect — including the error path, where we have no
// returnTo to fall back on.
function resolveBaseUrl(headers: Record<string, string | undefined>): string {
  const host =
    firstHeaderValue(headers["x-forwarded-host"]) ??
    firstHeaderValue(headers.host);
  if (!host) return fallbackFrontendUrl;
  const proto = firstHeaderValue(headers["x-forwarded-proto"]) ?? "https";
  return `${proto}://${host}`;
}

export default (options: any) => (app: Elysia) => {
  const impl = new AuthServiceImpl();

  const nrpc = createHttpBackend({ metadata, serviceImpl: impl })(options)(app);

  const handleVerify = async (
    token: string | undefined,
    set: Record<string, any>,
    headers: Record<string, string | undefined>,
  ) => {
    if (!token) {
      set.status = 400;
      return { error: "Missing token" };
    }
    const baseUrl = resolveBaseUrl(headers);
    try {
      const result = await impl.verifyLink(token);
      const redirectUrl = new URL(result.returnTo || "/", baseUrl);
      redirectUrl.searchParams.set("auth_token", result.token);
      set.status = 302;
      set.headers["location"] = redirectUrl.toString();
    } catch (e: any) {
      const redirectUrl = new URL("/", baseUrl);
      redirectUrl.searchParams.set("auth_error", e.message ?? "invalid_token");
      set.status = 302;
      set.headers["location"] = redirectUrl.toString();
    }
  };

  nrpc.get("/auth/verify", async ({ query, set, headers }: any) =>
    handleVerify(query?.token as string | undefined, set, headers ?? {}),
  );

  nrpc.get("/auth/verify/:token", async ({ params, set, headers }: any) =>
    handleVerify(params?.token as string | undefined, set, headers ?? {}),
  );

  return nrpc;
};
