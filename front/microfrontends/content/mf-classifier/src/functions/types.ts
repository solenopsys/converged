export interface PaginationParams {
	offset: number;
	limit: number;
}

export interface PaginatedResult<T> {
	items: T[];
	totalCount?: number;
}

export interface ClassifierNode {
	id: string;
	parentId: string | null;
	name: string;
	slug: string;
}

export interface ClassifierTreeNode extends ClassifierNode {
	childrenCount: number;
}

export interface ClassifierMapping {
	id: string;
	groupId: string;
	key: string;
	value: string;
	priority: number;
	createdAt?: Date;
	updatedAt?: Date;
}
