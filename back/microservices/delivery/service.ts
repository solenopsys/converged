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
  ShipmentStatus,
  Shipment,
  Address,
  Parcel,
  CustomsItem,
} from "./types";

export type DhlConfig = {
  baseUrl?: string;
  apiKey?: string;
  basicAuthUser?: string;
  basicAuthPass?: string;
  authMode?: "apiKey" | "basic" | "both";
  accountNumber?: string;
  productCode?: string;
  customsShipment?: Shipment;
  customsCurrency?: string;
  pickupRequested?: boolean;
  labelTypeCode?: "waybill" | "commercial-invoice" | "customs-entry";
  labelEncodingFormat?: "pdf" | "tiff";
  labelAllInOnePDF?: boolean;
  messageReference?: string;
  messageReferenceDate?: string;
  unitOfMeasurement?: "metric" | "imperial";
};

const DEFAULT_CONFIG: Required<Omit<DhlConfig, "apiKey" | "basicAuthUser" | "basicAuthPass" | "accountNumber" | "productCode" | "messageReference" | "messageReferenceDate" | "customsShipment" | "customsCurrency">> & {
  apiKey?: string;
  basicAuthUser?: string;
  basicAuthPass?: string;
  accountNumber?: string;
  productCode?: string;
  customsShipment?: Shipment;
  customsCurrency?: string;
  messageReference?: string;
  messageReferenceDate?: string;
} = {
  baseUrl: process.env.DHL_API_BASE || "https://express.api.dhl.com/mydhlapi/test",
  apiKey: process.env.DHL_API_KEY || "",
  basicAuthUser: process.env.DHL_BASIC_USER || "",
  basicAuthPass: process.env.DHL_BASIC_PASS || "",
  authMode: (process.env.DHL_AUTH_MODE as any) || "apiKey",
  accountNumber: process.env.DHL_ACCOUNT_NUMBER || "",
  productCode: process.env.DHL_PRODUCT_CODE || "",
  customsShipment: undefined,
  customsCurrency: process.env.DHL_CUSTOMS_CURRENCY || "",
  pickupRequested: (process.env.DHL_PICKUP_REQUESTED || "false").toLowerCase() === "true",
  labelTypeCode: (process.env.DHL_LABEL_TYPE_CODE as any) || "waybill",
  labelEncodingFormat: (process.env.DHL_LABEL_FORMAT as any) || "pdf",
  labelAllInOnePDF: (process.env.DHL_LABEL_ALL_IN_ONE || "false").toLowerCase() === "true",
  messageReference: process.env.DHL_MESSAGE_REFERENCE || "",
  messageReferenceDate: process.env.DHL_MESSAGE_REFERENCE_DATE || "",
  unitOfMeasurement: (process.env.DHL_UNIT as any) || "metric",
};

export class DhlProviderService implements ShipmentProviderService {
  private config: Required<DhlConfig>;

  constructor(config: DhlConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as Required<DhlConfig>;
  }

  async quote(input: QuoteRequest): Promise<QuoteResult> {
    const payload = this.buildRateRequest(input.shipment);
    const data = await this.requestJson("POST", "/rates", payload);

    const products = data?.products || data?.rateResponse?.products || [];
    const first = Array.isArray(products) ? products[0] : undefined;
    const totalPrice = Array.isArray(first?.totalPrice)
      ? first.totalPrice[0]
      : first?.totalPrice;
    const price = this.pickNumber(totalPrice, ["price", "amount"], 0) ?? 0;
    const currency =
      this.pickString(totalPrice, ["currency", "currencyCode"], "") ?? "";
    const etaDays = this.pickNumber(first, ["deliveryTime", "etaDays"], undefined);
    const serviceCode = this.pickString(first, ["productCode", "serviceCode"], undefined);

    return {
      price,
      currency,
      etaDays,
      serviceCode,
      raw: data,
    };
  }

  async createShipment(
    input: CreateShipmentRequest,
  ): Promise<CreateShipmentResult> {
    const payload = this.buildCreateShipmentRequest(input.shipment, input.serviceCode);
    const data = await this.requestJson("POST", "/shipments", payload);

    const shipment = data?.shipments?.[0] || data?.shipment || data;
    const tracking =
      shipment?.shipmentTrackingNumber ||
      shipment?.trackingNumber ||
      shipment?.tracking ||
      "";

    return {
      tracking: String(tracking || ""),
      providerRef: shipment?.shipmentIdentificationNumber || shipment?.id,
      raw: data,
    };
  }

