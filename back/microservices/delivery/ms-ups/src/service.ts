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

export type UpsConfig = {
  baseUrl?: string;
  oauthPath?: string;
  ratingVersion?: string;
  ratingRequestOption?: string;
  ratingAdditionalInfo?: string;
  ratingPath?: string;
  shippingVersion?: string;
  shipPath?: string;
  labelRecoveryVersion?: string;
  labelRecoveryPath?: string;
  trackingPath?: string;
  trackingLocale?: string;
  trackingReturnSignature?: boolean;
  addressValidationVersion?: string;
  addressValidationRequestOption?: string;
  addressValidationPath?: string;
  clientId?: string;
  clientSecret?: string;
  shipperNumber?: string;
  serviceCode?: string;
  packagingCode?: string;
  requestOption?: string;
  subVersion?: string;
  labelSubVersion?: string;
  labelImageFormat?: string;
  labelUserAgent?: string;
  weightUnit?: "LBS" | "KGS";
  dimensionUnit?: "IN" | "CM";
  paymentTypeCode?: string;
  transactionSrc?: string;
  transactionId?: string;
  translateCode?: string;
  translateLanguage?: string;
  translateDialect?: string;
  tokenSkewSeconds?: number;
};

const DEFAULT_CONFIG: Required<Omit<UpsConfig, "clientId" | "clientSecret" | "shipperNumber" | "serviceCode" | "transactionId">> & {
  clientId?: string;
  clientSecret?: string;
  shipperNumber?: string;
  serviceCode?: string;
  transactionId?: string;
} = {
  baseUrl: process.env.UPS_API_BASE || "https://wwwcie.ups.com",
  oauthPath: process.env.UPS_OAUTH_PATH || "/security/v1/oauth/token",
  ratingVersion: process.env.UPS_RATING_VERSION || "v2403",
  ratingRequestOption: process.env.UPS_RATING_REQUEST_OPTION || "rate",
  ratingAdditionalInfo: process.env.UPS_RATING_ADDITIONAL || "",
  ratingPath: process.env.UPS_RATING_PATH || "",
  shippingVersion: process.env.UPS_SHIP_VERSION || "v2403",
  shipPath: process.env.UPS_SHIP_PATH || "",
  labelRecoveryVersion: process.env.UPS_LABEL_VERSION || "v1",
  labelRecoveryPath: process.env.UPS_LABEL_PATH || "",
  trackingPath: process.env.UPS_TRACK_PATH || "/api/track/v1/details",
  trackingLocale: process.env.UPS_TRACK_LOCALE || "en_US",
  trackingReturnSignature:
    (process.env.UPS_TRACK_RETURN_SIGNATURE || "false").toLowerCase() === "true",
  addressValidationVersion: process.env.UPS_ADDRESS_VERSION || "v2",
  addressValidationRequestOption: process.env.UPS_ADDRESS_REQUEST_OPTION || "1",
  addressValidationPath: process.env.UPS_ADDRESS_PATH || "",
  clientId: process.env.UPS_CLIENT_ID || "",
  clientSecret: process.env.UPS_CLIENT_SECRET || "",
  shipperNumber: process.env.UPS_SHIPPER_NUMBER || "",
  serviceCode: process.env.UPS_SERVICE_CODE || "",
  packagingCode: process.env.UPS_PACKAGING_CODE || "02",
  requestOption: process.env.UPS_REQUEST_OPTION || "nonvalidate",
  subVersion: process.env.UPS_SUB_VERSION || "2403",
  labelSubVersion: process.env.UPS_LABEL_SUB_VERSION || "1903",
  labelImageFormat: process.env.UPS_LABEL_IMAGE_FORMAT || "GIF",
  labelUserAgent: process.env.UPS_LABEL_USER_AGENT || "Mozilla/4.5",
  weightUnit: (process.env.UPS_WEIGHT_UNIT as any) || "LBS",
  dimensionUnit: (process.env.UPS_DIMENSION_UNIT as any) || "IN",
  paymentTypeCode: process.env.UPS_PAYMENT_TYPE_CODE || "01",
  transactionSrc: process.env.UPS_TRANSACTION_SRC || "ms-ups",
  transactionId: process.env.UPS_TRANSACTION_ID || "",
  translateCode: process.env.UPS_TRANSLATE_CODE || "01",
  translateLanguage: process.env.UPS_TRANSLATE_LANG || "eng",
  translateDialect: process.env.UPS_TRANSLATE_DIALECT || "US",
  tokenSkewSeconds: Number(process.env.UPS_TOKEN_SKEW || 60),
};

