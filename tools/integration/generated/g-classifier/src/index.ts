// Auto-generated package
import { createHttpClient } from "nrpc";

export type ClassifierNode = {
	id: string;
	parentId: string | null;
	name: string;
	slug: string;
};

export type ClassifierTreeNode = ClassifierNode & {
	childrenCount: number;
};

export type ClassifierMapping = {
	id: string;
	groupId: string;
	key: string;
	value: string;
	priority: number;
	createdAt?: Date;
	updatedAt?: Date;
};

export type ClassifierMappingInput = {
	id?: string;
	groupId: string;
	key: string;
	value: string;
	priority?: number;
};

export type PaginationParams = {
	offset: number;
	limit: number;
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export type ClassifierMappingGroup = {
	groupId: string;
	count: number;
};

export const metadata = {
	interfaceName: "ClassifierService",
	serviceName: "classifier",
	filePath: "tools/integration/types/classifier.ts",
	methods: [
		{
			name: "addNode",
			parameters: [
				{
					name: "node",
					type: "any",
					optional: false,
					isArray: false,
				},
			],
			returnType: "string",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "getNode",
			parameters: [
				{
					name: "id",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "any",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "getChildren",
			parameters: [
				{
					name: "parentId",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "ClassifierNode",
			isAsync: true,
			returnTypeIsArray: true,
			isAsyncIterable: false,
		},
		{
			name: "listRoots",
			parameters: [],
			returnType: "ClassifierNode",
			isAsync: true,
			returnTypeIsArray: true,
			isAsyncIterable: false,
		},
		{
			name: "listNodes",
			parameters: [
				{
					name: "params",
					type: "PaginationParams",
					optional: false,
					isArray: false,
				},
			],
			returnType: "any",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "listTreeChildren",
			parameters: [
				{
					name: "parentId",
					type: "string",
					optional: true,
					isArray: false,
				},
			],
			returnType: "ClassifierTreeNode",
			isAsync: true,
			returnTypeIsArray: true,
			isAsyncIterable: false,
		},
		{
			name: "setMapping",
			parameters: [
				{
					name: "mapping",
					type: "ClassifierMappingInput",
					optional: false,
					isArray: false,
				},
			],
			returnType: "string",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "getMapping",
			parameters: [
				{
					name: "groupId",
					type: "string",
					optional: false,
					isArray: false,
				},
				{
					name: "key",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "any",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "resolveMapping",
			parameters: [
				{
					name: "groupId",
					type: "string",
					optional: false,
					isArray: false,
				},
				{
					name: "key",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "any",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "listMappings",
			parameters: [
				{
					name: "groupId",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "ClassifierMapping",
			isAsync: true,
			returnTypeIsArray: true,
			isAsyncIterable: false,
		},
		{
			name: "listMappingGroups",
			parameters: [],
			returnType: "ClassifierMappingGroup",
			isAsync: true,
			returnTypeIsArray: true,
			isAsyncIterable: false,
		},
		{
			name: "deleteMapping",
			parameters: [
				{
					name: "groupId",
					type: "string",
					optional: false,
					isArray: false,
				},
				{
					name: "key",
					type: "string",
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
			name: "ClassifierNode",
			definition:
				"{\n  id: string;\n  parentId: string | null;\n  name: string;\n  slug: string;\n}",
		},
		{
			name: "ClassifierTreeNode",
			definition: "ClassifierNode & {\n  childrenCount: number;\n}",
		},
		{
			name: "ClassifierMapping",
			definition:
				"{\n  id: string;\n  groupId: string;\n  key: string;\n  value: string;\n  priority: number;\n  createdAt?: Date;\n  updatedAt?: Date;\n}",
		},
		{
			name: "ClassifierMappingInput",
			definition:
				"{\n  id?: string;\n  groupId: string;\n  key: string;\n  value: string;\n  priority?: number;\n}",
		},
		{
			name: "PaginationParams",
			definition: "{\n  offset: number;\n  limit: number;\n}",
		},
		{
			name: "PaginatedResult",
			definition: "{\n  items: T[];\n  totalCount?: number;\n}",
		},
		{
			name: "ClassifierMappingGroup",
			definition: "{\n  groupId: string;\n  count: number;\n}",
		},
	],
};

// Server interface (to be implemented in microservice)
export interface ClassifierService {
	addNode(node: any): Promise<string>;
	getNode(id: string): Promise<any>;
	getChildren(parentId: string): Promise<ClassifierNode[]>;
	listRoots(): Promise<ClassifierNode[]>;
	listNodes(params: PaginationParams): Promise<PaginatedResult<ClassifierNode>>;
	listTreeChildren(parentId?: string | null): Promise<ClassifierTreeNode[]>;
	setMapping(mapping: ClassifierMappingInput): Promise<string>;
	getMapping(groupId: string, key: string): Promise<any>;
	resolveMapping(groupId: string, key: string): Promise<any>;
	listMappings(groupId: string): Promise<ClassifierMapping[]>;
	listMappingGroups(): Promise<ClassifierMappingGroup[]>;
	deleteMapping(groupId: string, key: string): Promise<boolean>;
}

// Client interface
export interface ClassifierServiceClient {
	addNode(node: any): Promise<string>;
	getNode(id: string): Promise<any>;
	getChildren(parentId: string): Promise<ClassifierNode[]>;
	listRoots(): Promise<ClassifierNode[]>;
	listNodes(params: PaginationParams): Promise<PaginatedResult<ClassifierNode>>;
	listTreeChildren(parentId?: string | null): Promise<ClassifierTreeNode[]>;
	setMapping(mapping: ClassifierMappingInput): Promise<string>;
	getMapping(groupId: string, key: string): Promise<any>;
	resolveMapping(groupId: string, key: string): Promise<any>;
	listMappings(groupId: string): Promise<ClassifierMapping[]>;
	listMappingGroups(): Promise<ClassifierMappingGroup[]>;
	deleteMapping(groupId: string, key: string): Promise<boolean>;
}

// Factory function
export function createClassifierServiceClient(config?: {
	baseUrl?: string;
}): ClassifierServiceClient {
	return createHttpClient<ClassifierServiceClient>(metadata, config);
}

// Ready-to-use client
export const classifierClient = createClassifierServiceClient();
