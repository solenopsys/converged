export type HashString = string;

export type CompressionType = "none" | "deflate" | "gzip" | "brotli";

export type CacheRef = {
	cacheKey: string;
	sizeBytes?: number;
};

export type PaginationParams = {
	key: string;
	offset: number;
	limit: number;
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export type BlockMetadata = {
	hash: HashString;
	size: number;
	originalSize: number;
	compression: CompressionType;
	owner: string;
};

export interface StoreService {
	save(
		dataRef: CacheRef,
		originalSize?: number,
		compression?: CompressionType,
		owner?: string,
	): Promise<HashString>;
	saveWithHash(
		hash: HashString,
		dataRef: CacheRef,
		originalSize?: number,
		compression?: CompressionType,
		owner?: string,
	): Promise<HashString>;
	delete(hash: HashString): Promise<void>;
	get(hash: HashString): Promise<CacheRef>;
	getWithMeta(hash: HashString): Promise<{
		dataRef: CacheRef;
		compression: CompressionType;
		originalSize: number;
	}>;
	exists(hash: HashString): Promise<boolean>;
	list(params: PaginationParams): Promise<PaginatedResult<HashString>>;
	storeStatistic(): Promise<any>;
}
