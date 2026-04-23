import { createDeliveryServiceClient } from "g-delivery";
import { createShipmentProviderServiceClient } from "g-shipmentprovider";
import type { TrackingResult } from "g-shipmentprovider";
import { requireServicesBaseUrl } from "../env";

const host = requireServicesBaseUrl();

const delivery = createDeliveryServiceClient({ baseUrl: host });

const PROVIDER_URLS: Record<string, string[]> = {
  dhl: ["DELIVERY_PROVIDER_DHL_URL", "DHL_PROVIDER_URL"],
  fedex: ["DELIVERY_PROVIDER_FEDEX_URL", "FEDEX_PROVIDER_URL"],
  ups: ["DELIVERY_PROVIDER_UPS_URL", "UPS_PROVIDER_URL"],
  ems: ["DELIVERY_PROVIDER_EMS_URL", "EMS_PROVIDER_URL"],
  sfexpress: ["DELIVERY_PROVIDER_SFEXPRESS_URL", "SF_EXPRESS_PROVIDER_URL"],
};

function resolveProviderUrl(providerId: string): string {
  const keys = PROVIDER_URLS[providerId] ?? [];
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  throw new Error(`Provider "${providerId}" not configured. Set one of: ${keys.join(", ")}`);
}

export async function trackDelivery(deliveryId: string): Promise<TrackingResult> {
  const record = await delivery.getDelivery(deliveryId);
  if (!record) throw new Error(`Delivery "${deliveryId}" not found`);
  if (!record.tracking) throw new Error(`Delivery "${deliveryId}" has no tracking number`);
  if (!record.providerId) throw new Error(`Delivery "${deliveryId}" has no provider`);

  const providerUrl = resolveProviderUrl(record.providerId);
  const provider = createShipmentProviderServiceClient({ baseUrl: providerUrl });

  const result = await provider.tracking({ tracking: record.tracking });

  await delivery.setStatus(deliveryId, result.status as any, { type: "provider" });

  return result;
}