type TokenState = {
  value: string;
  expiresAt: number;
};

export class UpsProviderService implements ShipmentProviderService {
  private config: Required<UpsConfig>;
  private token?: TokenState;

  constructor(config: UpsConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as Required<UpsConfig>;
  }

  async quote(input: QuoteRequest): Promise<QuoteResult> {
    const payload = this.buildRateRequest(input.shipment);
    const path = this.config.ratingPath
      ? this.config.ratingPath
      : this.buildRatingPath();

    const data = await this.requestJson("POST", path, payload);

    const ratedShipment =
      data?.RateResponse?.RatedShipment ||
      data?.rateResponse?.ratedShipment ||
      data?.rateResponse?.RatedShipment ||
      data?.RatedShipment;

    const rated = Array.isArray(ratedShipment) ? ratedShipment[0] : ratedShipment;
    const totalCharges =
      rated?.TotalCharges ||
      rated?.totalCharges ||
      rated?.RatedPackage?.TotalCharges ||
      rated?.ratedPackage?.totalCharges ||
      rated?.TotalCharge ||
      rated;

    const price = this.pickNumber(totalCharges, ["MonetaryValue", "monetaryValue", "Amount", "amount"], 0) ?? 0;
    const currency =
      this.pickString(totalCharges, ["CurrencyCode", "currencyCode", "currency"], "") || "";
    const serviceCode =
      this.pickString(rated?.Service, ["Code", "code"], undefined) ||
      this.pickString(rated, ["ServiceCode", "serviceCode"], undefined);

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
    const payload = this.buildShipmentRequest(input.shipment, input.serviceCode);
    const path = this.config.shipPath || this.buildShipPath();
    const data = await this.requestJson("POST", path, payload);

    const results =
      data?.ShipmentResponse?.ShipmentResults ||
      data?.shipmentResponse?.shipmentResults ||
      data?.ShipmentResults ||
      data?.shipmentResults ||
      data;

    const packageResults = results?.PackageResults || results?.packageResults;
    const firstPackage = Array.isArray(packageResults) ? packageResults[0] : packageResults;

    const tracking =
      firstPackage?.TrackingNumber ||
      results?.ShipmentIdentificationNumber ||
      results?.trackingNumber ||
      "";

    return {
      tracking: String(tracking || ""),
      providerRef: results?.ShipmentIdentificationNumber || results?.shipmentIdentificationNumber,
      raw: data,
    };
  }

  async label(input: LabelRequest): Promise<LabelResult> {
    const payload = this.buildLabelRecoveryRequest(input.tracking);
    const path = this.config.labelRecoveryPath || this.buildLabelRecoveryPath();
    const data = await this.requestJson("POST", path, payload);

    const labelResults =
      data?.LabelRecoveryResponse?.LabelResults ||
      data?.labelRecoveryResponse?.labelResults ||
      data?.LabelResults ||
      data?.labelResults ||
      undefined;

    const labelImage = labelResults?.LabelImage || labelResults?.labelImage || {};
    const pdfBase64 =
      labelImage?.GraphicImage ||
      labelImage?.graphicImage ||
      labelImage?.InternationalSignatureGraphicImage ||
      labelImage?.internationalSignatureGraphicImage ||
      labelImage?.HTMLImage ||
      labelImage?.htmlImage ||
      "";

    return {
      pdfBase64: String(pdfBase64 || ""),
      raw: data,
    };
  }

