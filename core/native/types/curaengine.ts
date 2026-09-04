/**
 * CuraEngine slice processor.
 *
 * One native process, one plugin, one method. The processor dlopens
 * `libcuraengine.so` and answers `analyze` synchronously; scaling and restarts
 * belong to the ptah operator (Deployment replicas), routing to Fujin.
 *
 * @nrpcTarget curaengine
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
 * caller that owns the files locally passes the paths directly.
 */
export type CuraengineTask = {
  stlPath?: string;
  definitionPath?: string;
  gcodePath?: string;
  modelName?: string;
  definitionName?: string;
  enginePath?: string;
  settings?: string[];
  searchFiles?: { name: string; path: string }[];
  threads?: number;
};

export type CuraengineResult = {
  gcodePath: string;
  gcodeBytes: number;
  exitCode: number;
};

export type CuraengineRequest = {
  task: CuraengineTask;
  /** task field -> Valkey cacheKey to stage into a temp file. */
  inputs?: Record<string, string>;
  /** task fields written as files, returned as cache refs. */
  outputs?: string[];
  /** Opt into progress chunks on a server-stream; unary callers omit it. */
  stream?: boolean;
};

export type CuraengineReply = {
  result: CuraengineResult;
  outputs: Record<string, CacheRef>;
};

export interface CuraengineService {
  analyze(request: CuraengineRequest): Promise<CuraengineReply>;
}
