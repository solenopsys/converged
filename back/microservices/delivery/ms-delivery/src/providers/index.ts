import type { ShipmentProviderServiceClient } from "g-shipmentprovider";
import { createShipmentProviderServiceClient } from "g-shipmentprovider";

export type ProviderId = "dhl" | "fedex" | "ups" | "ems" | "sfexpress";

const PROVIDER_ENV: Record<ProviderId, string[]> = {
  dhl: ["DELIVERY_PROVIDER_DHL_URL", "DHL_PROVIDER_URL"],
  fedex: ["DELIVERY_PROVIDER_FEDEX_URL", "FEDEX_PROVIDER_URL"],
  ups: ["DELIVERY_PROVIDER_UPS_URL", "UPS_PROVIDER_URL"],
  ems: ["DELIVERY_PROVIDER_EMS_URL", "EMS_PROVIDER_URL"],
  sfexpress: ["DELIVERY_PROVIDER_SFEXPRESS_URL", "SF_EXPRESS_PROVIDER_URL"],
};

export const providerIds: ProviderId[] = [
  "dhl",
  "fedex",
  "ups",
  "ems",
  "sfexpress",
];

const providerClients: Partial<Record<ProviderId, ShipmentProviderServiceClient>> = {};

function resolveProviderUrl(providerId: ProviderId): string | undefined {
  const keys = PROVIDER_ENV[providerId] || [];
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

export function getProviderClient(
  providerId: ProviderId,
): ShipmentProviderServiceClient {
  const existing = providerClients[providerId];
  if (existing) return existing;

  const baseUrl = resolveProviderUrl(providerId);
  if (!baseUrl) {
    throw new Error(
      `Provider not configured: ${providerId}. Set ${PROVIDER_ENV[
        providerId
      ].join(" or ")}`,
    );
  }

  const client = createShipmentProviderServiceClient({ baseUrl });
  providerClients[providerId] = client;
  return client;
}

export function registerProviderClient(
  providerId: ProviderId,
  client: ShipmentProviderServiceClient,
): void {
  providerClients[providerId] = client;
}
