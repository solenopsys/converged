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

export type FedexConfig = {
  baseUrl?: string;
  oauthPath?: string;
  ratePath?: string;
  shipPath?: string;
  shipResultsPath?: string;
  trackPath?: string;
  addressPath?: string;
  clientId?: string;
  clientSecret?: string;
  accountNumber?: string;
  pickupType?: string;
  packagingType?: string;
  serviceType?: string;
  paymentType?: string;
  rateRequestType?: string[];
  labelResponseOptions?: "LABEL" | "URL_ONLY" | string;
  labelImageType?: string;
  labelStockType?: string;
  weightUnits?: "KG" | "LB";
  dimensionUnits?: "CM" | "IN";
  includeDetailedScans?: boolean;
  locale?: string;
  tokenSkewSeconds?: number;
};

const DEFAULT_CONFIG: Required<Omit<FedexConfig, "clientId" | "clientSecret" | "accountNumber" | "serviceType">> & {
  clientId?: string;
  clientSecret?: string;
  accountNumber?: string;
  serviceType?: string;
} = {
  baseUrl: process.env.FEDEX_API_BASE || "https://apis-sandbox.fedex.com",
  oauthPath: process.env.FEDEX_OAUTH_PATH || "/oauth/token",
  ratePath: process.env.FEDEX_RATE_PATH || "/rate/v1/rates/quotes",
  shipPath: process.env.FEDEX_SHIP_PATH || "/ship/v1/shipments",
  shipResultsPath: process.env.FEDEX_SHIP_RESULTS_PATH || "/ship/v1/shipments/results",
  trackPath: process.env.FEDEX_TRACK_PATH || "/track/v1/trackingnumbers",
  addressPath: process.env.FEDEX_ADDRESS_PATH || "/address/v1/addresses/resolve",
  clientId: process.env.FEDEX_CLIENT_ID || "",
  clientSecret: process.env.FEDEX_CLIENT_SECRET || "",
  accountNumber: process.env.FEDEX_ACCOUNT_NUMBER || "",
  pickupType: process.env.FEDEX_PICKUP_TYPE || "DROPOFF_AT_FEDEX_LOCATION",
  packagingType: process.env.FEDEX_PACKAGING_TYPE || "YOUR_PACKAGING",
  serviceType: process.env.FEDEX_SERVICE_TYPE || "",
  paymentType: process.env.FEDEX_PAYMENT_TYPE || "SENDER",
  rateRequestType: (process.env.FEDEX_RATE_REQUEST_TYPE || "ACCOUNT")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0),
  labelResponseOptions: process.env.FEDEX_LABEL_RESPONSE_OPTIONS || "LABEL",
  labelImageType: process.env.FEDEX_LABEL_IMAGE_TYPE || "PDF",
  labelStockType: process.env.FEDEX_LABEL_STOCK_TYPE || "PAPER_4X6",
  weightUnits: (process.env.FEDEX_WEIGHT_UNITS as any) || "KG",
  dimensionUnits: (process.env.FEDEX_DIMENSION_UNITS as any) || "CM",
  includeDetailedScans: (process.env.FEDEX_TRACK_DETAILED || "false").toLowerCase() === "true",
  locale: process.env.FEDEX_LOCALE || "",
  tokenSkewSeconds: Number(process.env.FEDEX_TOKEN_SKEW || 60),
};

type TokenState = {
  value: string;
  expiresAt: number;
};

export class FedexProviderService implements ShipmentProviderService {
  private config: Required<FedexConfig>;
  private token?: TokenState;