  async label(input: LabelRequest): Promise<LabelResult> {
    const tracking = input.tracking;
    const account = this.requireAccountNumber();

    const query: Record<string, string> = {
      shipperAccountNumber: account,
      typeCode: this.config.labelTypeCode,
      pickupYearAndMonth: this.getYearMonth(new Date()),
    };

    if (this.config.labelEncodingFormat) {
      query.encodingFormat = this.config.labelEncodingFormat;
    }
    if (this.config.labelAllInOnePDF) {
      query.allInOnePDF = "true";
    }

    const data = await this.requestJson(
      "GET",
      `/shipments/${encodeURIComponent(tracking)}/get-image`,
      undefined,
      query,
    );

    const doc = data?.documents?.[0];
    const content = doc?.content || "";

    return {
      pdfBase64: String(content || ""),
      raw: data,
    };
  }

  async tracking(input: TrackingRequest): Promise<TrackingResult> {
    const query = {
      shipmentTrackingNumber: input.tracking,
      trackingView: "last-checkpoint",
      levelOfDetail: "shipment",
    };

    const data = await this.requestJson("GET", "/tracking", undefined, query);
    const shipment = data?.shipments?.[0];
    const events = shipment?.events || [];
    const lastEvent = Array.isArray(events) && events.length > 0 ? events[events.length - 1] : undefined;
    const statusText = lastEvent?.description || shipment?.status || "";

    return {
      status: this.normalizeStatus(statusText),
      lastUpdate: lastEvent?.date ? `${lastEvent.date}T${lastEvent.time || "00:00:00"}` : undefined,
      raw: data,
    };
  }

  async webhook(_input: WebhookRequest): Promise<void> {
    return;
  }

  async validateAddress(
    input: AddressValidationRequest,
  ): Promise<AddressValidationResult> {
    const addr = input.address;
    const query: Record<string, string> = {
      type: "delivery",
      countryCode: addr.country,
    };

    if (addr.postalCode) query.postalCode = addr.postalCode;
    if (addr.city) query.cityName = addr.city;
    if (addr.region) query.countyName = addr.region;
    if (addr.line1) query.addressLine1 = addr.line1;

    const data = await this.requestJson("GET", "/address-validate", undefined, query);

    const suggestions = data?.address || data?.addresses || data?.suggestions || [];
    const first = Array.isArray(suggestions) ? suggestions[0] : undefined;

    return {
      valid: Boolean(data?.valid || first?.valid || false),
      normalized: first?.address || undefined,
      raw: data,
    };
  }

  async customsLookup(
    input: CustomsLookupRequest,
  ): Promise<CustomsLookupResult> {
    const shipment = this.config.customsShipment;
    if (!shipment) {
      throw new Error("Customs lookup requires DHL customsShipment config");
    }
    const payload = this.buildLandedCostRequest(
      shipment,
      input.items,
      this.config.customsCurrency || shipment.currency,
    );
    const data = await this.requestJson("POST", "/landed-cost", payload);
    return {
      items: input.items,
      raw: data,
    };
  }

  private buildRateRequest(shipment: Shipment): any {
    const { from, to, parcels } = shipment;
    const planned = this.formatPlannedDate(new Date());

    const packages = this.buildPackages(parcels);

    const payload: any = {
      customerDetails: {
        shipperDetails: this.mapRateAddress(from),
        receiverDetails: this.mapRateAddress(to),
      },
      plannedShippingDateAndTime: planned,
      unitOfMeasurement: this.config.unitOfMeasurement,
      isCustomsDeclarable: Boolean(shipment.items && shipment.items.length > 0),
      packages,
    };

    if (this.config.accountNumber) {
      payload.accounts = [
        {
          typeCode: "shipper",
          number: this.config.accountNumber,
        },
      ];
    }

    return payload;
  }

