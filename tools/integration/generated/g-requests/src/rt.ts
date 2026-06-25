// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type RequestId = string;

export type ISODateString = string;

export type RequestStatus = string;

export type RequestProcessType = | "cnc_machining"
	| "laser_cutting"
	| "plastic_cutting"
	| "3d_printing"
	| "generic";

export type RequestFieldType = | "text"
	| "number"
	| "boolean"
	| "select"
	| "multiselect"
	| "date"
	| "dimension"
	| "tolerance"
	| "surface_finish"
	| "material"
	| "file"
	| "json";

export type RequestFieldValue = any;

export type RequestFieldOption = {
	label: string;
	value: string;
};

export type RequestFieldDefinition = {
	key: string;
	label: string;
	type: RequestFieldType;
	required?: boolean;
	group?: string;
	unit?: string;
	description?: string;
	options?: RequestFieldOption[];
	order?: number;
	source?: string;
};

export type RequestRequirementField = RequestFieldDefinition & {
	aliases?: string[];
	ask?: string;
	extractionHints?: string[];
};

export type RequestRequirementProfile = {
	processType: RequestProcessType;
	title: string;
	description?: string;
	version?: string;
	aliases?: string[];
	fields: RequestRequirementField[];
};

export type RequestRequirementsCatalog = {
	version: string;
	defaultProcessType?: RequestProcessType;
	profiles: RequestRequirementProfile[];
};

export type RequestFieldState = RequestFieldDefinition & {
	value?: RequestFieldValue;
	status: "missing" | "filled" | "needs_review";
	confidence?: number;
	updatedAt?: ISODateString;
};

export type RequestCompletion = {
	required: number;
	filledRequired: number;
	total: number;
	filledTotal: number;
	percent: number;
};

export type RequestModel = {
	id: RequestId;
	source?: string;
	status: RequestStatus;
	processType: RequestProcessType;
	title?: string;
	summary?: string;
	fields: Record<string, RequestFieldState>;
	fieldOrder: string[];
	files: RequestFiles;
	collections?: RequestCollections;
	missingRequired: string[];
	remainingRequired: string[];
	remainingDelta: RequestRequirementField[];
	completion: RequestCompletion;
	createdAt: ISODateString;
	updatedAt: ISODateString;
	revision: number;
};

export type RequestParameterInput = {
	key: string;
	value: RequestFieldValue;
	label?: string;
	type?: RequestFieldType;
	required?: boolean;
	group?: string;
	unit?: string;
	description?: string;
	options?: RequestFieldOption[];
	source?: string;
	confidence?: number;
	order?: number;
};

export type RequestModelInput = {
	source?: string;
	status?: RequestStatus;
	processType?: RequestProcessType;
	title?: string;
	summary?: string;
	fields?: RequestFields;
	parameters?: RequestParameterInput[];
	fieldDefinitions?: RequestFieldDefinition[];
	files?: RequestFiles;
	collections?: RequestCollections;
};

export type RequestModelPatch = {
	source?: string;
	status?: RequestStatus;
	processType?: RequestProcessType;
	title?: string;
	summary?: string;
	fields?: RequestFields;
	parameters?: RequestParameterInput[];
	fieldDefinitions?: RequestFieldDefinition[];
	files?: RequestFiles;
	collections?: RequestCollections;
};

export type RequestFields = Record<string, RequestFieldValue>;

export type RequestFiles = Record<string, string>;

export type RequestCollections = Record<string, string>;

export type Request = {
	id: RequestId;
	source?: string;
	status: RequestStatus;
	fields: RequestFields;
	files: RequestFiles;
	collections?: RequestCollections;
	createdAt: ISODateString;
	updatedAt?: ISODateString;
	model?: RequestModel;
};

export type RequestInput = {
	source?: string;
	status?: RequestStatus;
	processType?: RequestProcessType;
	title?: string;
	summary?: string;
	fields: RequestFields;
	parameters?: RequestParameterInput[];
	fieldDefinitions?: RequestFieldDefinition[];
	files?: RequestFiles;
	collections?: RequestCollections;
};

export type RequestPatch = {
	source?: string;
	status?: RequestStatus;
	processType?: RequestProcessType;
	title?: string;
	summary?: string;
	fields?: RequestFields;
	parameters?: RequestParameterInput[];
	fieldDefinitions?: RequestFieldDefinition[];
	files?: RequestFiles;
	collections?: RequestCollections;
};

export type RequestListParams = {
	offset: number;
	limit: number;
	source?: string;
};

export type RequestDailyPoint = {
	date: string;
	requests: number;
};

export type RequestMetrics = {
	total: number;
	daily: RequestDailyPoint[];
};

