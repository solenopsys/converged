import crypto from "node:crypto";
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
  ISODateString,
} from "./types";

export type SfExpressConfig = {
  baseUrl?: string;
  sandboxUrl?: string;
  prodUrl?: string;
  env?: "sandbox" | "prod";
  partnerId?: string;
  checkword?: string;
  accessToken?: string;
  language?: string;
  requestIdPrefix?: string;
  serviceCreate?: string;
  serviceTrack?: string;
  serviceLabel?: string;
  serviceQuote?: string;
  trackingType?: string;
  trackingMethodType?: string;
  checkPhoneNo?: string;
  expressTypeId?: number;
  payMethod?: number;
  monthlyCard?: string;
  orderIdPrefix?: string;
  labelTemplateCode?: string;
  labelVersion?: string;
  labelSync?: boolean;
  labelFileType?: string;
  labelPrintType?: string;
  timeoutMs?: number;
};

const DEFAULT_CONFIG: Required<Omit<SfExpressConfig, "partnerId" | "checkword" | "accessToken" | "monthlyCard" | "labelTemplateCode">> & {
  partnerId?: string;
  checkword?: string;
  accessToken?: string;
  monthlyCard?: string;
  labelTemplateCode?: string;
} = {
  baseUrl: process.env.SF_EXPRESS_BASE_URL || "",
  sandboxUrl: process.env.SF_EXPRESS_SANDBOX_URL || "https://sfapi-sbox.sf-express.com/std/service",
  prodUrl: process.env.SF_EXPRESS_PROD_URL || "https://sfapi.sf-express.com/std/service",
  env: (process.env.SF_EXPRESS_ENV as any) || "sandbox",
  partnerId: process.env.SF_EXPRESS_PARTNER_ID || "",
  checkword: process.env.SF_EXPRESS_CHECKWORD || "",
  accessToken: process.env.SF_EXPRESS_ACCESS_TOKEN || "",
  language: process.env.SF_EXPRESS_LANGUAGE || "0",
  requestIdPrefix: process.env.SF_EXPRESS_REQUEST_PREFIX || "REQ",
  serviceCreate: process.env.SF_EXPRESS_SERVICE_CREATE || "EXP_RECE_CREATE_ORDER",
  serviceTrack: process.env.SF_EXPRESS_SERVICE_TRACK || "EXP_RECE_SEARCH_ROUTES",
  serviceLabel: process.env.SF_EXPRESS_SERVICE_LABEL || "COM_RECE_CLOUD_PRINT_WAYBILLS",
  serviceQuote: process.env.SF_EXPRESS_SERVICE_QUOTE || "",
  trackingType: process.env.SF_EXPRESS_TRACKING_TYPE || "1",
  trackingMethodType: process.env.SF_EXPRESS_TRACKING_METHOD || "1",
  checkPhoneNo: process.env.SF_EXPRESS_CHECK_PHONE || "",
  expressTypeId: Number(process.env.SF_EXPRESS_EXPRESS_TYPE || 1),
  payMethod: Number(process.env.SF_EXPRESS_PAY_METHOD || 1),
  monthlyCard: process.env.SF_EXPRESS_MONTHLY_CARD || "",
  orderIdPrefix: process.env.SF_EXPRESS_ORDER_PREFIX || "ORD",
  labelTemplateCode: process.env.SF_EXPRESS_LABEL_TEMPLATE || "",
  labelVersion: process.env.SF_EXPRESS_LABEL_VERSION || "2.0",
  labelSync: (process.env.SF_EXPRESS_LABEL_SYNC || "true").toLowerCase() === "true",
  labelFileType: process.env.SF_EXPRESS_LABEL_FILE_TYPE || "PDF",
  labelPrintType: process.env.SF_EXPRESS_LABEL_PRINT_TYPE || "1",
  timeoutMs: Number(process.env.SF_EXPRESS_TIMEOUT_MS || 15000),
};

type SfResponse = {
  apiResultCode?: string;
  apiErrorCode?: string;
  apiErrorMsg?: string;
  apiResultData?: any;
};

