import type { Elysia } from "elysia";
import { createHttpBackend } from "nrpc";
import { metadata } from "g-oauth";
import serviceImpl from "./index";
import type { OAuthProviderName } from "./types";

const providers: OAuthProviderName[] = [
  "google",
  "apple",
  "microsoft",
  "meta",
  "github",
];

type PluginOptions = {
  dbPath?: string;
  registerStartupTask?: (name: string, task: () => Promise<void>) => void;
  [key: string]: any;
};

export default (options: PluginOptions = {}) => (app: Elysia) => {
  let service: InstanceType<typeof serviceImpl> | undefined;

  const ensureService = async (): Promise<InstanceType<typeof serviceImpl>> => {
    if (!service) {
      service = new serviceImpl();
    }

    const initPromise = (service as any).initPromise;
    if (initPromise && typeof initPromise.then === "function") {
      await initPromise;
    }

    return service;
  };

  const serviceProxy = new Proxy(
    { initPromise: Promise.resolve() } as Record<string, any>,
    {
      get(target, prop: string | symbol) {
        if (prop === "initPromise") {
          return target.initPromise;
        }

        if (typeof prop !== "string") {
          return target[prop as keyof typeof target];
        }

        return async (...args: any[]) => {
          const readyService = await ensureService();
          const value = (readyService as any)[prop];

          if (typeof value !== "function") {
            return value;
          }

          return value.apply(readyService, args);
        };
      },
    },
  );

  const nrpcPlugin = createHttpBackend({
    metadata,
    serviceImpl: serviceProxy,
  });

  app.use(nrpcPlugin(options) as any);

  options.registerStartupTask?.("oauth:service", async () => {
    await ensureService();
  });

  app.get("/oauth/connect/:provider", async ({ params, query, request, set }) => {
    const service = await ensureService();
    const provider = params.provider as OAuthProviderName;
    if (!providers.includes(provider)) {
      set.status = 400;
      return { error: "Unsupported provider" };
    }

    const origin = new URL(request.url).origin;
    const providerConfig = await service.getProvider(provider);
    if (!providerConfig || !providerConfig.enabled) {
      set.status = 404;
      return { error: "Provider is not configured or disabled" };
    }

    const returnTo =
      typeof query.returnTo === "string" && query.returnTo.length > 0
        ? query.returnTo
        : "/";

    const state = await service.generateState(provider, returnTo, 600);
    const callbackUrl =
      process.env.OAUTH_REDIRECT_URI ||
      `${origin}/services/oauth/callback/${provider}`;

    const authorizeUrl = new URL(providerConfig.authorizeUrl);
    authorizeUrl.searchParams.set("client_id", providerConfig.clientId);
    authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("state", state);

    if (providerConfig.scopes.length > 0) {
      authorizeUrl.searchParams.set("scope", providerConfig.scopes.join(" "));
    }
    if (provider === "google") {
      authorizeUrl.searchParams.set("access_type", "offline");
      authorizeUrl.searchParams.set("prompt", "consent");
    }

    return Response.redirect(authorizeUrl.toString(), 302);
  });

  app.get("/oauth/callback/:provider", async ({ params, query, request, set }) => {
    const service = await ensureService();
    const provider = params.provider as OAuthProviderName;
    const code = typeof query.code === "string" ? query.code : "";
    const state = typeof query.state === "string" ? query.state : "";

    if (!code || !state) {
      set.status = 400;
      return { error: "Missing OAuth callback params" };
    }

    const oauthState = await service.consumeState(state);
    if (!oauthState || oauthState.provider !== provider) {
      set.status = 400;
      return { error: "Invalid OAuth state" };
    }

    const returnTo = oauthState.returnTo || "/";
    const origin = new URL(request.url).origin;
    const redirectTarget = new URL(
      returnTo.startsWith("http") ? returnTo : `${origin}${returnTo}`,
    );

    redirectTarget.searchParams.set("oauth_provider", provider);
    redirectTarget.searchParams.set("oauth_code", code);
    redirectTarget.searchParams.set("oauth_state", state);

    return Response.redirect(redirectTarget.toString(), 302);
  });

  return app;
};
