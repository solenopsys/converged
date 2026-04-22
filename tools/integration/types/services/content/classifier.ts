/** A node in the classifier tree */
export type ClassifierNode = {
	id: string;
	parentId: string | null;
	name: string;
	slug: string;
};

export type ClassifierTreeNode = ClassifierNode & {
	childrenCount: number;
};

/** Universal classifier dictionary mapping scoped by group/context. */
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

export interface ClassifierService {
	addNode(node: Omit<ClassifierNode, "id"> & { id?: string }): Promise<string>;
	getNode(id: string): Promise<ClassifierNode | null>;
	getChildren(parentId: string): Promise<ClassifierNode[]>;
	listRoots(): Promise<ClassifierNode[]>;
	listNodes(params: PaginationParams): Promise<PaginatedResult<ClassifierNode>>;
	listTreeChildren(parentId?: string | null): Promise<ClassifierTreeNode[]>;

	setMapping(mapping: ClassifierMappingInput): Promise<string>;
	getMapping(groupId: string, key: string): Promise<ClassifierMapping | null>;
	resolveMapping(groupId: string, key: string): Promise<string | null>;
	listMappings(groupId: string): Promise<ClassifierMapping[]>;
	listMappingGroups(): Promise<ClassifierMappingGroup[]>;
	deleteMapping(groupId: string, key: string): Promise<boolean>;
}
