export interface PaginationParams {
	offset: number;
	limit: number;
	filter?: Record<string, unknown>;
}

export interface StructFile {
	path: string;
	content: string;
}