  async tracking(input: TrackingRequest): Promise<TrackingResult> {
    const path = `${this.config.trackingPath}/${encodeURIComponent(input.tracking)}`;
    const data = await this.requestJson("GET", path, undefined, {
      locale: this.config.trackingLocale,
      returnSignature: this.config.trackingReturnSignature ? "true" : "false",
    });

    const shipment =
      data?.trackResponse?.shipment?.[0] ||
      data?.trackResponse?.shipment ||
      data?.TrackResponse?.Shipment?.[0] ||
      data?.TrackResponse?.Shipment ||
      undefined;

    const pkg = shipment?.package?.[0] || shipment?.package || shipment?.Package?.[0] || shipment?.Package;
    const activity = pkg?.activity || pkg?.Activity || [];
    const lastActivity = Array.isArray(activity) ? activity[0] : activity;

    const statusText =
      lastActivity?.status?.description ||
      lastActivity?.status?.type ||
      lastActivity?.status?.code ||
      shipment?.currentStatus?.description ||
      shipment?.CurrentStatus?.Description ||
      "";

    const lastUpdate = this.formatUpsDateTime(lastActivity?.date || lastActivity?.Date, lastActivity?.time || lastActivity?.Time);

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
      XAVRequest: {
        AddressKeyFormat: {
          ConsigneeName: addr.name || undefined,
          AddressLine: [addr.line1],
          PoliticalDivision2: addr.city || undefined,
          PoliticalDivision1: addr.region || undefined,
          PostcodePrimaryLow: addr.postalCode || undefined,
          CountryCode: addr.country,
        },
      },
    };

    const path = this.config.addressValidationPath || this.buildAddressValidationPath();
    const data = await this.requestJson("POST", path, payload);

    const xav = data?.XAVResponse || data?.xavResponse || data;
    const candidate = xav?.Candidate || xav?.candidate || [];
    const first = Array.isArray(candidate) ? candidate[0] : candidate;
    const keyFormat = first?.AddressKeyFormat || first?.addressKeyFormat || {};

    const addressLine = Array.isArray(keyFormat?.AddressLine)
      ? keyFormat.AddressLine[0]
      : keyFormat?.AddressLine;

    const postal = [
      keyFormat?.PostcodePrimaryLow || keyFormat?.postcodePrimaryLow,
      keyFormat?.PostcodeExtendedLow || keyFormat?.postcodeExtendedLow,
    ]
      .filter(Boolean)
      .join("-");

    const valid = Boolean(xav?.ValidAddressIndicator || xav?.validAddressIndicator || first);

    return {
      valid,
      normalized: valid
        ? {
            name: addr.name,
            phone: addr.phone,
            line1: addressLine || addr.line1,
            city: keyFormat?.PoliticalDivision2 || keyFormat?.politicalDivision2 || addr.city,
            region: keyFormat?.PoliticalDivision1 || keyFormat?.politicalDivision1 || addr.region,
            postalCode: postal || addr.postalCode,
            country: keyFormat?.CountryCode || keyFormat?.countryCode || addr.country,
          }
        : undefined,
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
    const shipperNumber = this.requireShipperNumber();
    const packages = this.mapPackages(shipment.parcels);
    const service = this.mapService();

    return {
      RateRequest: {
        Request: {
          TransactionReference: {
            CustomerContext: "Rate",
          },
        },
        Shipment: {
          Shipper: this.mapShipper(shipment.from, shipperNumber),
          ShipTo: this.mapParty(shipment.to),
          ShipFrom: this.mapParty(shipment.from),
          Service: service?.Code ? service : undefined,
          Package: packages,
          PaymentDetails: {
            ShipmentCharge: {
              Type: this.config.paymentTypeCode,
              BillShipper: {
                AccountNumber: shipperNumber,
              },
            },
          },
        },
      },
    };
  }

  private buildShipmentRequest(shipment: Shipment, serviceCode?: string): any {
    const shipperNumber = this.requireShipperNumber();
    const packages = this.mapPackages(shipment.parcels);
    const service = { Code: serviceCode || this.config.serviceCode || undefined };

    return {
      ShipmentRequest: {
        Request: {
          SubVersion: this.config.subVersion,
          RequestOption: this.config.requestOption,
          TransactionReference: {
            CustomerContext: "Ship",
          },
        },
        Shipment: {
          Description: shipment.description || "",
          Shipper: this.mapShipper(shipment.from, shipperNumber),
          ShipTo: this.mapParty(shipment.to),
          ShipFrom: this.mapParty(shipment.from),
          Service: service.Code ? service : undefined,
          PaymentInformation: {
            ShipmentCharge: {
              Type: this.config.paymentTypeCode,
              BillShipper: {
                AccountNumber: shipperNumber,
              },
            },
          },
          Package: packages,
        },
        LabelSpecification: {
          LabelImageFormat: { Code: this.config.labelImageFormat },
          HTTPUserAgent: this.config.labelUserAgent,
        },
      },
    };
  }