  constructor(config: FedexConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      rateRequestType: config.rateRequestType || DEFAULT_CONFIG.rateRequestType,
    } as Required<FedexConfig>;
  }

  async quote(input: QuoteRequest): Promise<QuoteResult> {
    const payload = this.buildRateRequest(input.shipment);
    const data = await this.requestJson("POST", this.config.ratePath, payload);

    const reply =
      data?.output?.rateReplyDetails?.[0] ||
      data?.rateReplyDetails?.[0] ||
      data?.rateReplyDetails;
    const rated =
      reply?.ratedShipmentDetails?.[0] || reply?.ratedShipmentDetails || reply;
    const total =
      rated?.totalNetCharge ||
      rated?.totalNetChargeWithDutiesAndTaxes ||
      rated?.shipmentRateDetail?.totalNetCharge ||
      rated?.shipmentRateDetail?.totalNetChargeWithDutiesAndTaxes ||
      rated?.totalNetChargeAmount ||
      rated?.totalNetChargeAmountWithDutiesAndTaxes ||
      rated;

    const price =
      this.pickNumber(total, ["amount", "value", "total"] , 0) ?? 0;
    const currency =
      this.pickString(total, ["currency", "currencyCode"], "") ||
      this.pickString(rated?.shipmentRateDetail, ["currency"], "") ||
      "";
    const serviceCode = this.pickString(reply, ["serviceType", "serviceTypeCode"], undefined);

    return {
      price,
      currency,
      serviceCode,
      raw: data,
    };
  }

  async createShipment(
    input: CreateShipmentRequest,
  ): Promise<CreateShipmentResult> {
    const payload = this.buildCreateShipmentRequest(input.shipment, input.serviceCode);
    const data = await this.requestJson("POST", this.config.shipPath, payload);

    const output = data?.output || data;
    const shipment = output?.transactionShipments?.[0] || output?.shipment || output;
    const piece = shipment?.pieceResponses?.[0] || shipment?.pieceResponses;
    const tracking =
      piece?.trackingNumber ||
      shipment?.masterTrackingNumber ||
      shipment?.trackingNumber ||
      shipment?.tracking ||
      "";

    return {
      tracking: String(tracking || ""),
      providerRef: shipment?.shipmentId || shipment?.transactionId || shipment?.serviceCategory,
      raw: data,
    };
  }

  async label(input: LabelRequest): Promise<LabelResult> {
    const payload = this.buildLabelRequest(input.tracking);
    const data = await this.requestJson("POST", this.config.shipResultsPath, payload);
    const pdfBase64 = this.extractLabel(data);

    return {
      pdfBase64,
      raw: data,
    };
  }

  async tracking(input: TrackingRequest): Promise<TrackingResult> {
    const payload = {
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber: input.tracking,
          },
        },
      ],
      includeDetailedScans: this.config.includeDetailedScans,
    };

    const data = await this.requestJson("POST", this.config.trackPath, payload);
    const track =
      data?.output?.completeTrackResults?.[0]?.trackResults?.[0] ||
      data?.completeTrackResults?.[0]?.trackResults?.[0] ||
      data?.trackResults?.[0] ||
      data;

    const latest = track?.latestStatusDetail || track?.statusDetail || {};
    const statusText =
      latest?.description || latest?.code || track?.latestStatusDetail?.code || "";
    const lastUpdate =
      latest?.scanDateTime ||
      latest?.dateAndTime ||
      track?.dateAndTimes?.[0]?.dateTime ||
      undefined;

    return {
      status: this.normalizeStatus(String(statusText || "")),
      lastUpdate,
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
    const payload = {
      addressesToValidate: [
        {
          address: {
            streetLines: [addr.line1],
            city: addr.city,
            stateOrProvinceCode: addr.region,
            postalCode: addr.postalCode,
            countryCode: addr.country,
          },
        },
      ],
    };

    const data = await this.requestJson("POST", this.config.addressPath, payload);
    const resolved =
      data?.output?.resolvedAddresses?.[0] ||
      data?.resolvedAddresses?.[0] ||
      data?.resolvedAddresses ||
      undefined;

    if (!resolved) {
      return { valid: false, raw: data };
    }

    const normalizedAddress = resolved?.address || resolved?.resolvedAddress || resolved;
    const streetLines = normalizedAddress?.streetLines || [];

    return {
      valid: true,
      normalized: {
        name: addr.name,
        phone: addr.phone,
        line1: streetLines[0] || addr.line1,
        city: normalizedAddress?.city || addr.city,
        region: normalizedAddress?.stateOrProvinceCode || addr.region,
        postalCode: normalizedAddress?.postalCode || addr.postalCode,
        country: normalizedAddress?.countryCode || addr.country,
      },
      raw: data,
    };
  }

  async customsLookup(
    input: CustomsLookupRequest,
  ): Promise<CustomsLookupResult> {
    return {
      items: input.items,
      raw: { unsupported: true },
    };
  }

  private buildRateRequest(shipment: Shipment): any {
    const accountNumber = this.requireAccountNumber();
    const packages = this.mapParcels(shipment.parcels);

    return {
      accountNumber: { value: accountNumber },
      requestedShipment: {
        shipper: { address: this.mapAddress(shipment.from) },
        recipient: { address: this.mapAddress(shipment.to) },
        pickupType: this.config.pickupType,
        rateRequestType: this.config.rateRequestType,
        packagingType: this.config.packagingType,
        serviceType: this.config.serviceType || undefined,
        requestedPackageLineItems: packages,
      },
    };
  }

  private buildCreateShipmentRequest(shipment: Shipment, serviceCode?: string): any {
    const accountNumber = this.requireAccountNumber();
    const packages = this.mapParcels(shipment.parcels);
    const shipDate = new Date().toISOString().slice(0, 10);

    const requestedShipment: any = {
      shipDatestamp: shipDate,
      pickupType: this.config.pickupType,
      serviceType: serviceCode || this.config.serviceType || undefined,
      packagingType: this.config.packagingType,
      shipper: {
        contact: this.mapContact(shipment.from),
        address: this.mapAddress(shipment.from),
      },
      recipients: [
        {
          contact: this.mapContact(shipment.to),
          address: this.mapAddress(shipment.to),
        },
      ],
      shippingChargesPayment: {
        paymentType: this.config.paymentType,
        payor: {
          responsibleParty: {
            accountNumber: { value: accountNumber },
          },
        },
      },
      labelSpecification: {
        imageType: this.config.labelImageType,
        labelStockType: this.config.labelStockType,
      },
      requestedPackageLineItems: packages,
    };

    const customsDetail = this.mapCustoms(shipment.items || [], shipment);
    if (customsDetail) {
      requestedShipment.customsClearanceDetail = customsDetail;
    }

    return {
      accountNumber: { value: accountNumber },
      labelResponseOptions: this.config.labelResponseOptions,
      requestedShipment,
    };
  }

  private buildLabelRequest(tracking: string): any {
    const accountNumber = this.requireAccountNumber();
    return {
      accountNumber: { value: accountNumber },
      trackingNumber: tracking,
      labelResponseOptions: this.config.labelResponseOptions,
      labelSpecification: {
        imageType: this.config.labelImageType,
        labelStockType: this.config.labelStockType,
      },
    };
  }

  private mapParcels(parcels: Parcel[]): any[] {
    if (!parcels || parcels.length === 0) {
      return [
        {
          weight: {
            units: this.config.weightUnits,
            value: 0.5,
          },
        },
      ];
    }

    return parcels.map((parcel) => {
      const line: any = {
        weight: {
          units: this.config.weightUnits,
          value: this.normalizeWeight(parcel.weightKg),
        },
      };

      if (this.hasDimensions(parcel)) {
        line.dimensions = {
          length: this.normalizeDim(parcel.lengthCm),
          width: this.normalizeDim(parcel.widthCm),
          height: this.normalizeDim(parcel.heightCm),
          units: this.config.dimensionUnits,
        };
      }

      return line;
    });
  }

  private mapAddress(address: Address): any {
    return {
      streetLines: [address.line1],
      city: address.city,
      stateOrProvinceCode: address.region,
      postalCode: address.postalCode,
      countryCode: address.country,
    };
  }

  private mapContact(address: Address): any {
    return {
      personName: address.name || "Unknown",
      phoneNumber: address.phone || "0000000000",
    };
  }

  private mapCustoms(items: CustomsItem[], shipment: Shipment): any | undefined {
    if (!items || items.length === 0) return undefined;

    const commodities = items.map((item) => ({
      description: item.name,
      quantity: item.qty,
      quantityUnits: "EA",
      weight: {
        units: this.config.weightUnits,
        value: this.normalizeWeight(
          shipment.parcels?.[0]?.weightKg ? shipment.parcels[0].weightKg / Math.max(items.length, 1) : 0.1,
        ),
      },
      unitPrice: item.price
        ? {
            amount: item.price,
            currency: item.currency || shipment.currency || "USD",
          }
        : undefined,
      customsValue: item.price
        ? {
            amount: item.price * item.qty,
            currency: item.currency || shipment.currency || "USD",
          }
        : undefined,
      harmonizedCode: item.hsCode,
      countryOfManufacture: item.originCountry,
    }));

    return {
      commodities,
      dutiesPayment: {
        paymentType: this.config.paymentType,
        payor: {
          responsibleParty: {
            accountNumber: { value: this.requireAccountNumber() },
          },
        },
      },
      documentContent: "NON_DOCUMENTS",
    };
  }

  private extractLabel(data: any): string {
    const output = data?.output || data;
    const shipment = output?.transactionShipments?.[0] || output?.shipment || output;
    const docs =
      shipment?.shipmentDocuments ||
      shipment?.packageDocuments ||
      shipment?.pieceResponses?.[0]?.packageDocuments ||
      shipment?.pieceResponses?.[0]?.label ||
      output?.shipmentDocuments ||
      output?.documents ||
      undefined;

    const doc = Array.isArray(docs) ? docs[0] : docs;
    const content =
      doc?.encodedLabel ||
      doc?.content ||
      doc?.label ||
      doc?.url ||
      doc?.link ||
      "";

    return String(content || "");
  }

  private normalizeWeight(weightKg: number | undefined): number {
    const weight = Number(weightKg || 0);
    if (this.config.weightUnits === "LB") {
      const lb = weight * 2.20462;
      return Math.max(0.1, Number(lb.toFixed(3)));
    }
    return Math.max(0.1, Number(weight.toFixed(3)));
  }

  private normalizeDim(value: number | undefined): number {
    const num = Number(value || 0);
    if (this.config.dimensionUnits === "IN") {
      const inches = num / 2.54;
      return Math.max(1, Math.round(inches));
    }
    return Math.max(1, Math.round(num));
  }

  private hasDimensions(parcel: Parcel): boolean {
    return (
      parcel.lengthCm !== undefined &&
      parcel.widthCm !== undefined &&
      parcel.heightCm !== undefined
    );
  }

  private requireAccountNumber(): string {
    const account = this.config.accountNumber;
    if (!account) {
      throw new Error("FedEx accountNumber is required");
    }
    return account;
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.token.expiresAt) {
      return this.token.value;
    }

    const clientId = this.config.clientId;
    const clientSecret = this.config.clientSecret;

    if (!clientId || !clientSecret) {
      throw new Error("FedEx client credentials are required");
    }

    const base = this.config.baseUrl.replace(/\/$/, "");
    const url = base + this.config.oauthPath;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    const data = await this.readResponsePayload(response);
    if (!response.ok) {
      const detail =
        typeof data === "string" ? data : this.formatErrorPayload(data);
      throw new Error(`FedEx OAuth error: ${response.status} ${detail}`);
    }

    if (!data || typeof data !== "object") {
      throw new Error("FedEx OAuth: empty response payload");
    }
    const token = String(data?.access_token || "");
    const expiresIn = Number(data?.expires_in || 3600);
    const skew = Number.isFinite(this.config.tokenSkewSeconds)
      ? this.config.tokenSkewSeconds
      : 60;
    const expiresAt = now + Math.max(0, expiresIn - skew) * 1000;

    if (!token) {
      throw new Error("FedEx OAuth: empty access_token");
    }

    this.token = { value: token, expiresAt };
    return token;
  }

  private async requestJson(
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: any,
    query?: Record<string, any>,
  ): Promise<any> {
    const base = this.config.baseUrl.replace(/\/$/, "");
    const url = base + path + this.buildQuery(query);
    const token = await this.getToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };

    if (this.config.locale) {
      headers["X-locale"] = this.config.locale;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });

    const payload = await this.readResponsePayload(response);

    if (!response.ok) {
      const detail =
        typeof payload === "string" ? payload : this.formatErrorPayload(payload);
      throw new Error(`FedEx API error: ${response.status} ${detail}`);
    }

    return payload;
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
    if (text.includes("deliver") || text.includes("delivered")) return "delivered";
    if (
      text.includes("exception") ||
      text.includes("failed") ||
      text.includes("issue") ||
      text.includes("problem")
    ) {
      return "problem";
    }
    if (text.includes("label") || text.includes("created") || text.includes("ready")) {
      return "ready";
    }
    return "in_transit";
  }

  private pickString(obj: any, keys: string[], fallback?: string): string | undefined {
    for (const key of keys) {
      if (!obj) break;
      if (obj[key] !== undefined && obj[key] !== null) return String(obj[key]);
    }
    return fallback;
  }

  private pickNumber(obj: any, keys: string[], fallback?: number): number | undefined {
    for (const key of keys) {
      if (!obj) break;
      if (obj[key] !== undefined && obj[key] !== null) {
        const num = Number(obj[key]);
        return Number.isFinite(num) ? num : fallback;
      }
    }
    return fallback;
  }

  private async readResponsePayload(response: Response): Promise<any> {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        return await response.json();
      } catch {
        return {};
      }
    }

    const text = await response.text();
    return text || {};
  }

  private formatErrorPayload(payload: any): string {
    if (!payload) return "";
    if (typeof payload === "string") return payload;

    const errors = payload.errors || payload.error || payload.errorDetails;
    if (Array.isArray(errors) && errors.length > 0) {
      return errors
        .map((err) => {
          const code = err.code || err.errorCode || err.errorCodeValue || "UNKNOWN";
          const message = err.message || err.description || err.details || "";
          const parameter = err.parameterList?.[0]?.key || err.parameter || "";
          return [code, message, parameter].filter(Boolean).join(" ");
        })
        .join("; ");
    }

    if (errors && typeof errors === "object") {
      const code = errors.code || errors.errorCode || "UNKNOWN";
      const message = errors.message || errors.description || "";
      return [code, message].filter(Boolean).join(" ");
    }

    if (payload.message) return String(payload.message);
    if (payload.details) return String(payload.details);

    try {
      return JSON.stringify(payload);
    } catch {
      return String(payload);
    }
  }
}
