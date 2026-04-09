import { createShipmentProviderServiceClient } from "g-shipmentprovider";
import type { QuoteRequest, QuoteResult } from "g-shipmentprovider";

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

export async function quoteDelivery(
  providerId: string,
  input: QuoteRequest,
): Promise<QuoteResult> {
  const providerUrl = resolveProviderUrl(providerId);
  const provider = createShipmentProviderServiceClient({ baseUrl: providerUrl });
  return provider.quote(input);
}
