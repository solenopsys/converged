export type CompressionType = "none" | "deflate" | "gzip" | "brotli";

export type CacheRef = {
	cacheKey: string;
	sizeBytes?: number;
};

/** A stored file chunk staged by rp-store in Valkey. */
export type CompressedChunk = {
	ref: CacheRef;
	compression: CompressionType;
	originalSize: number;
};

export type ArchiveUnpackInput = {
	name: string;
	chunks: CompressedChunk[];
};

/** A chunk of an extracted file. The bytes remain in Valkey until rp-store saves it. */
export type ProducedChunk = {
	ref: CacheRef;
	compression: CompressionType;
	originalSize: number;
};

export type UnpackedArchiveEntry = {
	name: string;
	fileType: string;
	hash: string;
	fileSize: number;
	chunks: ProducedChunk[];
};

export type ArchiveUnpackResult = {
	entries: UnpackedArchiveEntry[];
};

/**
 * Binary compression operations. This service owns only cache blobs: it never
 * reads file metadata and never persists file or store records.
 */
export interface CompressorsService {
	unpack(input: ArchiveUnpackInput): Promise<ArchiveUnpackResult>;
}
