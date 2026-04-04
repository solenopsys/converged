import { createHttpBackend } from "nrpc";
import { metadata } from "g-webhooks";
import serviceImpl from "./index";
import { StoresController } from "./stores";
import { getProviderDefinition } from "./providers";

const MS_ID = "webhooks-ms";
const backend = createHttpBackend({ metadata, serviceImpl });

export default (config: Record<string, any> = {}) => {
  const backendPlugin = backend(config);
  let stores: StoresController | null = null;

  const ensureStores = async () => {
    if (!stores) {
      stores = new StoresController(MS_ID);
      await stores.init();
    }
    return stores;
  };

  return (app: any) => {
    const withBackend = backendPlugin(app);

    withBackend.all("/webhooks/incoming/:id", async ({ params, request, body, set }) => {
      const storesInstance = await ensureStores();
      const endpointId = params.id as string;
      const endpoint = await storesInstance.webhooks.getEndpoint(endpointId);

      const url = new URL(request.url);
      const headers = Object.fromEntries(request.headers.entries());
      const ipHeader = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
      const ip = ipHeader ? ipHeader.split(",")[0].trim() : undefined;
      const rawBody =
        body === undefined || body === null
          ? undefined
          : typeof body === "string"
            ? body
            : JSON.stringify(body);

      let status = 200;
      let error: string | undefined;
      let provider = endpoint?.provider ?? "unknown";

      if (!endpoint) {
        status = 404;
        error = "endpoint_not_found";
      } else if (!endpoint.enabled) {
        status = 403;
        error = "endpoint_disabled";
      } else if (!getProviderDefinition(endpoint.provider)) {
        status = 400;
        error = "provider_not_registered";
        provider = endpoint.provider;
      }

      if (status !== 200) {
        set.status = status;
      }

      await storesInstance.webhooks.createLog({
        endpointId,
        provider,
        method: request.method,
        path: `${url.pathname}${url.search}`,
        headers,
        body: rawBody,
        ip,
        status,
        error,
      });

      return {
        ok: status === 200,
      };
    });

    return withBackend;
  };
};
