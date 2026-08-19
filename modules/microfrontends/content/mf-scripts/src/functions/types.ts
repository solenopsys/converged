export type PaginationParams = {
	offset: number;
	limit: number;
};

export type ScriptFile = {
	path: string;
	content: string;
};

export type ScriptListItem = {
	path: string;
	hash: string;
};
