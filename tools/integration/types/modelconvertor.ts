export type ConvertFormat = "assjson" | "gltf" | "gltf2" | "glb" | "glb2";

export type ModelConvertInput = {
  sourceName: string;
  sourceData: Uint8Array;
  format?: ConvertFormat;
};

export type ConvertedBinaryFile = {
  name: string;
  data: Uint8Array;
};

export type ModelConvertResult = {
  files: ConvertedBinaryFile[];
};

export interface ModelConvertorService {
  convert(input: ModelConvertInput): Promise<ModelConvertResult>;
}
