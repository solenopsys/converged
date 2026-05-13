// Auto-generated package
import { createHttpClient } from "nrpc";

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
};

export type RequestFields = Record<string, RequestFieldValue>;

export type RequestFiles = Record<string, string>;

export type Request = {
	id: RequestId;
	source?: string;
	status: RequestStatus;
	fields: RequestFields;
	files: RequestFiles;
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
};

export type RequestListParams = {
	offset: number;
	limit: number;
	source?: string;
};

export type RequestOrderStatusGroup = | "all"
	| "requests"
	| "ready"
	| "in_progress"
	| "completed"
	| "blocked";

export type RequestOrderListParams = RequestListParams & {
	statusGroup?: RequestOrderStatusGroup;
	processType?: RequestProcessType;
};

export type RequestOrderRow = {
	id: RequestId;
	requestId: RequestId;
	model: string;
	printingType: string;
	status: RequestStatus;
	statusGroup: RequestOrderStatusGroup;
	quantity: number;
	weightGrams?: number;
	material?: string;
	processType: RequestProcessType;
	completionPercent: number;
	createdAt: ISODateString;
	updatedAt: ISODateString;
};

export type RequestConversionPoint = {
	date: string;
	requests: number;
	orders: number;
	conversion: number;
};

export type RequestStatusCount = {
	group: RequestOrderStatusGroup;
	label: string;
	count: number;
};

export type RequestDashboardStats = {
	requestsTotal: number;
	ordersTotal: number;
	printingTotal: number;
	inProgressTotal: number;
	completedTotal: number;
	conversionPercent: number;
	utilizationPercent: number;
	printerCapacity: number;
	availablePrinters: number;
	estimatedPrintingHours: number;
	materialWeightGrams: number;
};