type SfResultData = {
  success?: boolean;
  errorCode?: string;
  errorMsg?: string;
  msgData?: any;
};

export class SfExpressProviderService implements ShipmentProviderService {
  private config: Required<SfExpressConfig>;

  constructor(config: SfExpressConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as Required<SfExpressConfig>;
  }

  async quote(input: QuoteRequest): Promise<QuoteResult> {
    if (!this.config.serviceQuote) {
      throw new Error("SF Express quote service is not configured");
    }

    const payload = this.buildQuotePayload(input.shipment);
    const data = await this.callService(this.config.serviceQuote, payload);
    const msg = data.msgData || data;

    const price =
      this.pickNumber(msg, ["totalFee", "fee", "price", "totalCharge"], 0) ?? 0;
    const currency =
      this.pickString(msg, ["currency", "currencyCode"], "") || "";
    const etaDays = this.pickNumber(msg, ["deliveryDays", "eta", "promiseDays"], undefined);

    return {
      price,
      currency,
      etaDays,
      raw: data,
    };
  }

  async createShipment(
    input: CreateShipmentRequest,
  ): Promise<CreateShipmentResult> {
    const payload = this.buildCreatePayload(input.shipment, input.serviceCode);
    const data = await this.callService(this.config.serviceCreate, payload);
    const msg = data.msgData || data;

    const tracking = this.extractWaybillNo(msg);
    if (!tracking) {
      throw new Error("SF Express createShipment: tracking number not found");
    }

    return {
      tracking,
      providerRef: msg?.orderId || msg?.order_id || undefined,
      raw: data,
    };
  }

  async label(input: LabelRequest): Promise<LabelResult> {
    const payload = this.buildLabelPayload(input.tracking);
    const data = await this.callService(this.config.serviceLabel, payload);
    const msg = data.msgData || data;

    const label = this.extractLabelData(msg);
    if (!label) {
      throw new Error("SF Express label: label data not found");
    }

    if (label.base64) {
      return { pdfBase64: label.base64, raw: data };
    }

    if (label.url) {
      const pdfBase64 = await this.fetchUrlAsBase64(label.url);
      return { pdfBase64, raw: data };
    }

    throw new Error("SF Express label: unsupported label response");
  }

  async tracking(input: TrackingRequest): Promise<TrackingResult> {
    const payload = this.buildTrackingPayload(input.tracking);
    const data = await this.callService(this.config.serviceTrack, payload);
    const msg = data.msgData || data;

    const routes = this.extractRoutes(msg);
    if (routes.length === 0) {
      return { status: "problem", raw: data };
    }

    const latest = routes[0];
    return {
      status: this.normalizeStatus(latest.status),
      lastUpdate: latest.time,
      raw: data,
    };
  }

  async webhook(_input: WebhookRequest): Promise<void> {
    return;
  }

  async validateAddress(
    _input: AddressValidationRequest,
  ): Promise<AddressValidationResult> {
    throw new Error("SF Express provider does not support address validation");
  }

  async customsLookup(
    input: CustomsLookupRequest,
  ): Promise<CustomsLookupResult> {
    return { items: input.items, raw: { unsupported: true } };
  }

