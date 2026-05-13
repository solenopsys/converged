import { describe, test, expect, mock } from "bun:test";

const fakeStl = new Uint8Array([1, 2, 3]);
const fakeGcode = new TextEncoder().encode(";TIME:3600\n;Filament used: 1.5m\n;MATERIAL:500\n");

mock.module("g-files", () => ({
  createFilesServiceClient: () => ({
    getChunks: async (id: string) => [
      { fileId: id, hash: `hash-${id}-0`, chunkNumber: 0, chunkSize: 3, createdAt: "" },
    ],
  }),
}));

mock.module("g-store", () => ({
  createStoreServiceClient: () => ({
    get: async (hash: string) => hash.includes("def") ? new Uint8Array([9, 8, 7]) : fakeStl,
  }),
}));

mock.module("g-millingextractor", () => ({
  createMillingExtractorServiceClient: () => ({
    extract: async () => ({
      estimate: {
        triangles: 100, minX: 0, minY: 0, minZ: 0, maxX: 50, maxY: 30, maxZ: 20,
        safeZ: 25, passes: 20, points: 400,
        cutLengthMm: 1200.5, rapidLengthMm: 300.2,
        cutTimeSec: 90.0, rapidTimeSec: 6.0, totalTimeSec: 96.0,
      },
    }),
  }),
}));

mock.module("g-printextractor", () => ({
  createPrintExtractorServiceClient: () => ({
    extractFromSlice: async () => ({
      estimate: { timeSeconds: 3600, filamentLengthMeters: 1.5, materialVolumeMm3: 500, weightGrams: 8.5 },
      gcode: fakeGcode,
    }),
    extractFromGcode: async () => ({
      timeSeconds: 3600, filamentLengthMeters: 1.5, materialVolumeMm3: 500, weightGrams: 8.5,
    }),
  }),
}));

import { millingEstimateTool, printEstimateTool, printEstimateFromGcodeTool } from "./extractors";

describe("milling_estimate tool", () => {
  test("returns dimensions, passes and timing", async () => {
    const result = JSON.parse(await millingEstimateTool.execute({ fileId: "stl-1" }));
    expect(result.dimensions).toEqual({ x: 50, y: 30, z: 20 });
    expect(result.passes).toBe(20);
    expect(result.totalTimeSec).toBe(96.0);
    expect(result.hasGcode).toBe(false);
  });

  test("triangles and cut length are present", async () => {
    const result = JSON.parse(await millingEstimateTool.execute({ fileId: "stl-1" }));
    expect(result.triangles).toBe(100);
    expect(result.cutLengthMm).toBe(1200.5);
  });
});

describe("print_estimate tool", () => {
  test("returns time, filament, volume and weight", async () => {
    const result = JSON.parse(await printEstimateTool.execute({ fileId: "stl-1", definitionFileId: "def-1" }));
    expect(result.timeSeconds).toBe(3600);
    expect(result.filamentLengthMeters).toBe(1.5);
    expect(result.materialVolumeMm3).toBe(500);
    expect(result.weightGrams).toBe(8.5);
  });
});

describe("print_estimate_from_gcode tool", () => {
  test("returns estimate from gcode file", async () => {
    const result = JSON.parse(await printEstimateFromGcodeTool.execute({ fileId: "gcode-1" }));
    expect(result.timeSeconds).toBe(3600);
    expect(result.weightGrams).toBe(8.5);
  });
});
