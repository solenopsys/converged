import { createMillingExtractorServiceClient } from "g-millingextractor";
import { createPrintExtractorServiceClient } from "g-printextractor";
import type { Tool } from "../agent/tools/base";
import { downloadFileBytes } from "./files";

function millingClient() {
  return createMillingExtractorServiceClient({ baseUrl: process.env.SERVICES_BASE });
}

function printClient() {
  return createPrintExtractorServiceClient({ baseUrl: process.env.SERVICES_BASE });
}

export const millingEstimateTool: Tool = {
  name: "milling_estimate",
  description: "Calculate CNC milling time, toolpath length and optionally G-code for a given STL file. Returns dimensions, passes count, cut/rapid time in seconds.",
  parameters: {
    type: "object",
    properties: {
      fileId:       { type: "string",  description: "ms-files file ID of the STL model" },
      toolDiameter: { type: "number",  description: "Tool diameter in mm (default 6)" },
      stepover:     { type: "number",  description: "Stepover between passes in mm (default 1.5)" },
      feed:         { type: "number",  description: "Feed rate mm/min (default 800)" },
      rapid:        { type: "number",  description: "Rapid traverse mm/min (default 3000)" },
      includeGcode: { type: "boolean", description: "Return G-code bytes (default false)" },
    },
    required: ["fileId"],
  },
  async execute({ fileId, toolDiameter, stepover, feed, rapid, includeGcode }) {
    const modelStl = await downloadFileBytes(fileId as string);
    const result = await millingClient().extract({
      modelStl,
      toolDiameter: toolDiameter as number | undefined,
      stepover:     stepover     as number | undefined,
      feed:         feed         as number | undefined,
      rapid:        rapid        as number | undefined,
      includeGcode: (includeGcode as boolean | undefined) ?? false,
    });

    const { estimate } = result;
    return JSON.stringify({
      dimensions: {
        x: +(estimate.maxX - estimate.minX).toFixed(2),
        y: +(estimate.maxY - estimate.minY).toFixed(2),
        z: +(estimate.maxZ - estimate.minZ).toFixed(2),
      },
      triangles:      estimate.triangles,
      passes:         estimate.passes,
      cutTimeSec:     +estimate.cutTimeSec.toFixed(1),
      rapidTimeSec:   +estimate.rapidTimeSec.toFixed(1),
      totalTimeSec:   +estimate.totalTimeSec.toFixed(1),
      cutLengthMm:    +estimate.cutLengthMm.toFixed(1),
      hasGcode:       !!result.gcode,
    });
  },
};

export const printEstimateTool: Tool = {
  name: "print_estimate",
  description: "Estimate 3D print time, filament usage and weight for a given STL file using CuraEngine slicer. Requires a printer definition JSON file.",
  parameters: {
    type: "object",
    properties: {
      fileId:           { type: "string", description: "ms-files file ID of the STL model" },
      definitionFileId: { type: "string", description: "ms-files file ID of the Cura printer definition JSON" },
      density:          { type: "number", description: "Filament density g/cm³ (default 1.24 for PLA)" },
      filamentDiameter: { type: "number", description: "Filament diameter mm (default 1.75)" },
    },
    required: ["fileId", "definitionFileId"],
  },
  async execute({ fileId, definitionFileId, density, filamentDiameter }) {
    const [modelStl, definitionJson] = await Promise.all([
      downloadFileBytes(fileId as string),
      downloadFileBytes(definitionFileId as string),
    ]);

    const result = await printClient().extractFromSlice({
      modelStl,
      definitionJson,
      density:          density          as number | undefined,
      filamentDiameter: filamentDiameter as number | undefined,
    });

    const e = result.estimate;
    return JSON.stringify({
      timeSeconds:          e.timeSeconds     != null ? +e.timeSeconds.toFixed(0)           : null,
      filamentLengthMeters: e.filamentLengthMeters != null ? +e.filamentLengthMeters.toFixed(2) : null,
      materialVolumeMm3:    e.materialVolumeMm3    != null ? +e.materialVolumeMm3.toFixed(0)    : null,
      weightGrams:          e.weightGrams          != null ? +e.weightGrams.toFixed(1)           : null,
    });
  },
};

export const printEstimateFromGcodeTool: Tool = {
  name: "print_estimate_from_gcode",
  description: "Parse an existing G-code file and extract print time, filament usage and weight without re-slicing.",
  parameters: {
    type: "object",
    properties: {
      fileId:           { type: "string", description: "ms-files file ID of the G-code file" },
      density:          { type: "number", description: "Filament density g/cm³ (default 1.24)" },
      filamentDiameter: { type: "number", description: "Filament diameter mm (default 1.75)" },
    },
    required: ["fileId"],
  },
  async execute({ fileId, density, filamentDiameter }) {
    const gcode = await downloadFileBytes(fileId as string);
    const e = await printClient().extractFromGcode({
      gcode,
      density:          density          as number | undefined,
      filamentDiameter: filamentDiameter as number | undefined,
    });
    return JSON.stringify({
      timeSeconds:          e.timeSeconds          != null ? +e.timeSeconds.toFixed(0)          : null,
      filamentLengthMeters: e.filamentLengthMeters != null ? +e.filamentLengthMeters.toFixed(2) : null,
      materialVolumeMm3:    e.materialVolumeMm3    != null ? +e.materialVolumeMm3.toFixed(0)    : null,
      weightGrams:          e.weightGrams          != null ? +e.weightGrams.toFixed(1)           : null,
    });
  },
};

export const extractorTools: Tool[] = [
  millingEstimateTool,
  printEstimateTool,
  printEstimateFromGcodeTool,
];
