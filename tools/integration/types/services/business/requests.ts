export type RequestId = string;
export type ISODateString = string;
export type RequestStatus = string;

export type RequestProcessType =
	| "cnc_machining"
	| "laser_cutting"
	| "plastic_cutting"
	| "3d_printing"
	| "generic";

export type RequestFieldType =
	| "text"
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

export type RequestOrderStatusGroup =
	| "all"
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

export interface RequestsService {
	createRequest(input: RequestInput): Promise<RequestId>;
	getRequest(id: RequestId): Promise<Request | undefined>;
	getRequestModel(id: RequestId): Promise<RequestModel | undefined>;
	getRequestRequirementProfile(
		processType: RequestProcessType,
	): Promise<RequestRequirementProfile | undefined>;
	listRequestRequirementProfiles(): Promise<RequestRequirementProfile[]>;
	createRequestModel(input: RequestModelInput): Promise<RequestModel>;
	applyRequestUpdate(
		id: RequestId,
		patch: RequestModelPatch,
		actor: string,
		comment?: string,
	): Promise<RequestModel>;
	patchRequest(
		id: RequestId,
		patch: RequestPatch,
		actor: string,
		comment?: string,
	): Promise<void>;
	listRequests(params: RequestListParams): Promise<PaginatedResult<Request>>;
	updateStatus(
		id: RequestId,
		status: RequestStatus,
		actor: string,
		comment?: string,
	): Promise<void>;
	listProcessing(requestId: RequestId): Promise<RequestProcessingEntry[]>;
	listRequestOrders(
		params: RequestOrderListParams,
	): Promise<PaginatedResult<RequestOrderRow>>;
	getRequestDashboard(): Promise<RequestDashboard>;
}
