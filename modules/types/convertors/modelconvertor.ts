export type ConvertFormat = "assjson" | "gltf" | "gltf2" | "glb" | "glb2";

export type CacheRef = {
	cacheKey: string;
	sizeBytes?: number;
};

export type ModelConvertInput = {
	/**
	 * The stored file to convert. The service reads its fragments itself — that
	 * is what rp-files and rp-store are for — so a caller that has an id never
	 * has to move bytes or assemble chunks to get a preview.
	 */
	fileId: string;
	/** Overrides the stored name; the extension decides the source parser. */
	sourceName?: string;
	format?: ConvertFormat;
};

export type ConvertedFileRef = {
	name: string;
	ref: CacheRef;
};

export type ModelConvertResult = {
	files: ConvertedFileRef[];
};

export interface ModelConvertorService {
	convert(input: ModelConvertInput): Promise<ModelConvertResult>;
}
