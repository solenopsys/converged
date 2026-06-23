# wf-file-analysis — microservice contract (what the node split requires)

The translated workflow (`wf-file-analysis.ts`) is flow-only. Everything the old
`FileAnalysisProcessFilesNode` did inline must move into microservice methods,
and all of them must work **by reference** (`CacheRef = { cacheKey, sizeBytes? }`,
already defined in `types/services/data/store.ts`) — heavy bytes live in Valkey,
never in the workflow. After adding these to the nrpc type interfaces, regenerate
(`g-*` + `g-*/rt`) and the workflow type-checks against them.

## ms-files (`types/services/data/files.ts`)

Pulled out of `lib/file-storage.ts` + `lib/file-types.ts` + the node's `unzipSync`:

```ts
// assemble a stored file's chunks into one Valkey blob, return the reference
materialize(fileId: UUID): Promise<{ ref: CacheRef; metadata: FileMetadata }>;

// chunk + store a Valkey blob as a new file (was saveFileToStorage)
persist(input: {
  ref: CacheRef; name: string; fileType: string; owner: string;
  collectionId?: UUID; processId?: string;
}): Promise<FileMetadata>;

// file-type detection (was lib/file-types.detectFileType) — reads bytes by ref
detectType(input: { ref: CacheRef; name: string }): Promise<{ type: string; mime: string }>;

// unzip an archive blob; persist each safe entry; return their file ids
unzip(input: {
  ref: CacheRef; collectionId: UUID; owner: string; processId?: string;
}): Promise<{ entries: { fileId: UUID; name: string }[] }>;
```

`saveCollection` already exists.

## ms-modelconvertor (`types/services/convertors/modelconvertor.ts`)

Change `convert` from inline bytes to refs:

```ts
convert(input: { sourceRef: CacheRef; sourceName: string; format?: ConvertFormat }):
  Promise<{ files: { name: string; ref: CacheRef }[] }>;
```

## ms-millingextractor (`types/services/extractors/millingextractor.ts`)

```ts
extract(input: { modelRef: CacheRef; modelName?: string; includeGcode?: boolean; /* tool params */ }):
  Promise<{ estimate: MillingEstimate; gcodeRef?: CacheRef }>;
```

## ms-printextractor (`types/services/extractors/printextractor.ts`)

```ts
extractFromSlice(input: {
  modelRef: CacheRef; modelName?: string; definitionRef: CacheRef;
  definitionName?: string; settings?: string[]; density?: number;
  filamentDiameter?: number; threads?: number;
}): Promise<{ estimate: PrintEstimate; gcodeRef?: CacheRef }>;

extractFromGcode(input: { gcodeRef: CacheRef; density?: number; filamentDiameter?: number }):
  Promise<PrintEstimate>;

// NEW — the STL-geometry math that was inline in the node (parseStlGeometry +
// estimatePrintGeometry). Belongs in the service that owns print estimation.
estimateGeometry(input: {
  modelRef: CacheRef; modelName?: string; density?: number;
  filamentDiameter?: number; infillPercent?: number; volumetricRateMm3PerSec?: number;
}): Promise<PrintEstimate>;
```

## Where each piece of the old node went

| old (inline in the node / lib) | now |
|---|---|
| per-file loop, archive recursion, type dispatch, error capture | **workflow** (flow) |
| `readFileFromStorage` (chunk concat) | `files.materialize` |
| `saveFileToStorage` (chunk + store) | `files.persist` |
| `detectFileType` | `files.detectType` |
| `unzipSync` archive expansion | `files.unzip` |
| `parseStlGeometry` / `estimatePrintGeometry` | `printextractor.estimateGeometry` |
| `convert` / `extract*` with `Uint8Array` | same services, **CacheRef** params/results |

No service calls another service: the workflow holds the `CacheRef`s and passes
them along; each service reads/writes Valkey on its own.
