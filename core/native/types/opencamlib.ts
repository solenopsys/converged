/**
 * OpenCAMLib milling processor.
 *
 * One native process, one plugin, one method. The processor dlopens
 * `libopencamlib.so` and answers `analyze` synchronously; scaling and restarts
 * belong to the ptah operator (Deployment replicas), routing to Fujin.
 *
 * @nrpcTarget opencamlib
 *
 * Heavy bytes never ride the wire: `inputs` maps a task field to a Valkey
 * cacheKey which the processor GETs into a temp file and binds to that field,
 * and `outputs` lists the task fields the processor writes as files, which are
 * SET back into Valkey and returned as cache refs. A task carrying plain local
 * paths (the CLI on the same host) is used as-is.
 */

/** A blob parked in Valkey, addressed by key rather than copied inline. */
export type CacheRef = {
  cacheKey: string;
  sizeBytes: number;
};

/**
 * Fields bound through `inputs`/`outputs` are omitted by those callers; a
 * caller that owns the file locally passes the path directly. Omitted tool
 * parameters fall back to the processor's defaults. Without `gcodePath` the
 * run is an estimate only and no g-code is generated.
 */
export type OpencamlibTask = {
  stlPath?: string;
  gcodePath?: string;
  toolDiameter?: number;
  toolLength?: number;
  stepover?: number;
  sampling?: number;
  minSampling?: number;
  feed?: number;
  rapid?: number;
  safeZ?: number;
};

export type OpencamlibResult = {
  triangles: number;
  passes: number;
  points: number;
  totalTimeSec: number;
  gcodePath?: string;
  gcodeBytes?: number;
};

export type OpencamlibRequest = {
  task: OpencamlibTask;
  /** task field -> Valkey cacheKey to stage into a temp file. */
  inputs?: Record<string, string>;
  /** task fields written as files, returned as cache refs. */
  outputs?: string[];
  /** Opt into progress chunks on a server-stream; unary callers omit it. */
  stream?: boolean;
};

export type OpencamlibReply = {
  result: OpencamlibResult;
  outputs: Record<string, CacheRef>;
};

export interface OpencamlibService {
  analyze(request: OpencamlibRequest): Promise<OpencamlibReply>;
}
