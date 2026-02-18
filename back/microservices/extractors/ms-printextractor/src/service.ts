import { basename } from "node:path";
import type {
  GcodeEstimateInput,
  PrintEstimate,
  PrintExtractorService,
  SliceEstimateInput,
  SliceEstimateResult,
} from "g-printextractor";

const DEFAULT_DENSITY = 1.24;
const DEFAULT_FILAMENT_DIAMETER = 1.75;

type SliceInfo = {
  time_estimates?: Record<string, number>;
  material_estimates?: Record<string, number>;
};

function toPositiveNumber(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function extractFirstNumber(line: string): number | undefined {
  const match = line.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : undefined;
}

function parseGcodeEstimate(
  content: string,
  density: number,
  diameter: number,
): PrintEstimate {
  let timeSeconds: number | undefined;
  let filamentLengthMeters: number | undefined;
  let materialVolumeMm3: number | undefined;
  let weightGrams: number | undefined;
  const materialSeries: number[] = [];
  const materialUsedSeries: number[] = [];

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith(";TIME:")) {
      const value = extractFirstNumber(line.slice(6));
      if (typeof value === "number") timeSeconds = value;
      continue;
    }
    if (line.startsWith(";PRINT.TIME:")) {
      const value = extractFirstNumber(line.slice(12));
      if (typeof value === "number") timeSeconds = value;
      continue;
    }
    if (/^;MATERIAL\d*:/.test(line)) {
      const value = extractFirstNumber(line);
      if (typeof value === "number") materialSeries.push(value);
      continue;
    }
    if (/^;MATERIAL_USED\d*:/.test(line)) {
      const value = extractFirstNumber(line);
      if (typeof value === "number") materialUsedSeries.push(value);
      continue;
    }
    if (line.startsWith(";Filament used:")) {
      const matches = [...line.matchAll(/(-?\d+(?:\.\d+)?)\s*m\b/gi)];
      if (matches.length > 0) {
        filamentLengthMeters = matches.reduce((sum, m) => sum + Number(m[1]), 0);
      }
      continue;
    }
    if (line.startsWith(";Filament weight")) {
      const value = extractFirstNumber(line);
      if (typeof value === "number") weightGrams = value;
    }
  }

  if (materialSeries.length > 0) {
    materialVolumeMm3 = materialSeries.reduce((a, b) => a + b, 0);
  } else if (materialUsedSeries.length > 0) {
    materialVolumeMm3 = materialUsedSeries.reduce((a, b) => a + b, 0);
  }

  if (typeof materialVolumeMm3 === "number" && typeof weightGrams !== "number") {
    weightGrams = (materialVolumeMm3 / 1000) * density;
  }

  if (typeof filamentLengthMeters === "number" && typeof materialVolumeMm3 !== "number") {
    const radiusMm = diameter / 2;
    const areaMm2 = Math.PI * radiusMm * radiusMm;
    materialVolumeMm3 = filamentLengthMeters * 1000 * areaMm2;
    if (typeof weightGrams !== "number") {
      weightGrams = (materialVolumeMm3 / 1000) * density;
    }
  }

  return {
    timeSeconds,
    filamentLengthMeters,
    materialVolumeMm3,
    weightGrams,
  };
}

function mergeWithSliceInfo(
  estimate: PrintEstimate,
  sliceInfo: SliceInfo | null,
  density: number,
  diameter: number,
): PrintEstimate {
  if (!sliceInfo) {
    return estimate;
  }

  const result: PrintEstimate = { ...estimate };

  if (typeof result.timeSeconds !== "number" && sliceInfo.time_estimates) {
    const values = Object.values(sliceInfo.time_estimates)
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v));
    if (values.length > 0) {
      result.timeSeconds = values.reduce((a, b) => a + b, 0);
    }
  }

  if (
    (typeof result.filamentLengthMeters !== "number" ||
      typeof result.materialVolumeMm3 !== "number" ||
      typeof result.weightGrams !== "number") &&
    sliceInfo.material_estimates
  ) {
    const values = Object.values(sliceInfo.material_estimates)
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v));

    if (values.length > 0) {
      const totalLengthMm = values.reduce((a, b) => a + b, 0);
      const radiusMm = diameter / 2;
      const areaMm2 = Math.PI * radiusMm * radiusMm;
      const volumeMm3 = totalLengthMm * areaMm2;

      if (typeof result.filamentLengthMeters !== "number") {
        result.filamentLengthMeters = totalLengthMm / 1000;
      }
      if (typeof result.materialVolumeMm3 !== "number") {
        result.materialVolumeMm3 = volumeMm3;
      }
      if (typeof result.weightGrams !== "number") {
        result.weightGrams = (volumeMm3 / 1000) * density;
      }
    }
  }

  return result;
}

