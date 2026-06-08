export type PhoneNumberId = string;
export type ISODateString = string;

// Discriminator for entities living in the single phone-numbers store:
//   ip-telephony — number wired to the SIP / LLM audio gateway (has gateway config)
//   external     — uncontrolled number kept here for reference only (no gateway link)
export type PhoneNumberKind = "ip-telephony" | "external";

export type IpTelephonyGateway = {
  provider?: string;
  sipUri?: string;
  username?: string;
  realm?: string;
  registrar?: string;
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

export interface AudioGateService {
  // Phone numbers (ip-telephony + external) — one store, discriminated by kind.
  savePhoneNumber(input: PhoneNumberInput): Promise<PhoneNumberId>;
  updatePhoneNumber(id: PhoneNumberId, patch: PhoneNumberUpdate): Promise<void>;
  getPhoneNumber(id: PhoneNumberId): Promise<PhoneNumber | undefined>;
  deletePhoneNumber(id: PhoneNumberId): Promise<boolean>;
  listPhoneNumbers(params: PhoneNumberListParams): Promise<PaginatedResult<PhoneNumber>>;
  // Primary public number: first enabled primary, else first enabled.
  getPrimaryPhoneNumber(): Promise<PhoneNumber | undefined>;
}