  private buildCreateShipmentRequest(shipment: Shipment, serviceCode?: string): any {
    const { from, to, parcels, description, value, currency, items } = shipment;
    const planned = this.formatPlannedDate(new Date());

    const packages = this.buildPackages(parcels);
    const isCustomsDeclarable = Boolean(items && items.length > 0);

    const content: any = {
      packages,
      isCustomsDeclarable,
      description: description || "Shipment",
      unitOfMeasurement: this.config.unitOfMeasurement,
    };

    if (value !== undefined) {
      content.declaredValue = value;
      if (currency) content.declaredValueCurrency = currency;
    }

    if (isCustomsDeclarable) {
      content.exportDeclaration = {
        lineItems: this.buildExportLineItems(items || [], parcels, from.country),
      };
    }

    return {
      plannedShippingDateAndTime: planned,
      pickup: {
        isRequested: this.config.pickupRequested,
      },
      productCode: serviceCode || this.requireProductCode(),
      accounts: [
        {
          typeCode: "shipper",
          number: this.requireAccountNumber(),
        },
      ],
      customerDetails: {
        shipperDetails: this.mapShipmentParty(from, "shipper"),
        receiverDetails: this.mapShipmentParty(to, "receiver"),
      },
      content,
    };
  }

  private buildLandedCostRequest(shipment: Shipment, items: CustomsItem[], currency?: string): any {
    if (!items || items.length === 0) {
      throw new Error("Customs lookup requires items");
    }

    const { from, to, parcels } = shipment;
    const packages = this.buildPackages(parcels);
    const currencyCode = currency || shipment.currency || items[0]?.currency || "";

    return {
      customerDetails: {
        shipperDetails: this.mapRateAddress(from),
        receiverDetails: this.mapRateAddress(to),
      },
      accounts: [
        {
          typeCode: "shipper",
          number: this.requireAccountNumber(),
        },
      ],
      unitOfMeasurement: this.config.unitOfMeasurement,
      currencyCode,
      isCustomsDeclarable: true,
      getCostBreakdown: true,
      packages,
      items: this.buildLandedCostItems(items, parcels, currencyCode),
    };
  }

  private buildPackages(parcels: Parcel[]): any[] {
    if (!parcels || parcels.length === 0) {
      throw new Error("At least one parcel is required");
    }

    return parcels.map((p) => {
      if (!p.weightKg) {
        throw new Error("Parcel weightKg is required");
      }
      const length = p.lengthCm ?? 1;
      const width = p.widthCm ?? 1;
      const height = p.heightCm ?? 1;

      return {
        weight: p.weightKg,
        dimensions: {
          length,
          width,
          height,
        },
      };
    });
  }

  private mapRateAddress(address: Address): any {
    if (!address.city || !address.country) {
      throw new Error("Address city and country are required");
    }

    return {
      postalCode: address.postalCode || "",
      cityName: address.city,
      countryCode: address.country,
      provinceCode: address.region,
      addressLine1: address.line1,
    };
  }

  private mapShipmentParty(address: Address, fallbackName: string): any {
    if (!address.line1 || !address.city || !address.postalCode || !address.country) {
      throw new Error("Address requires line1, city, postalCode, country");
    }

    const name = address.name || fallbackName;
    const phone = address.phone || "";

    if (!phone) {
      throw new Error("Address phone is required for shipment creation");
    }

    return {
      postalAddress: {
        postalCode: address.postalCode,
        cityName: address.city,
        countryCode: address.country,
        provinceCode: address.region,
        addressLine1: address.line1,
      },
      contactInformation: {
        fullName: name,
        companyName: name,
        phone,
      },
    };
  }

  private buildExportLineItems(items: CustomsItem[], parcels: Parcel[], fallbackCountry: string): any[] {
    if (!items || items.length === 0) return [];

    const totalWeight = parcels.reduce((sum, p) => sum + (p.weightKg || 0), 0);
    const perItemWeight = totalWeight > 0 ? totalWeight / items.length : 0.1;

    return items.map((item, index) => {
      const quantity = item.qty || 1;
      const price = item.price ?? 0;
      const origin = item.originCountry || fallbackCountry || "";

      return {
        number: index + 1,
        description: item.name || "Item",
        price,
        quantity: {
          value: quantity,
          unitOfMeasurement: "PCS",
        },
        manufacturerCountry: origin,
        weight: {
          netValue: perItemWeight,
          grossValue: perItemWeight,
        },
        commodityCodes: item.hsCode
          ? [
              {
                typeCode: "outbound",
                value: item.hsCode,
              },
            ]
          : undefined,
      };
    });
  }