  private async callService(serviceCode: string, msgData: any): Promise<SfResultData> {
    const timestamp = String(Date.now());
    const requestId = this.buildRequestId();
    const msgDataText = JSON.stringify(msgData ?? {});
    const msgDigest = this.buildMsgDigest(msgDataText, timestamp);

    const body = new URLSearchParams({
      partnerID: this.requirePartnerId(),
      requestID: requestId,
      serviceCode,
      timestamp,
      msgData: msgDataText,
      msgDigest,
    });

    if (this.config.accessToken) {
      body.append("accessToken", this.config.accessToken);
    }

    const response = await this.fetchWithTimeout(this.getBaseUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    const payloadText = await response.text();
    if (!response.ok) {
      throw new Error(`SF Express API error: ${response.status} ${payloadText}`);
    }

    const payload = this.safeJsonParse(payloadText) as SfResponse;
    const resultData = this.parseApiResultData(payload);

    const success =
      resultData.success === true || payload?.apiResultCode === "A1000";

    if (!success) {
      const err =
        resultData.errorMsg ||
        payload?.apiErrorMsg ||
        payload?.apiErrorCode ||
        resultData.errorCode ||
        "Unknown error";
      throw new Error(`SF Express API error: ${err}`);
    }

    return resultData;
  }

  private buildQuotePayload(shipment: Shipment): any {
    const payload: any = this.buildBaseShipmentPayload(shipment);
    payload.language = this.config.language;
    return payload;
  }

  private buildCreatePayload(shipment: Shipment, serviceCode?: string): any {
    const payload: any = this.buildBaseShipmentPayload(shipment);
    payload.orderId = this.buildOrderId();
    payload.language = this.config.language;
    if (serviceCode) {
      payload.expressTypeId = this.mapExpressType(serviceCode);
    }
    return payload;
  }

  private buildTrackingPayload(tracking: string): any {
    const payload: any = {
      language: this.config.language,
      trackingType: this.config.trackingType,
      trackingNumber: [tracking],
      methodType: this.config.trackingMethodType,
    };

    if (this.config.checkPhoneNo) {
      payload.checkPhoneNo = this.config.checkPhoneNo;
    }

    return payload;
  }

  private buildLabelPayload(tracking: string): any {
    if (!this.config.labelTemplateCode) {
      throw new Error("SF Express labelTemplateCode is required for label printing");
    }

    return {
      sync: this.config.labelSync,
      templateCode: this.config.labelTemplateCode,
      version: this.config.labelVersion,
      fileType: this.config.labelFileType,
      printType: this.config.labelPrintType,
      documents: [{ masterWaybillNo: tracking }],
      waybillNoInfoList: [{ waybillNo: tracking, waybillType: 1 }],
    };
  }

  private buildBaseShipmentPayload(shipment: Shipment): any {
    const parcels = shipment.parcels || [];
    const totalWeight = this.sumWeight(parcels);
    const parcelQty = Math.max(parcels.length, 1);

    const payload: any = {
      expressTypeId: this.config.expressTypeId,
      payMethod: this.config.payMethod,
      monthlyCard: this.config.monthlyCard || undefined,
      parcelQty,
      totalWeight,
      contactInfoList: [
        this.mapContact(shipment.from, 1),
        this.mapContact(shipment.to, 2),
      ],
    };

    const cargoName =
      shipment.description || shipment.items?.[0]?.name || "Goods";
    payload.cargo = { name: cargoName };

    if (shipment.items && shipment.items.length > 0) {
      payload.cargoDetails = shipment.items.map((item) => ({
        name: item.name,
        count: item.qty,
        unit: "piece",
        amount: item.price,
        currency: item.currency || shipment.currency,
        sourceArea: item.originCountry,
        productDesc: item.name,
      }));
    }

    return payload;
  }

  private mapContact(address: Address, contactType: number): any {
    return {
      contactType,
      country: address.country,
      province: address.region,
      city: address.city,
      address: address.line1,
      contact: address.name || "",
      company: address.name || "",
      mobile: address.phone || "",
      tel: address.phone || "",
      postCode: address.postalCode || "",
    };
  }

  private mapExpressType(serviceCode: string): number {
    const numeric = Number(serviceCode);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    return this.config.expressTypeId;
  }

  private extractWaybillNo(msg: any): string {
    const list = msg?.waybillNoInfoList || msg?.waybillNoList || msg?.waybillNoInfos;
    const first = Array.isArray(list) ? list[0] : list;
    const value =
      first?.waybillNo ||
      first?.mailNo ||
      msg?.waybillNo ||
      msg?.mailNo ||
      msg?.waybill;
    return value ? String(value) : "";
  }

  private extractRoutes(msg: any): { time?: ISODateString; status?: string }[] {
    const routeResps = msg?.routeResps || msg?.routeResp || msg?.RouteResponse;
    const first = Array.isArray(routeResps) ? routeResps[0] : routeResps;
    const routes = first?.routes || first?.Route || first?.route || [];
    const list = Array.isArray(routes) ? routes : [routes];

    const normalized = list
      .map((route: any) => {
        const timeText = route?.acceptTime || route?.accept_time || route?.acceptDate;
        const status = route?.remark || route?.opcode || route?.desc || route?.status;
        const time = this.parseDate(timeText);
        return { time, status };
      })
      .filter((item) => item.time || item.status);

    return normalized.sort((a, b) => (b.time || "").localeCompare(a.time || ""));
  }

  private extractLabelData(msg: any): { base64?: string; url?: string } | null {
    const doc =
      msg?.documents?.[0] ||
      msg?.document ||
      msg?.files?.[0] ||
      msg?.file ||
      msg;

    const base64 =
      doc?.pdfBase64 ||
      doc?.imageBase64 ||
      doc?.content ||
      doc?.label ||
      undefined;

    if (base64) {
      return { base64: String(base64) };
    }

    const url =
      doc?.url ||
      doc?.fileUrl ||
      doc?.pdfUrl ||
      doc?.labelUrl ||
      doc?.printUrl ||
      undefined;

    if (url) {
      return { url: String(url) };
    }

    return null;
  }

  private async fetchUrlAsBase64(url: string): Promise<string> {
    const response = await this.fetchWithTimeout(url, { method: "GET" });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SF Express label download error: ${response.status} ${text}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString("base64");
  }

  private parseApiResultData(payload: SfResponse): SfResultData {
    if (!payload) return {};
    let apiResultData = payload.apiResultData;

    if (typeof apiResultData === "string") {
      apiResultData = this.safeJsonParse(apiResultData);
    }

    if (!apiResultData) {
      return {
        success: payload.apiResultCode === "A1000",
        errorCode: payload.apiErrorCode,
        errorMsg: payload.apiErrorMsg,
      };
    }

    let msgData = (apiResultData as any).msgData;
    if (typeof msgData === "string") {
      msgData = this.safeJsonParse(msgData);
    }

    return {
      ...apiResultData,
      msgData,
    } as SfResultData;
  }

  private buildMsgDigest(msgDataText: string, timestamp: string): string {
    const raw = `${msgDataText}${timestamp}${this.requireCheckword()}`;
    return crypto.createHash("md5").update(raw, "utf8").digest("base64");
  }

  private buildOrderId(): string {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${this.config.orderIdPrefix}${Date.now().toString(36)}${rand}`.toUpperCase();
  }

  private buildRequestId(): string {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${this.config.requestIdPrefix}${Date.now().toString(36)}${rand}`.toUpperCase();
  }

  private getBaseUrl(): string {
    if (this.config.baseUrl) return this.config.baseUrl;
    return this.config.env === "prod" ? this.config.prodUrl : this.config.sandboxUrl;
  }

  private requirePartnerId(): string {
    if (!this.config.partnerId) {
      throw new Error("SF Express partnerId is required");
    }
    return this.config.partnerId;
  }

  private requireCheckword(): string {
    if (!this.config.checkword) {
      throw new Error("SF Express checkword is required");
    }
    return this.config.checkword;
  }

  private sumWeight(parcels: Parcel[]): number {
    if (!parcels || parcels.length === 0) return 0.1;
    const total = parcels.reduce((sum, parcel) => sum + (parcel.weightKg || 0), 0);
    return Math.max(0.1, Number(total.toFixed(3)));
  }

  private parseDate(value?: string): ISODateString | undefined {
    if (!value) return undefined;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return undefined;
    return new Date(parsed).toISOString();
  }

  private normalizeStatus(value?: string): ShipmentStatus {
    const text = (value || "").toLowerCase();
    if (text.includes("deliver") || text.includes("signed")) return "delivered";
    if (text.includes("exception") || text.includes("fail") || text.includes("problem")) {
      return "problem";
    }
    if (text.includes("order") || text.includes("pickup") || text.includes("accept")) {
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

  private safeJsonParse(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }
}
