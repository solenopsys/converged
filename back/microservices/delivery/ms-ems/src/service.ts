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
  ISODateString,
} from "./types";

export type EmsConfig = {
  baseUrl?: string;
  apiKey?: string;
  courierCode?: string;
  autoDetect?: boolean;
  language?: string;
  createPath?: string;
  detectPath?: string;
  getPath?: string;
  timeoutMs?: number;
};

const DEFAULT_CONFIG: Required<Omit<EmsConfig, "apiKey" | "courierCode">> & {
  apiKey?: string;
  courierCode?: string;
} = {
  baseUrl: process.env.EMS_API_BASE || "https://api.trackingmore.com/v4",
  apiKey: process.env.EMS_API_KEY || process.env.TRACKINGMORE_API_KEY || "",
  courierCode: process.env.EMS_COURIER_CODE || "",
  autoDetect: (process.env.EMS_AUTO_DETECT || "true").toLowerCase() === "true",
  language: process.env.EMS_LANGUAGE || "en",
  createPath: process.env.EMS_CREATE_PATH || "/trackings/create",
  detectPath: process.env.EMS_DETECT_PATH || "/couriers/detect",
  getPath: process.env.EMS_GET_PATH || "/trackings/get",
  timeoutMs: Number(process.env.EMS_TIMEOUT_MS || 15000),
};

type RequestResult = {
  ok: boolean;
  status: number;
  payload: any;
};

export class EmsProviderService implements ShipmentProviderService {
  private config: Required<EmsConfig>;

  constructor(config: EmsConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as Required<EmsConfig>;
  }

  async quote(_input: QuoteRequest): Promise<QuoteResult> {
    throw new Error("EMS provider does not support quote");
  }

  async createShipment(
    _input: CreateShipmentRequest,
  ): Promise<CreateShipmentResult> {
    throw new Error("EMS provider does not support shipment creation");
  }

  async label(_input: LabelRequest): Promise<LabelResult> {
    throw new Error("EMS provider does not support label generation");
  }

  async tracking(input: TrackingRequest): Promise<TrackingResult> {
    const courierCode = await this.resolveCourierCode(input.tracking);
    const createPayload: Record<string, any> = {
      tracking_number: input.tracking,
      courier_code: courierCode,
    };

    if (this.config.language) {
      createPayload.language = this.config.language;
    }

    const createResult = await this.requestJson(
      "POST",
      this.config.createPath,
      createPayload,
    );

    let payload = createResult.payload;
    if (!createResult.ok) {
      const metaCode = this.pickNumber(payload?.meta, ["code"], undefined);
      if (metaCode === 4101) {
        payload = await this.getTrackingResult(input.tracking, courierCode);
      } else {
        const detail = this.formatErrorPayload(payload);
        throw new Error(`EMS TrackingMore error: ${createResult.status} ${detail}`);
      }
    }

    const record = Array.isArray(payload?.data)
      ? payload.data[0]
      : payload?.data || payload;

    const statusText =
      record?.delivery_status ||
      record?.status_info?.status ||
      record?.latest_event?.checkpoint_delivery_status ||
      record?.substatus ||
      "";

    const lastUpdate =
      record?.latest_checkpoint_time || this.pickLatestCheckpoint(record);

    return {
      status: this.normalizeStatus(String(statusText || "")),
      lastUpdate: lastUpdate || undefined,
      raw: payload,
    };
  }

  async webhook(_input: WebhookRequest): Promise<void> {
    return;
  }

  async validateAddress(
    _input: AddressValidationRequest,
  ): Promise<AddressValidationResult> {
    throw new Error("EMS provider does not support address validation");
  }

  async customsLookup(
    input: CustomsLookupRequest,
  ): Promise<CustomsLookupResult> {
    return {
      items: input.items,
      raw: { unsupported: true },
    };
  }

  private async resolveCourierCode(tracking: string): Promise<string> {
    if (this.config.courierCode) return this.config.courierCode;
    if (!this.config.autoDetect) {
      throw new Error("EMS courierCode is required when autoDetect is disabled");
    }

    const detectPayload = { tracking_number: tracking };
    const result = await this.requestJson(
      "POST",
      this.config.detectPath,
      detectPayload,
    );

    if (!result.ok) {
      const detail = this.formatErrorPayload(result.payload);
      throw new Error(`EMS detect error: ${result.status} ${detail}`);
    }

    const courier = Array.isArray(result.payload?.data)
      ? result.payload.data[0]
      : result.payload?.data;

    const code = courier?.courier_code || courier?.courierCode;
    if (!code) {
      throw new Error("EMS detect error: courier code not found");
    }

    return String(code);
  }

