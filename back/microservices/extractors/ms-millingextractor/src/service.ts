import {
  AdaptivePathDropCutter,
  CylCutter,
  Line,
  Path,
  Point,
  STLReader,
  STLSurf,
} from "@opencamlib/opencamlib";
import type {
  MillingEstimate,
  MillingEstimateInput,
  MillingEstimateResult,
  MillingExtractorService,
} from "g-millingextractor";

type Point3 = [number, number, number];

type StlStats = {
  surface: STLSurf;
  triangles: number;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
};

type MillParams = {
  toolDiameter: number;
  toolLength: number;
  stepover: number;
  sampling: number;
  minSampling: number;
  feed: number;
  rapid: number;
  safeZ?: number;
  includeGcode: boolean;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  return Number(value);
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
}

function loadStlStats(data: Uint8Array): StlStats {
  const surface = new STLSurf();
  new STLReader(data, surface);

  const triangles = (surface.serialize() ?? []) as unknown[];
  if (triangles.length === 0) {
    throw new Error("No triangles parsed from STL model");
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const tri of triangles as unknown[][][]) {
    for (const vertex of tri as unknown[][]) {
      const x = toNumber(vertex[0]);
      const y = toNumber(vertex[1]);
      const z = toNumber(vertex[2]);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
  }

  return {
    surface,
    triangles: triangles.length,
    minX,
    minY,
    minZ,
    maxX,
    maxY,
    maxZ,
  };
}

function toPoint3(value: unknown): Point3 | undefined {
  if (Array.isArray(value) && value.length >= 3) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    const z = Number(value[2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      return [x, y, z];
    }
    return undefined;
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const x = Number(rec.x);
    const y = Number(rec.y);
    const z = Number(rec.z);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      return [x, y, z];
    }
  }
  return undefined;
}

function toCLPoints(points: unknown): Point3[] {
  if (!Array.isArray(points)) return [];
  const out: Point3[] = [];
  for (const point of points) {
    const parsed = toPoint3(point);
    if (parsed) out.push(parsed);
  }
  return out;
}

function distance3(a: Point3, b: Point3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dy, dz);
}

function buildYLevels(minY: number, maxY: number, stepover: number): number[] {
  if (maxY <= minY) {
    return [minY];
  }

  const levels: number[] = [];
  const span = maxY - minY;
  const steps = Math.ceil(span / stepover);
  for (let i = 0; i <= steps; i++) {
    const y = Math.min(maxY, minY + i * stepover);
    if (levels.length === 0 || Math.abs(y - levels[levels.length - 1]) > 1e-9) {
      levels.push(y);
    }
  }

  if (Math.abs(levels[levels.length - 1] - maxY) > 1e-9) {
    levels.push(maxY);
  }

  return levels;
}

function buildRasterPath(
  minX: number,
  maxX: number,
  y: number,
  reverse: boolean,
): Path {
  const startX = reverse ? maxX : minX;
  const endX = reverse ? minX : maxX;
  const path = new Path();
  path.append(new Line(new Point(startX, y, 0), new Point(endX, y, 0)));
  return path;
}

function calculateEstimate(
  passPoints: Point3[][],
  feed: number,
  rapid: number,
  safeZ: number,
): Omit<MillingEstimate, "triangles" | "minX" | "minY" | "minZ" | "maxX" | "maxY" | "maxZ" | "safeZ"> {
  let cutLengthMm = 0;
  let rapidLengthMm = 0;
  let points = 0;
  let previousEnd: Point3 | undefined;

  for (const path of passPoints) {
    if (path.length === 0) continue;
    points += path.length;

    const start = path[0];
    const end = path[path.length - 1];

    if (previousEnd) {
      rapidLengthMm += Math.abs(safeZ - previousEnd[2]);
      rapidLengthMm += Math.hypot(start[0] - previousEnd[0], start[1] - previousEnd[1]);
    }

    cutLengthMm += Math.abs(safeZ - start[2]);
    for (let i = 1; i < path.length; i++) {
      cutLengthMm += distance3(path[i - 1], path[i]);
    }

    previousEnd = end;
  }

  if (previousEnd) {
    rapidLengthMm += Math.abs(safeZ - previousEnd[2]);
  }

  const cutTimeSec = (cutLengthMm / feed) * 60;
  const rapidTimeSec = (rapidLengthMm / rapid) * 60;

  return {
    passes: passPoints.length,
    points,
    cutLengthMm,
    rapidLengthMm,
    cutTimeSec,
    rapidTimeSec,
    totalTimeSec: cutTimeSec + rapidTimeSec,
  };
}

