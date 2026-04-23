import { createDeliveryServiceClient } from "g-delivery";
import { createShipmentProviderServiceClient } from "g-shipmentprovider";
import type { DeliveryInput } from "g-delivery";
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

export async function createDelivery(
  input: DeliveryInput & { serviceCode?: string },
): Promise<{ deliveryId: string; tracking: string }> {
  const { serviceCode, ...deliveryInput } = input;
  const providerId = deliveryInput.providerId;
  if (!providerId) throw new Error("providerId is required");

  const deliveryId = await delivery.createDelivery(deliveryInput);

  const providerUrl = resolveProviderUrl(providerId);
  const provider = createShipmentProviderServiceClient({ baseUrl: providerUrl });

  const result = await provider.createShipment({ shipment: input.shipment, serviceCode });

  await delivery.updateDelivery(deliveryId, { tracking: result.tracking });
  await delivery.setStatus(deliveryId, "ready", { type: "system" });

  return { deliveryId, tracking: result.tracking };
}
