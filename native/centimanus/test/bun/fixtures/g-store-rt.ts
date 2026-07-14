// type-only stand-in (the workflow imports CacheRef as a type, erased at build)
export type CacheRef = { cacheKey: string; sizeBytes?: number };