export type RequestProcessingEntry = {
	id: string;
	requestId: RequestId;
	status: RequestStatus;
	actor: string;
	comment: string;
	createdAt: ISODateString;
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

const metadata: ServiceMetadata = {
  "interfaceName": "RequestsService",
  "serviceName": "requests",
  "filePath": "services/business/requests.ts",
  "methods": [
    {
      "name": "createRequest",
      "parameters": [
        {
          "name": "input",
          "type": "RequestInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "RequestId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getRequest",
      "parameters": [
        {
          "name": "id",
          "type": "RequestId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Request | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getRequestModel",
      "parameters": [
        {
          "name": "id",
          "type": "RequestId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "RequestModel | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getRequestRequirementProfile",
      "parameters": [
        {
          "name": "processType",
          "type": "RequestProcessType",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "RequestRequirementProfile | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listRequestRequirementProfiles",
      "parameters": [],
      "returnType": "RequestRequirementProfile",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "createRequestModel",
      "parameters": [
        {
          "name": "input",
          "type": "RequestModelInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "RequestModel",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "applyRequestUpdate",
      "parameters": [
        {
          "name": "id",
          "type": "RequestId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "RequestModelPatch",
          "optional": false,
          "isArray": false
        },
        {
          "name": "actor",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "comment",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "RequestModel",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "patchRequest",
      "parameters": [
        {
          "name": "id",
          "type": "RequestId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "RequestPatch",
          "optional": false,
          "isArray": false
        },
        {
          "name": "actor",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "comment",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listRequests",
      "parameters": [
        {
          "name": "params",
          "type": "RequestListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Request>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "updateStatus",
      "parameters": [
        {
          "name": "id",
          "type": "RequestId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "status",
          "type": "RequestStatus",
          "optional": false,
          "isArray": false
        },
        {
          "name": "actor",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "comment",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listProcessing",
      "parameters": [
        {
          "name": "requestId",
          "type": "RequestId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "RequestProcessingEntry",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getRequestMetrics",
      "parameters": [],
      "returnType": "RequestMetrics",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "RequestId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "RequestStatus",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "RequestProcessType",
      "kind": "type",
      "definition": "| \"cnc_machining\"\n\t| \"laser_cutting\"\n\t| \"plastic_cutting\"\n\t| \"3d_printing\"\n\t| \"generic\""
    },
    {
      "name": "RequestFieldType",
      "kind": "type",
      "definition": "| \"text\"\n\t| \"number\"\n\t| \"boolean\"\n\t| \"select\"\n\t| \"multiselect\"\n\t| \"date\"\n\t| \"dimension\"\n\t| \"tolerance\"\n\t| \"surface_finish\"\n\t| \"material\"\n\t| \"file\"\n\t| \"json\""
    },
    {
      "name": "RequestFieldValue",
      "kind": "type",
      "definition": "any"
    },
    {
      "name": "RequestFieldOption",
      "kind": "type",
      "definition": "{\n\tlabel: string;\n\tvalue: string;\n}"
    },
    {
      "name": "RequestFieldDefinition",
      "kind": "type",
      "definition": "{\n\tkey: string;\n\tlabel: string;\n\ttype: RequestFieldType;\n\trequired?: boolean;\n\tgroup?: string;\n\tunit?: string;\n\tdescription?: string;\n\toptions?: RequestFieldOption[];\n\torder?: number;\n\tsource?: string;\n}"
    },
    {
      "name": "RequestRequirementField",
      "kind": "type",
      "definition": "RequestFieldDefinition & {\n\taliases?: string[];\n\task?: string;\n\textractionHints?: string[];\n}"
    },
    {
      "name": "RequestRequirementProfile",
      "kind": "type",
      "definition": "{\n\tprocessType: RequestProcessType;\n\ttitle: string;\n\tdescription?: string;\n\tversion?: string;\n\taliases?: string[];\n\tfields: RequestRequirementField[];\n}"
    },
    {
      "name": "RequestRequirementsCatalog",
      "kind": "type",
      "definition": "{\n\tversion: string;\n\tdefaultProcessType?: RequestProcessType;\n\tprofiles: RequestRequirementProfile[];\n}"
    },
    {
      "name": "RequestFieldState",
      "kind": "type",
      "definition": "RequestFieldDefinition & {\n\tvalue?: RequestFieldValue;\n\tstatus: \"missing\" | \"filled\" | \"needs_review\";\n\tconfidence?: number;\n\tupdatedAt?: ISODateString;\n}"
    },
    {
      "name": "RequestCompletion",
      "kind": "type",
      "definition": "{\n\trequired: number;\n\tfilledRequired: number;\n\ttotal: number;\n\tfilledTotal: number;\n\tpercent: number;\n}"
    },
    {
      "name": "RequestModel",
      "kind": "type",
      "definition": "{\n\tid: RequestId;\n\tsource?: string;\n\tstatus: RequestStatus;\n\tprocessType: RequestProcessType;\n\ttitle?: string;\n\tsummary?: string;\n\tfields: Record<string, RequestFieldState>;\n\tfieldOrder: string[];\n\tfiles: RequestFiles;\n\tcollections?: RequestCollections;\n\tmissingRequired: string[];\n\tremainingRequired: string[];\n\tremainingDelta: RequestRequirementField[];\n\tcompletion: RequestCompletion;\n\tcreatedAt: ISODateString;\n\tupdatedAt: ISODateString;\n\trevision: number;\n}"
    },
    {
      "name": "RequestParameterInput",
      "kind": "type",
      "definition": "{\n\tkey: string;\n\tvalue: RequestFieldValue;\n\tlabel?: string;\n\ttype?: RequestFieldType;\n\trequired?: boolean;\n\tgroup?: string;\n\tunit?: string;\n\tdescription?: string;\n\toptions?: RequestFieldOption[];\n\tsource?: string;\n\tconfidence?: number;\n\torder?: number;\n}"
    },
    {
      "name": "RequestModelInput",
      "kind": "type",
      "definition": "{\n\tsource?: string;\n\tstatus?: RequestStatus;\n\tprocessType?: RequestProcessType;\n\ttitle?: string;\n\tsummary?: string;\n\tfields?: RequestFields;\n\tparameters?: RequestParameterInput[];\n\tfieldDefinitions?: RequestFieldDefinition[];\n\tfiles?: RequestFiles;\n\tcollections?: RequestCollections;\n}"
    },
    {
      "name": "RequestModelPatch",
      "kind": "type",
      "definition": "{\n\tsource?: string;\n\tstatus?: RequestStatus;\n\tprocessType?: RequestProcessType;\n\ttitle?: string;\n\tsummary?: string;\n\tfields?: RequestFields;\n\tparameters?: RequestParameterInput[];\n\tfieldDefinitions?: RequestFieldDefinition[];\n\tfiles?: RequestFiles;\n\tcollections?: RequestCollections;\n}"
    },
    {
      "name": "RequestFields",
      "kind": "type",
      "definition": "Record<string, RequestFieldValue>"
    },
    {
      "name": "RequestFiles",
      "kind": "type",
      "definition": "Record<string, string>"
    },
    {
      "name": "RequestCollections",
      "kind": "type",
      "definition": "Record<string, string>"
    },
    {
      "name": "Request",
      "kind": "type",
      "definition": "{\n\tid: RequestId;\n\tsource?: string;\n\tstatus: RequestStatus;\n\tfields: RequestFields;\n\tfiles: RequestFiles;\n\tcollections?: RequestCollections;\n\tcreatedAt: ISODateString;\n\tupdatedAt?: ISODateString;\n\tmodel?: RequestModel;\n}"
    },
    {
      "name": "RequestInput",
      "kind": "type",
      "definition": "{\n\tsource?: string;\n\tstatus?: RequestStatus;\n\tprocessType?: RequestProcessType;\n\ttitle?: string;\n\tsummary?: string;\n\tfields: RequestFields;\n\tparameters?: RequestParameterInput[];\n\tfieldDefinitions?: RequestFieldDefinition[];\n\tfiles?: RequestFiles;\n\tcollections?: RequestCollections;\n}"
    },
    {
      "name": "RequestPatch",
      "kind": "type",
      "definition": "{\n\tsource?: string;\n\tstatus?: RequestStatus;\n\tprocessType?: RequestProcessType;\n\ttitle?: string;\n\tsummary?: string;\n\tfields?: RequestFields;\n\tparameters?: RequestParameterInput[];\n\tfieldDefinitions?: RequestFieldDefinition[];\n\tfiles?: RequestFiles;\n\tcollections?: RequestCollections;\n}"
    },
    {
      "name": "RequestListParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n\tsource?: string;\n}"
    },
    {
      "name": "RequestDailyPoint",
      "kind": "type",
      "definition": "{\n\tdate: string;\n\trequests: number;\n}"
    },
    {
      "name": "RequestMetrics",
      "kind": "type",
      "definition": "{\n\ttotal: number;\n\tdaily: RequestDailyPoint[];\n}"
    },
    {
      "name": "RequestProcessingEntry",
      "kind": "type",
      "definition": "{\n\tid: string;\n\trequestId: RequestId;\n\tstatus: RequestStatus;\n\tactor: string;\n\tcomment: string;\n\tcreatedAt: ISODateString;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n\titems: T[];\n\ttotalCount?: number;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface RequestsServiceRtClient {
  createRequest(input: RequestInput): RequestId;
  getRequest(id: RequestId): Request | any;
  getRequestModel(id: RequestId): RequestModel | any;
  getRequestRequirementProfile(processType: RequestProcessType): RequestRequirementProfile | any;
  listRequestRequirementProfiles(): RequestRequirementProfile[];
  createRequestModel(input: RequestModelInput): RequestModel;
  applyRequestUpdate(id: RequestId, patch: RequestModelPatch, actor: string, comment?: string): RequestModel;
  patchRequest(id: RequestId, patch: RequestPatch, actor: string, comment?: string): void;
  listRequests(params: RequestListParams): PaginatedResult<Request>;
  updateStatus(id: RequestId, status: RequestStatus, actor: string, comment?: string): void;
  listProcessing(requestId: RequestId): RequestProcessingEntry[];
  getRequestMetrics(): RequestMetrics;
}

export function createRequestsServiceRtClient(): RequestsServiceRtClient {
  return createRtClient<RequestsServiceRtClient>(metadata);
}