async function runCuraSlice(
  input: SliceEstimateInput,
): Promise<{ gcode: Uint8Array; sliceInfo: SliceInfo | null }> {
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).self = globalThis;
  (globalThis as Record<string, unknown>).__cura_last_slice_info = null;
  (globalThis as Record<string, unknown>).__cura_progress_cb = () => {};
  (globalThis as Record<string, unknown>).__cura_slice_info_cb = (value: unknown) => {
    (globalThis as Record<string, unknown>).__cura_last_slice_info = value;
  };
  (globalThis as Record<string, unknown>).__cura_gcode_header_cb = () => {};
  (globalThis as Record<string, unknown>).__cura_engine_info_cb = () => {};

  const { default: CuraEngine } = await import("@mosaicslicer/curaengine");
  const mod: any = await CuraEngine({
    printErr: (message: unknown) => {
      const text = String(message);
      if (!text.includes("program exited (with status:")) {
        console.error(text);
      }
    },
  });

  try {
    mod.FS.mkdir("/work");
  } catch {}

  const definitionName = basename(input.definitionName || "definition.def.json");
  const modelName = basename(input.modelName || "model.stl");
  const outPath = "/work/out.gcode";

  try {
    mod.FS.unlink(`/work/${definitionName}`);
  } catch {}
  try {
    mod.FS.unlink(`/work/${modelName}`);
  } catch {}
  try {
    mod.FS.unlink(outPath);
  } catch {}

  mod.FS_createDataFile("/work", definitionName, input.definitionJson, true, true);
  mod.FS_createDataFile("/work", modelName, input.modelStl, true, true);

  const args: string[] = [
    "slice",
    "-j",
    `/work/${definitionName}`,
    "-l",
    `/work/${modelName}`,
    "-o",
    outPath,
  ];

  const threads =
    typeof input.threads === "number" && Number.isFinite(input.threads)
      ? Math.max(1, Math.floor(input.threads))
      : 0;
  if (threads > 0) {
    args.push(`-m${threads}`);
  }

  if (Array.isArray(input.settings)) {
    for (const setting of input.settings) {
      if (typeof setting === "string" && setting.length > 0) {
        args.push("-s", setting);
      }
    }
  }

  if (Array.isArray(input.searchFiles) && input.searchFiles.length > 0) {
    const searchDirs: string[] = [];

    for (let i = 0; i < input.searchFiles.length; i++) {
      const file = input.searchFiles[i];
      const dir = `/search_${i}`;
      try {
        mod.FS.mkdir(dir);
      } catch {}

      const fileName = basename(file.name || `search_${i}.json`);
      try {
        mod.FS.unlink(`${dir}/${fileName}`);
      } catch {}
      mod.FS_createDataFile(dir, fileName, file.data, true, true);
      searchDirs.push(dir);
    }

    if (searchDirs.length > 0) {
      args.push("-d", searchDirs.join(":"));
    }
  }

  args.push("--progress_cb", "__cura_progress_cb");
  args.push("--slice_info_cb", "__cura_slice_info_cb");
  args.push("--gcode_header_cb", "__cura_gcode_header_cb");
  args.push("--engine_info_cb", "__cura_engine_info_cb");

  const code = mod.callMain(args);
  if (code !== 0) {
    throw new Error(`CuraEngine exited with code ${code}`);
  }

  const gcode = mod.FS.readFile(outPath, { encoding: "binary" }) as Uint8Array;
  const sliceInfo = ((globalThis as Record<string, unknown>).__cura_last_slice_info || null) as
    | SliceInfo
    | null;

  return { gcode, sliceInfo };
}

export class PrintExtractorServiceImpl implements PrintExtractorService {
  async extractFromSlice(input: SliceEstimateInput): Promise<SliceEstimateResult> {
    const density = toPositiveNumber(input.density, DEFAULT_DENSITY);
    const diameter = toPositiveNumber(
      input.filamentDiameter,
      DEFAULT_FILAMENT_DIAMETER,
    );

    const { gcode, sliceInfo } = await runCuraSlice(input);
    const gcodeText = new TextDecoder().decode(gcode);

    const parsed = parseGcodeEstimate(gcodeText, density, diameter);
    const estimate = mergeWithSliceInfo(parsed, sliceInfo, density, diameter);

    return {
      estimate,
      gcode,
    };
  }

  async extractFromGcode(input: GcodeEstimateInput): Promise<PrintEstimate> {
    const density = toPositiveNumber(input.density, DEFAULT_DENSITY);
    const diameter = toPositiveNumber(
      input.filamentDiameter,
      DEFAULT_FILAMENT_DIAMETER,
    );
    const gcodeText = new TextDecoder().decode(input.gcode);
    return parseGcodeEstimate(gcodeText, density, diameter);
  }
}

export default PrintExtractorServiceImpl;
