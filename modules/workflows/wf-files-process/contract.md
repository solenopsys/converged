# Files Process Contract

`wf-files-process` receives uploaded file IDs, unpacks ZIP archives, collects
model files, and creates a generic manufacturing request from them. It does not
run Cura or OpenCAM processing.

The workflow uses NRPC in this order:

1. `files.get(fileId)` reads metadata.
2. For ZIP archives, `files.getChunks(fileId)` and `store.getWithMeta(hash)`
   resolve ordered `CacheRef` descriptors and compression metadata.
3. `compressors.unpack({ name, chunks })` reads the cache blobs directly and
   returns extracted entries as Valkey `CacheRef` descriptors.
4. The workflow persists output metadata and chunk hashes through `files` and
   `store` NRPC calls, then creates a request when model files are present.

`ms-compressors` owns byte assembly, decompression, ZIP parsing, output chunking
and staging. It has no `files` or `store` client. `ms-files` and `ms-store` do
not call `ms-compressors`. The workflow carries only metadata and cache
references between those services.