export type RequestDashboard = {
	stats: RequestDashboardStats;
	conversion: RequestConversionPoint[];
	statusCounts: RequestStatusCount[];
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

export const metadata = {
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
      "name": "listRequestOrders",
      "parameters": [
        {
          "name": "params",
          "type": "RequestOrderListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<RequestOrderRow>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getRequestDashboard",
      "parameters": [],
      "returnType": "RequestDashboard",
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
      "definition": "{\n\tid: RequestId;\n\tsource?: string;\n\tstatus: RequestStatus;\n\tprocessType: RequestProcessType;\n\ttitle?: string;\n\tsummary?: string;\n\tfields: Record<string, RequestFieldState>;\n\tfieldOrder: string[];\n\tfiles: RequestFiles;\n\tmissingRequired: string[];\n\tremainingRequired: string[];\n\tremainingDelta: RequestRequirementField[];\n\tcompletion: RequestCompletion;\n\tcreatedAt: ISODateString;\n\tupdatedAt: ISODateString;\n\trevision: number;\n}"
    },
    {
      "name": "RequestParameterInput",
      "kind": "type",
      "definition": "{\n\tkey: string;\n\tvalue: RequestFieldValue;\n\tlabel?: string;\n\ttype?: RequestFieldType;\n\trequired?: boolean;\n\tgroup?: string;\n\tunit?: string;\n\tdescription?: string;\n\toptions?: RequestFieldOption[];\n\tsource?: string;\n\tconfidence?: number;\n\torder?: number;\n}"
    },
    {
      "name": "RequestModelInput",
      "kind": "type",
      "definition": "{\n\tsource?: string;\n\tstatus?: RequestStatus;\n\tprocessType?: RequestProcessType;\n\ttitle?: string;\n\tsummary?: string;\n\tfields?: RequestFields;\n\tparameters?: RequestParameterInput[];\n\tfieldDefinitions?: RequestFieldDefinition[];\n\tfiles?: RequestFiles;\n}"
    },
    {
      "name": "RequestModelPatch",
      "kind": "type",
      "definition": "{\n\tsource?: string;\n\tstatus?: RequestStatus;\n\tprocessType?: RequestProcessType;\n\ttitle?: string;\n\tsummary?: string;\n\tfields?: RequestFields;\n\tparameters?: RequestParameterInput[];\n\tfieldDefinitions?: RequestFieldDefinition[];\n\tfiles?: RequestFiles;\n}"
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
      "name": "Request",
      "kind": "type",
      "definition": "{\n\tid: RequestId;\n\tsource?: string;\n\tstatus: RequestStatus;\n\tfields: RequestFields;\n\tfiles: RequestFiles;\n\tcreatedAt: ISODateString;\n\tupdatedAt?: ISODateString;\n\tmodel?: RequestModel;\n}"
    },
    {
      "name": "RequestInput",
      "kind": "type",
      "definition": "{\n\tsource?: string;\n\tstatus?: RequestStatus;\n\tprocessType?: RequestProcessType;\n\ttitle?: string;\n\tsummary?: string;\n\tfields: RequestFields;\n\tparameters?: RequestParameterInput[];\n\tfieldDefinitions?: RequestFieldDefinition[];\n\tfiles?: RequestFiles;\n}"
    },
    {
      "name": "RequestPatch",
      "kind": "type",
      "definition": "{\n\tsource?: string;\n\tstatus?: RequestStatus;\n\tprocessType?: RequestProcessType;\n\ttitle?: string;\n\tsummary?: string;\n\tfields?: RequestFields;\n\tparameters?: RequestParameterInput[];\n\tfieldDefinitions?: RequestFieldDefinition[];\n\tfiles?: RequestFiles;\n}"
    },
    {
      "name": "RequestListParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n\tsource?: string;\n}"
    },
    {
      "name": "RequestOrderStatusGroup",
      "kind": "type",
      "definition": "| \"all\"\n\t| \"requests\"\n\t| \"ready\"\n\t| \"in_progress\"\n\t| \"completed\"\n\t| \"blocked\""
    },
    {
      "name": "RequestOrderListParams",
      "kind": "type",
      "definition": "RequestListParams & {\n\tstatusGroup?: RequestOrderStatusGroup;\n\tprocessType?: RequestProcessType;\n}"
    },
    {
      "name": "RequestOrderRow",
      "kind": "type",
      "definition": "{\n\tid: RequestId;\n\trequestId: RequestId;\n\tmodel: string;\n\tprintingType: string;\n\tstatus: RequestStatus;\n\tstatusGroup: RequestOrderStatusGroup;\n\tquantity: number;\n\tweightGrams?: number;\n\tmaterial?: string;\n\tprocessType: RequestProcessType;\n\tcompletionPercent: number;\n\tcreatedAt: ISODateString;\n\tupdatedAt: ISODateString;\n}"
    },
    {
      "name": "RequestConversionPoint",
      "kind": "type",
      "definition": "{\n\tdate: string;\n\trequests: number;\n\torders: number;\n\tconversion: number;\n}"
    },
    {
      "name": "RequestStatusCount",
      "kind": "type",
      "definition": "{\n\tgroup: RequestOrderStatusGroup;\n\tlabel: string;\n\tcount: number;\n}"
    },
    {
      "name": "RequestDashboardStats",
      "kind": "type",
      "definition": "{\n\trequestsTotal: number;\n\tordersTotal: number;\n\tprintingTotal: number;\n\tinProgressTotal: number;\n\tcompletedTotal: number;\n\tconversionPercent: number;\n\tutilizationPercent: number;\n\tprinterCapacity: number;\n\tavailablePrinters: number;\n\testimatedPrintingHours: number;\n\tmaterialWeightGrams: number;\n}"
    },
    {
      "name": "RequestDashboard",
      "kind": "type",
      "definition": "{\n\tstats: RequestDashboardStats;\n\tconversion: RequestConversionPoint[];\n\tstatusCounts: RequestStatusCount[];\n}"
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

// Server interface (to be implemented in microservice)
export interface RequestsService {
  createRequest(input: RequestInput): Promise<RequestId>;
  getRequest(id: RequestId): Promise<Request | any>;
  getRequestModel(id: RequestId): Promise<RequestModel | any>;
  getRequestRequirementProfile(processType: RequestProcessType): Promise<RequestRequirementProfile | any>;
  listRequestRequirementProfiles(): Promise<RequestRequirementProfile[]>;
  createRequestModel(input: RequestModelInput): Promise<RequestModel>;
  applyRequestUpdate(id: RequestId, patch: RequestModelPatch, actor: string, comment?: string): Promise<RequestModel>;
  patchRequest(id: RequestId, patch: RequestPatch, actor: string, comment?: string): Promise<void>;
  listRequests(params: RequestListParams): Promise<PaginatedResult<Request>>;
  updateStatus(id: RequestId, status: RequestStatus, actor: string, comment?: string): Promise<void>;
  listProcessing(requestId: RequestId): Promise<RequestProcessingEntry[]>;
  listRequestOrders(params: RequestOrderListParams): Promise<PaginatedResult<RequestOrderRow>>;
  getRequestDashboard(): Promise<RequestDashboard>;
}

// Client interface
export interface RequestsServiceClient {
  createRequest(input: RequestInput): Promise<RequestId>;
  getRequest(id: RequestId): Promise<Request | any>;
  getRequestModel(id: RequestId): Promise<RequestModel | any>;
  getRequestRequirementProfile(processType: RequestProcessType): Promise<RequestRequirementProfile | any>;
  listRequestRequirementProfiles(): Promise<RequestRequirementProfile[]>;
  createRequestModel(input: RequestModelInput): Promise<RequestModel>;
  applyRequestUpdate(id: RequestId, patch: RequestModelPatch, actor: string, comment?: string): Promise<RequestModel>;
  patchRequest(id: RequestId, patch: RequestPatch, actor: string, comment?: string): Promise<void>;
  listRequests(params: RequestListParams): Promise<PaginatedResult<Request>>;
  updateStatus(id: RequestId, status: RequestStatus, actor: string, comment?: string): Promise<void>;
  listProcessing(requestId: RequestId): Promise<RequestProcessingEntry[]>;
  listRequestOrders(params: RequestOrderListParams): Promise<PaginatedResult<RequestOrderRow>>;
  getRequestDashboard(): Promise<RequestDashboard>;
}

// Factory function
export function createRequestsServiceClient(
  config?: { baseUrl?: string },
): RequestsServiceClient {
  return createHttpClient<RequestsServiceClient>(metadata, config);
}

// Ready-to-use client
export const requestsClient = createRequestsServiceClient();