  private async getTrackingResult(
    tracking: string,
    courierCode: string,
  ): Promise<any> {
    const query = {
      tracking_numbers: tracking,
      courier_code: courierCode,
      lang: this.config.language || undefined,
      pages_amount: 1,
      items_amount: 1,
    } as Record<string, any>;

    const result = await this.requestJson("GET", this.config.getPath, undefined, query);
    if (!result.ok) {
      const detail = this.formatErrorPayload(result.payload);
      throw new Error(`EMS get error: ${result.status} ${detail}`);
    }

    return result.payload;
  }

  private async requestJson(
    method: "GET" | "POST",
    path: string,
    body?: any,
    query?: Record<string, any>,
  ): Promise<RequestResult> {
    const base = this.config.baseUrl.replace(/\/$/, "");
    const url = base + this.normalizePath(path) + this.buildQuery(query);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Tracking-Api-Key": this.requireApiKey(),
        },
        body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
        signal: controller.signal,
      });

      const payload = await this.readResponsePayload(response);
      return { ok: response.ok, status: response.status, payload };
    } finally {
      clearTimeout(timeout);
    }
  }

  private requireApiKey(): string {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error("EMS TrackingMore apiKey is required");
    }
    return apiKey;
  }

  private normalizePath(path: string): string {
    if (!path.startsWith("/")) return `/${path}`;
    return path;
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

  private readResponsePayload(response: Response): Promise<any> {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json().catch(() => ({}));
    }
    return response.text().then((text) => text || {});
  }

  private pickLatestCheckpoint(record: any): ISODateString | undefined {
    const origin = record?.origin_info?.trackinfo || record?.originInfo?.trackinfo || [];
    const destination =
      record?.destination_info?.trackinfo || record?.destinationInfo?.trackinfo || [];

    const all = ([] as any[]).concat(origin, destination);
    if (all.length === 0) return undefined;

    let latest: { date?: string; parsed?: number } | undefined;
    for (const item of all) {
      const dateText = item?.checkpoint_date || item?.Date || item?.date;
      if (!dateText) continue;
      const parsed = Date.parse(dateText);
      if (Number.isNaN(parsed)) continue;
      if (!latest || parsed > (latest.parsed || 0)) {
        latest = { date: new Date(parsed).toISOString(), parsed };
      }
    }

    return latest?.date;
  }

  private normalizeStatus(value?: string): ShipmentStatus {
    const text = (value || "").toLowerCase();
    if (text.includes("deliver")) return "delivered";
    if (text.includes("exception") || text.includes("undelivered") || text.includes("expired")) {
      return "problem";
    }
    if (
      text.includes("notfound") ||
      text.includes("pending") ||
      text.includes("inforeceived") ||
      text.includes("pickup")
    ) {
      return "ready";
    }
    return "in_transit";
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

  private formatErrorPayload(payload: any): string {
    if (!payload) return "";
    if (typeof payload === "string") return payload;

    const meta = payload.meta || payload.Meta;
    const code = meta?.code || meta?.Code;
    const message = meta?.message || meta?.Message;

    if (code || message) {
      return [code, message].filter(Boolean).join(" ");
    }

    const errors = payload.errors || payload.error;
    if (Array.isArray(errors) && errors.length > 0) {
      return errors
        .map((err) => {
          const errCode = err.code || err.ErrorCode || "UNKNOWN";
          const errMessage = err.message || err.ErrorDescription || "";
          return [errCode, errMessage].filter(Boolean).join(" ");
        })
        .join("; ");
    }

    if (errors && typeof errors === "object") {
      const errCode = errors.code || errors.ErrorCode || "UNKNOWN";
      const errMessage = errors.message || errors.ErrorDescription || "";
      return [errCode, errMessage].filter(Boolean).join(" ");
    }

    try {
      return JSON.stringify(payload);
    } catch {
      return String(payload);
    }
  }
}