function buildMillGcode(passPoints: Point3[][], safeZ: number, feed: number): Uint8Array {
  const lines: string[] = [];
  lines.push("(ms-millingextractor)");
  lines.push("G21");
  lines.push("G90");
  lines.push(`G0 Z${safeZ.toFixed(4)}`);
  lines.push(`F${feed.toFixed(2)}`);

  for (const points of passPoints) {
    if (points.length === 0) continue;
    const start = points[0];
    lines.push(`G0 X${start[0].toFixed(4)} Y${start[1].toFixed(4)}`);
    lines.push(`G1 Z${start[2].toFixed(4)}`);
    for (const point of points) {
      lines.push(`G1 X${point[0].toFixed(4)} Y${point[1].toFixed(4)} Z${point[2].toFixed(4)}`);
    }
    lines.push(`G0 Z${safeZ.toFixed(4)}`);
  }

  lines.push("M30");
  return new TextEncoder().encode(`${lines.join("\n")}\n`);
}

function resolveParams(input: MillingEstimateInput): MillParams {
  const params: MillParams = {
    toolDiameter: input.toolDiameter ?? 6,
    toolLength: input.toolLength ?? 30,
    stepover: input.stepover ?? 1.5,
    sampling: input.sampling ?? 0.5,
    minSampling: input.minSampling ?? 0.1,
    feed: input.feed ?? 800,
    rapid: input.rapid ?? 3000,
    safeZ: input.safeZ,
    includeGcode: input.includeGcode ?? false,
  };

  assertPositive("toolDiameter", params.toolDiameter);
  assertPositive("toolLength", params.toolLength);
  assertPositive("stepover", params.stepover);
  assertPositive("sampling", params.sampling);
  assertPositive("minSampling", params.minSampling);
  assertPositive("feed", params.feed);
  assertPositive("rapid", params.rapid);

  if (params.minSampling > params.sampling) {
    throw new Error("minSampling must be <= sampling");
  }

  return params;
}

export class MillingExtractorServiceImpl implements MillingExtractorService {
  async extract(input: MillingEstimateInput): Promise<MillingEstimateResult> {
    const params = resolveParams(input);
    const stats = loadStlStats(input.modelStl);

    const safeZ = params.safeZ ?? stats.maxZ + 5;
    if (!Number.isFinite(safeZ) || safeZ <= stats.maxZ) {
      throw new Error(`safeZ must be greater than model max Z (${stats.maxZ})`);
    }

    const cutter = new CylCutter(params.toolDiameter, params.toolLength);
    const apdc = new AdaptivePathDropCutter();
    apdc.setSTL(stats.surface);
    apdc.setCutter(cutter);
    apdc.setSampling(params.sampling);
    apdc.setMinSampling(params.minSampling);

    const yLevels = buildYLevels(stats.minY, stats.maxY, params.stepover);
    const passPoints: Point3[][] = [];

    for (let i = 0; i < yLevels.length; i++) {
      const path = buildRasterPath(stats.minX, stats.maxX, yLevels[i], i % 2 === 1);
      apdc.setPath(path);
      apdc.run();
      const points = toCLPoints(apdc.getCLPoints());
      if (points.length > 0) {
        passPoints.push(points);
      }
    }

    if (passPoints.length === 0) {
      throw new Error("Failed to generate any cutter-location points");
    }

    const estimateCore = calculateEstimate(passPoints, params.feed, params.rapid, safeZ);

    const estimate: MillingEstimate = {
      triangles: stats.triangles,
      minX: stats.minX,
      minY: stats.minY,
      minZ: stats.minZ,
      maxX: stats.maxX,
      maxY: stats.maxY,
      maxZ: stats.maxZ,
      safeZ,
      ...estimateCore,
    };

    if (params.includeGcode) {
      return {
        estimate,
        gcode: buildMillGcode(passPoints, safeZ, params.feed),
      };
    }

    return { estimate };
  }
}

export default MillingExtractorServiceImpl;