  private buildLandedCostItems(items: CustomsItem[], parcels: Parcel[], currencyCode: string): any[] {
    const totalWeight = parcels.reduce((sum, p) => sum + (p.weightKg || 0), 0);
    const perItemWeight = totalWeight > 0 ? totalWeight / items.length : 0.1;

    return items.map((item, index) => {
      return {
        number: index + 1,
        quantity: item.qty || 1,
        unitPrice: item.price ?? 0,
        unitPriceCurrencyCode: item.currency || currencyCode,
        name: item.name,
        description: item.name,
        manufacturerCountry: item.originCountry,
        commodityCode: item.hsCode,
        weight: perItemWeight,
        weightUnitOfMeasurement: this.config.unitOfMeasurement,
      };
    });
  }

  private requireAccountNumber(): string {
    const account = this.config.accountNumber;
    if (!account) {
      throw new Error("DHL account number is required (DHL_ACCOUNT_NUMBER)");
    }
    return account;
  }

  private requireProductCode(): string {
    const code = this.config.productCode;
    if (!code) {
      throw new Error("DHL product code is required (DHL_PRODUCT_CODE)");
    }
    return code;
  }

  private getYearMonth(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const authMode = this.config.authMode || "apiKey";

    if ((authMode === "apiKey" || authMode === "both") && this.config.apiKey) {
      headers["X-API-KEY"] = this.config.apiKey;
    }

    if (this.config.messageReference) {
      headers["Message-Reference"] = this.config.messageReference;
    }
    if (this.config.messageReferenceDate) {
      headers["Message-Reference-Date"] = this.config.messageReferenceDate;
    }

    if (
      (authMode === "basic" || authMode === "both") &&
      this.config.basicAuthUser &&
      this.config.basicAuthPass
    ) {
      const token = Buffer.from(
        `${this.config.basicAuthUser}:${this.config.basicAuthPass}`,
        "utf8",
      ).toString("base64");
      headers.Authorization = `Basic ${token}`;
    }

    return headers;
  }

  private async requestJson(
    method: "GET" | "POST",
    path: string,
    body?: any,
    query?: Record<string, any>,
  ): Promise<any> {
    const base = this.config.baseUrl.replace(/\/$/, "");
    const url = base + path + this.buildQuery(query);

    const response = await fetch(url, {
      method,
      headers: this.buildHeaders(),
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DHL API error: ${response.status} ${text}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    const text = await response.text();
    return text ? { raw: text } : {};
  }

  private buildQuery(query?: Record<string, any>): string {
    if (!query) return "";
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, String(v)));
      } else {
        params.append(key, String(value));
      }
    }
    const q = params.toString();
    return q ? `?${q}` : "";
  }

  private normalizeStatus(value?: string): ShipmentStatus {
    const text = (value || "").toLowerCase();
    if (text.includes("deliver")) return "delivered";
    if (text.includes("problem") || text.includes("failed") || text.includes("exception")) {
      return "problem";
    }
    if (text.includes("ready") || text.includes("created") || text.includes("label")) {
      return "ready";
    }
    return "in_transit";
  }

  private formatPlannedDate(date: Date): string {
    const iso = date.toISOString().replace(/\.\d{3}Z$/, "Z");
    if (iso.endsWith("Z")) {
      return iso.replace("Z", " GMT+00:00");
    }
    return iso;
  }

  private pickString(obj: any, keys: string[], fallback?: string): string | undefined {
    for (const key of keys) {
      if (!obj) break;
      if (obj[key] !== undefined) return String(obj[key]);
    }
    return fallback;
  }

  private pickNumber(obj: any, keys: string[], fallback?: number): number | undefined {
    for (const key of keys) {
      if (!obj) break;
      if (obj[key] !== undefined) {
        const num = Number(obj[key]);
        return Number.isFinite(num) ? num : fallback;
      }
    }
    return fallback;
  }
}
