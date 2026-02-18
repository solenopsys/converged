export type OpenScadConvertInput = {
  sourceName: string;
  sourceData: Uint8Array;
};

export type OpenScadConvertResult = {
  fileName: string;
  fileData: Uint8Array;
  contentType: string;
};

export interface OpenScadConvertorService {
  convert(input: OpenScadConvertInput): Promise<OpenScadConvertResult>;
}