  private buildLabelRecoveryRequest(tracking: string): any {
    const shipperNumber = this.requireShipperNumber();
    return {
      LabelRecoveryRequest: {
        LabelSpecification: {
          LabelImageFormat: { Code: this.config.labelImageFormat },
          HTTPUserAgent: this.config.labelUserAgent,
        },
        Translate: {
          Code: this.config.translateCode,
          LanguageCode: this.config.translateLanguage,
          DialectCode: this.config.translateDialect,
        },
        TrackingNumber: tracking,
        ShipperNumber: shipperNumber,
        SubVersion: this.config.labelSubVersion,
      },
    };
  }

  private mapShipper(address: Address, shipperNumber: string): any {
    return {
      Name: address.name || "Shipper",
      ShipperNumber: shipperNumber,
      Address: this.mapAddress(address),
    };
  }

  private mapParty(address: Address): any {
    return {
      Name: address.name || "",
      AttentionName: address.name || undefined,
      Phone: address.phone ? { Number: address.phone } : undefined,
      Address: this.mapAddress(address),
    };
  }

  private mapService(): any {
    return { Code: this.config.serviceCode || undefined };
  }

  private mapPackages(parcels: Parcel[]): any[] {
    if (!parcels || parcels.length === 0) {
      return [this.buildPackage({ weightKg: 0.5 })];
    }

    return parcels.map((parcel) => this.buildPackage(parcel));
  }

  private buildPackage(parcel: Parcel): any {
    const pack: any = {
      PackagingType: { Code: this.config.packagingCode },
      PackageWeight: {
        UnitOfMeasurement: { Code: this.config.weightUnit },
        Weight: this.normalizeWeight(parcel.weightKg),
      },
    };

    if (this.hasDimensions(parcel)) {
      pack.Dimensions = {
        UnitOfMeasurement: { Code: this.config.dimensionUnit },
        Length: this.normalizeDim(parcel.lengthCm),
        Width: this.normalizeDim(parcel.widthCm),
        Height: this.normalizeDim(parcel.heightCm),
      };
    }

    return pack;
  }

  private mapAddress(address: Address): any {
    return {
      AddressLine: [address.line1],
      City: address.city,
      StateProvinceCode: address.region,
      PostalCode: address.postalCode,
      CountryCode: address.country,
    };
  }

  private normalizeWeight(weightKg: number | undefined): string {
    const weight = Number(weightKg || 0.1);
    if (this.config.weightUnit === "LBS") {
      const lb = weight * 2.20462;
      return Math.max(0.1, Number(lb.toFixed(3))).toString();
    }
    return Math.max(0.1, Number(weight.toFixed(3))).toString();
  }

  private normalizeDim(value: number | undefined): string {
    const num = Number(value || 1);
    if (this.config.dimensionUnit === "IN") {
      const inches = num / 2.54;
      return Math.max(1, Math.round(inches)).toString();
    }
    return Math.max(1, Math.round(num)).toString();
  }

  private hasDimensions(parcel: Parcel): boolean {
    return (
      parcel.lengthCm !== undefined &&
      parcel.widthCm !== undefined &&
      parcel.heightCm !== undefined
    );
  }

  private requireShipperNumber(): string {
    const shipperNumber = this.config.shipperNumber;
    if (!shipperNumber) {
      throw new Error("UPS shipperNumber is required");
    }
    return shipperNumber;
  }

  private buildRatingPath(): string {
    const version = this.config.ratingVersion;
    const option = this.config.ratingRequestOption;
    let path = `/api/rating/${version}/${option}`;
    if (this.config.ratingAdditionalInfo) {
      path += `?additionalinfo=${encodeURIComponent(this.config.ratingAdditionalInfo)}`;
    }
    return path;
  }

