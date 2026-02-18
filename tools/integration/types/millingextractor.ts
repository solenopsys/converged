export type MillingEstimateInput = {
  modelStl: Uint8Array;
  modelName?: string;
  toolDiameter?: number;
  toolLength?: number;
  stepover?: number;
  sampling?: number;
  minSampling?: number;
  feed?: number;
  rapid?: number;
  safeZ?: number;
  includeGcode?: boolean;
};

export type MillingEstimate = {
  triangles: number;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  safeZ: number;
  passes: number;
  points: number;
  cutLengthMm: number;
  rapidLengthMm: number;
  cutTimeSec: number;
  rapidTimeSec: number;
  totalTimeSec: number;
};

export type MillingEstimateResult = {
  estimate: MillingEstimate;
  gcode?: Uint8Array;
};

export interface MillingExtractorService {
  extract(input: MillingEstimateInput): Promise<MillingEstimateResult>;
}
