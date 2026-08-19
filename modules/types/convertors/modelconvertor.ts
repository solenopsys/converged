export type ConvertFormat = "assjson" | "gltf" | "gltf2" | "glb" | "glb2";


export type CacheRef = {
  cacheKey: string;
  sizeBytes?: number;
};

export type ModelConvertInput = {
  sourceRef: CacheRef;
  sourceName: string;
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
