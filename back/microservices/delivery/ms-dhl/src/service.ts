import type {
  ShipmentProviderService,
  QuoteRequest,
  QuoteResult,
  CreateShipmentRequest,
  CreateShipmentResult,
  LabelRequest,
  LabelResult,
  TrackingRequest,
  TrackingResult,
  WebhookRequest,
  AddressValidationRequest,
  AddressValidationResult,
  CustomsLookupRequest,
  CustomsLookupResult,
} from "./types";

export class DhlProviderService implements ShipmentProviderService {
  constructor(_config: Record<string, unknown> = {}) {}

  async quote(_input: QuoteRequest): Promise<QuoteResult> {
    throw new Error("DHL provider does not support quote in this build");
  }

  async createShipment(
    _input: CreateShipmentRequest,
  ): Promise<CreateShipmentResult> {
    throw new Error("DHL provider does not support shipment creation in this build");
  }

  async label(_input: LabelRequest): Promise<LabelResult> {
    throw new Error("DHL provider does not support label generation in this build");
  }

  async tracking(_input: TrackingRequest): Promise<TrackingResult> {
    throw new Error("DHL provider tracking is not configured in this build");
  }

  async webhook(_input: WebhookRequest): Promise<void> {
    return;
  }

  async validateAddress(
    _input: AddressValidationRequest,
  ): Promise<AddressValidationResult> {
    throw new Error("DHL provider does not support address validation in this build");
  }

  async customsLookup(
    input: CustomsLookupRequest,
  ): Promise<CustomsLookupResult> {
    return {
      items: input.items,
      raw: { unsupported: true },
    };
  }
}