  private buildShipPath(): string {
    return `/api/shipments/${this.config.shippingVersion}/ship`;
  }

  private buildLabelRecoveryPath(): string {
    return `/api/labels/${this.config.labelRecoveryVersion}/recovery`;
  }

  private buildAddressValidationPath(): string {
    return `/api/addressvalidation/${this.config.addressValidationVersion}/${this.config.addressValidationRequestOption}`;
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.token.expiresAt) {
      return this.token.value;
    }

    const clientId = this.config.clientId;
    const clientSecret = this.config.clientSecret;

    if (!clientId || !clientSecret) {
      throw new Error("UPS client credentials are required");
    }

    const base = this.config.baseUrl.replace(/\/$/, "");
    const url = base + this.config.oauthPath;

    const credentials = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
    const body = new URLSearchParams({
      grant_type: "client_credentials",
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    const data = await this.readResponsePayload(response);
    if (!response.ok) {
      const detail = typeof data === "string" ? data : this.formatErrorPayload(data);
      throw new Error(`UPS OAuth error: ${response.status} ${detail}`);
    }

    if (!data || typeof data !== "object") {
      throw new Error("UPS OAuth: empty response payload");
    }

    const token = String(data?.access_token || "");
    const expiresIn = Number(data?.expires_in || 3600);
    const skew = Number.isFinite(this.config.tokenSkewSeconds)
      ? this.config.tokenSkewSeconds
      : 60;
    const expiresAt = now + Math.max(0, expiresIn - skew) * 1000;

    if (!token) {
      throw new Error("UPS OAuth: empty access_token");
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
      transId: this.config.transactionId || this.generateTransId(),
      transactionSrc: this.config.transactionSrc,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });

    const payload = await this.readResponsePayload(response);
    if (!response.ok) {
      const detail = typeof payload === "string" ? payload : this.formatErrorPayload(payload);
      throw new Error(`UPS API error: ${response.status} ${detail}`);
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

  private generateTransId(): string {
    const random = Math.random().toString(36).slice(2, 10);
    return `${Date.now().toString(36)}${random}`.slice(0, 32);
  }

  private normalizeStatus(value?: string): ShipmentStatus {
    const text = (value || "").toLowerCase();
    if (text.includes("deliver")) return "delivered";
    if (text.includes("exception") || text.includes("fail") || text.includes("problem")) {
      return "problem";
    }
    if (text.includes("label") || text.includes("created") || text.includes("ready")) {
      return "ready";
    }
    return "in_transit";
  }

  private formatUpsDateTime(date?: string, time?: string): string | undefined {
    if (!date) return undefined;
    const cleanDate = String(date).trim();
    if (cleanDate.length !== 8) return undefined;
    const y = cleanDate.slice(0, 4);
    const m = cleanDate.slice(4, 6);
    const d = cleanDate.slice(6, 8);
    if (!time) return `${y}-${m}-${d}`;
    const cleanTime = String(time).padStart(6, "0");
    const hh = cleanTime.slice(0, 2);
    const mm = cleanTime.slice(2, 4);
    const ss = cleanTime.slice(4, 6);
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
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

    const errors =
      payload.errors ||
      payload.response?.errors ||
      payload.Response?.Errors ||
      payload.Fault?.detail?.Errors;

    if (Array.isArray(errors) && errors.length > 0) {
      return errors
        .map((err) => {
          const code = err.code || err.ErrorCode || "UNKNOWN";
          const message = err.message || err.ErrorDescription || err.description || "";
          return [code, message].filter(Boolean).join(" ");
        })
        .join("; ");
    }

    if (errors && typeof errors === "object") {
      const code = errors.code || errors.ErrorCode || "UNKNOWN";
      const message = errors.message || errors.ErrorDescription || errors.description || "";
      return [code, message].filter(Boolean).join(" ");
    }

    if (payload.message) return String(payload.message);
    if (payload.description) return String(payload.description);

    try {
      return JSON.stringify(payload);
    } catch {
      return String(payload);
    }
  }
}
