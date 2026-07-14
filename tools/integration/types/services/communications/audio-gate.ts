export type PhoneNumberId = string;
export type ISODateString = string;

// Discriminator for entities living in the single phone-numbers store:
//   ip-telephony — number wired to the SIP / resonus gateway (has gateway config)
//   external     — uncontrolled number kept here for reference only (no gateway link)
export type PhoneNumberKind = "ip-telephony" | "external";

export type IpTelephonyGateway = {
  provider?: string;
  sipUri?: string;
  username?: string;
  realm?: string;
  registrar?: string;
  // Call context (CallContextName) resonus must load for inbound
  // calls on this number. The context carries the language. No contextId (or no
  // such context) => the gate refuses the call rather than answering blind.
  contextId?: string;
  // Human transfer: inbound calls on this number are bridged to another human
  // over the provider SIP trunk instead of the LLM. Takes precedence over
  // contextId. The gate records both legs and transcribes each channel
  // separately (OpenAI transcription sessions, Opus kept end to end).
  transfer?: IpTelephonyTransfer;
};

export type IpTelephonyTransfer = {
  // Leg B target, e.g. sip:+15551234567@sip.telnyx.com
  sipUri: string;
  // Optional transcription language hint (ISO 639-1); omitted => auto-detect.
  language?: string;
};

export type PhoneNumber = {
  id: PhoneNumberId;
  kind: PhoneNumberKind;
  phone: string;
  label?: string;
  enabled: boolean;
  // Number surfaced publicly (e.g. landing header). At most one stays primary.
  primary?: boolean;
  // Only meaningful for kind === "ip-telephony".
  gateway?: IpTelephonyGateway;
  note?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type PhoneNumberInput = {
  kind: PhoneNumberKind;
  phone: string;
  label?: string;
  enabled?: boolean;
  primary?: boolean;
  gateway?: IpTelephonyGateway;
  note?: string;
};

export type PhoneNumberUpdate = Partial<PhoneNumberInput>;

export type PhoneNumberListParams = {
  offset?: number;
  limit?: number;
  kind?: PhoneNumberKind;
  enabledOnly?: boolean;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

// Resonus runtime config — the resonus container reads/writes this
// store (LLM_GATE_TRANSPORT_STORE=llm-gate-configs in namespace audio-gate-ms).
// The store MUST be created here (gate only reads/writes, never creates it).
export type LlmGateConfigId = string;

export type LlmGateConfig = {
  id: LlmGateConfigId;
  config: Record<string, any>;
};

export type LlmGateConfigInput = {
  id: LlmGateConfigId;
  config: Record<string, any>;
};

export interface AudioGateService {
  // Phone numbers (ip-telephony + external) — one store, discriminated by kind.
  savePhoneNumber(input: PhoneNumberInput): Promise<PhoneNumberId>;
  updatePhoneNumber(id: PhoneNumberId, patch: PhoneNumberUpdate): Promise<void>;
  getPhoneNumber(id: PhoneNumberId): Promise<PhoneNumber | undefined>;
  deletePhoneNumber(id: PhoneNumberId): Promise<boolean>;
  listPhoneNumbers(params: PhoneNumberListParams): Promise<PaginatedResult<PhoneNumber>>;
  // Primary public number: first enabled primary, else first enabled.
  getPrimaryPhoneNumber(): Promise<PhoneNumber | undefined>;

  // LLM gate runtime configs (store owned here, read by the gate container).
  saveLlmGateConfig(input: LlmGateConfigInput): Promise<LlmGateConfigId>;
  getLlmGateConfig(id: LlmGateConfigId): Promise<LlmGateConfig | undefined>;
  listLlmGateConfigs(): Promise<LlmGateConfig[]>;
  deleteLlmGateConfig(id: LlmGateConfigId): Promise<boolean>;
}
