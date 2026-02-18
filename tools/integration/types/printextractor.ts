export type NamedBinaryFile = {
  name: string;
  data: Uint8Array;
};

export type SliceEstimateInput = {
  modelStl: Uint8Array;
  modelName?: string;
  definitionJson: Uint8Array;
  definitionName?: string;
  searchFiles?: NamedBinaryFile[];
  settings?: string[];
  density?: number;
  filamentDiameter?: number;
  threads?: number;
};

export type GcodeEstimateInput = {
  gcode: Uint8Array;
  density?: number;
  filamentDiameter?: number;
};

export type PrintEstimate = {
  timeSeconds?: number;
  filamentLengthMeters?: number;
  materialVolumeMm3?: number;
  weightGrams?: number;
};

export type SliceEstimateResult = {
  estimate: PrintEstimate;
  gcode: Uint8Array;
};

export interface PrintExtractorService {
  extractFromSlice(input: SliceEstimateInput): Promise<SliceEstimateResult>;
  extractFromGcode(input: GcodeEstimateInput): Promise<PrintEstimate>;
}
