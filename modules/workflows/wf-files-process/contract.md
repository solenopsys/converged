# Files Process Contract

`wf-files-process` is intake. It receives uploaded file IDs, unpacks ZIP
archives and classifies everything that came out, so the caller learns what was
uploaded. It does not create a request and it does not analyse anything:
deciding that these files are a request is the assistant's call, and the
analysis that follows is `wf-request-analyze`.

The workflow uses NRPC in this order:

1. `files.get(fileId)` reads metadata and classifies the file.
2. For ZIP archives, `files.getChunks(fileId)` and `store.getWithMeta(hash)`
   resolve ordered `CacheRef` descriptors and compression metadata.
3. `compressors.unpack({ name, chunks })` reads the cache blobs directly and
   returns extracted entries as Valkey `CacheRef` descriptors.
4. The workflow persists output metadata and chunk hashes through `files` and
   `store` NRPC calls, then classifies each entry with `files.get`.

`ms-compressors` owns byte assembly, decompression, ZIP parsing, output chunking
and staging. It has no `files` or `store` client. `ms-files` and `ms-store` do
not call `ms-compressors`. The workflow carries only metadata and cache
references between those services.
