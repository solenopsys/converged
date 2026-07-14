// Auto-generated package
import {
	createHttpClient,
	type ClientConfig,
	type ServiceMetadata,
} from "nrpc";

export type PhoneNumberId = string;

export type ISODateString = string;

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

export type LlmGateConfigId = string;

export type ResonusLlmProvider = "openai" | "gemini" | "openai-compatible";

export type ResonusLlmProviderConfig = {
	provider: ResonusLlmProvider;
	// Regional or private provider endpoint selected by the tenant.
	endpoint: string;
	model: string;
	voice?: string;
	transcriptionModel?: string;
	// Secret material stays in ms-secrets; this record stores only its key.
	secretRef?: string;
	enabled?: boolean;
	priority?: number;
	parameters?: Record<string, unknown>;
};

export type LlmGateConfig = {
	id: LlmGateConfigId;
	config: ResonusLlmProviderConfig;
};

export type LlmGateConfigInput = {
	id: LlmGateConfigId;
	config: ResonusLlmProviderConfig;
};

export const metadata: ServiceMetadata = {
	interfaceName: "ResonusService",
	serviceName: "resonus",
	filePath: "services/communications/resonus.ts",
	methods: [
		{
			name: "savePhoneNumber",
			parameters: [
				{
					name: "input",
					type: "PhoneNumberInput",
					optional: false,
					isArray: false,
				},
			],
			returnType: "PhoneNumberId",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "updatePhoneNumber",
			parameters: [
				{
					name: "id",
					type: "PhoneNumberId",
					optional: false,
					isArray: false,
				},
				{
					name: "patch",
					type: "PhoneNumberUpdate",
					optional: false,
					isArray: false,
				},
			],
			returnType: "void",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "getPhoneNumber",
			parameters: [
				{
					name: "id",
					type: "PhoneNumberId",
					optional: false,
					isArray: false,
				},
			],
			returnType: "PhoneNumber | any",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "deletePhoneNumber",
			parameters: [
				{
					name: "id",
					type: "PhoneNumberId",
					optional: false,
					isArray: false,
				},
			],
			returnType: "boolean",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "listPhoneNumbers",
			parameters: [
				{
					name: "params",
					type: "PhoneNumberListParams",
					optional: false,
					isArray: false,
				},
			],
			returnType: "PaginatedResult<PhoneNumber>",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "getPrimaryPhoneNumber",
			parameters: [],
			returnType: "PhoneNumber | any",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "saveLlmGateConfig",
			parameters: [
				{
					name: "input",
					type: "LlmGateConfigInput",
					optional: false,
					isArray: false,
				},
			],
			returnType: "LlmGateConfigId",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "getLlmGateConfig",
			parameters: [
				{
					name: "id",
					type: "LlmGateConfigId",
					optional: false,
					isArray: false,
				},
			],
			returnType: "LlmGateConfig | any",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "listLlmGateConfigs",
			parameters: [],
			returnType: "LlmGateConfig",
			isAsync: true,
			returnTypeIsArray: true,
			isAsyncIterable: false,
		},
		{
			name: "deleteLlmGateConfig",
			parameters: [
				{
					name: "id",
					type: "LlmGateConfigId",
					optional: false,
					isArray: false,
				},
			],
			returnType: "boolean",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
	],
	types: [
		{
			name: "PhoneNumberId",
			kind: "type",
			definition: "string",
		},
		{
			name: "ISODateString",
			kind: "type",
			definition: "string",
		},
		{
			name: "PhoneNumberKind",
			kind: "type",
			definition: '"ip-telephony" | "external"',
		},
		{
			name: "IpTelephonyGateway",
			kind: "type",
			definition:
				"{\n\tprovider?: string;\n\tsipUri?: string;\n\tusername?: string;\n\trealm?: string;\n\tregistrar?: string;\n\t// Call context (CallContextName) resonus must load for inbound\n\t// calls on this number. The context carries the language. No contextId (or no\n\t// such context) => the gate refuses the call rather than answering blind.\n\tcontextId?: string;\n\t// Human transfer: inbound calls on this number are bridged to another human\n\t// over the provider SIP trunk instead of the LLM. Takes precedence over\n\t// contextId. The gate records both legs and transcribes each channel\n\t// separately (OpenAI transcription sessions, Opus kept end to end).\n\ttransfer?: IpTelephonyTransfer;\n}",
		},
		{
			name: "IpTelephonyTransfer",
			kind: "type",
			definition:
				"{\n\t// Leg B target, e.g. sip:+15551234567@sip.telnyx.com\n\tsipUri: string;\n\t// Optional transcription language hint (ISO 639-1); omitted => auto-detect.\n\tlanguage?: string;\n}",
		},
		{
			name: "PhoneNumber",
			kind: "type",
			definition:
				'{\n\tid: PhoneNumberId;\n\tkind: PhoneNumberKind;\n\tphone: string;\n\tlabel?: string;\n\tenabled: boolean;\n\t// Number surfaced publicly (e.g. landing header). At most one stays primary.\n\tprimary?: boolean;\n\t// Only meaningful for kind === "ip-telephony".\n\tgateway?: IpTelephonyGateway;\n\tnote?: string;\n\tcreatedAt: ISODateString;\n\tupdatedAt: ISODateString;\n}',
		},
		{
			name: "PhoneNumberInput",
			kind: "type",
			definition:
				"{\n\tkind: PhoneNumberKind;\n\tphone: string;\n\tlabel?: string;\n\tenabled?: boolean;\n\tprimary?: boolean;\n\tgateway?: IpTelephonyGateway;\n\tnote?: string;\n}",
		},
		{
			name: "PhoneNumberUpdate",
			kind: "type",
			definition: "Partial<PhoneNumberInput>",
		},
		{
			name: "PhoneNumberListParams",
			kind: "type",
			definition:
				"{\n\toffset?: number;\n\tlimit?: number;\n\tkind?: PhoneNumberKind;\n\tenabledOnly?: boolean;\n}",
		},
		{
			name: "PaginatedResult",
			kind: "type",
			typeParameters: "<T>",
			definition: "{\n\titems: T[];\n\ttotalCount?: number;\n}",
		},
		{
			name: "LlmGateConfigId",
			kind: "type",
			definition: "string",
		},
		{
			name: "ResonusLlmProvider",
			kind: "type",
			definition: '"openai" | "gemini" | "openai-compatible"',
		},
		{
			name: "ResonusLlmProviderConfig",
			kind: "type",
			definition:
				"{\n\tprovider: ResonusLlmProvider;\n\t// Regional or private provider endpoint selected by the tenant.\n\tendpoint: string;\n\tmodel: string;\n\tvoice?: string;\n\ttranscriptionModel?: string;\n\t// Secret material stays in ms-secrets; this record stores only its key.\n\tsecretRef?: string;\n\tenabled?: boolean;\n\tpriority?: number;\n\tparameters?: Record<string, unknown>;\n}",
		},
		{
			name: "LlmGateConfig",
			kind: "type",
			definition:
				"{\n\tid: LlmGateConfigId;\n\tconfig: ResonusLlmProviderConfig;\n}",
		},
		{
			name: "LlmGateConfigInput",
			kind: "type",
			definition:
				"{\n\tid: LlmGateConfigId;\n\tconfig: ResonusLlmProviderConfig;\n}",
		},
	],
};

// Server interface (to be implemented in microservice)
export interface ResonusService {
	savePhoneNumber(input: PhoneNumberInput): Promise<PhoneNumberId>;
	updatePhoneNumber(id: PhoneNumberId, patch: PhoneNumberUpdate): Promise<void>;
	getPhoneNumber(id: PhoneNumberId): Promise<PhoneNumber | any>;
	deletePhoneNumber(id: PhoneNumberId): Promise<boolean>;
	listPhoneNumbers(
		params: PhoneNumberListParams,
	): Promise<PaginatedResult<PhoneNumber>>;
	getPrimaryPhoneNumber(): Promise<PhoneNumber | any>;
	saveLlmGateConfig(input: LlmGateConfigInput): Promise<LlmGateConfigId>;
	getLlmGateConfig(id: LlmGateConfigId): Promise<LlmGateConfig | any>;
	listLlmGateConfigs(): Promise<LlmGateConfig[]>;
	deleteLlmGateConfig(id: LlmGateConfigId): Promise<boolean>;
}

// Client interface
export interface ResonusServiceClient {
	savePhoneNumber(input: PhoneNumberInput): Promise<PhoneNumberId>;
	updatePhoneNumber(id: PhoneNumberId, patch: PhoneNumberUpdate): Promise<void>;
	getPhoneNumber(id: PhoneNumberId): Promise<PhoneNumber | any>;
	deletePhoneNumber(id: PhoneNumberId): Promise<boolean>;
	listPhoneNumbers(
		params: PhoneNumberListParams,
	): Promise<PaginatedResult<PhoneNumber>>;
	getPrimaryPhoneNumber(): Promise<PhoneNumber | any>;
	saveLlmGateConfig(input: LlmGateConfigInput): Promise<LlmGateConfigId>;
	getLlmGateConfig(id: LlmGateConfigId): Promise<LlmGateConfig | any>;
	listLlmGateConfigs(): Promise<LlmGateConfig[]>;
	deleteLlmGateConfig(id: LlmGateConfigId): Promise<boolean>;
}

// Factory function
export function createResonusServiceClient(
	config?: ClientConfig,
): ResonusServiceClient {
	return createHttpClient<ResonusServiceClient>(metadata, config);
}

// Ready-to-use client
export const resonusClient = createResonusServiceClient();
