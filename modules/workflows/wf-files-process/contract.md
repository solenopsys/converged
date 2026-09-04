# Files Process Contract

`wf-files-process` is intake. It receives uploaded file IDs, unpacks ZIP
archives and classifies everything that came out, so the caller learns what was
uploaded. It does not create a request and it does not analyse anything:
deciding that these files are a request is the assistant's call, and the
analysis that follows is `wf-request-analyze`.

The workflow uses NRPC in this order:

1. `files.get(fileId)` reads metadata and classifies the file.
2. Each archive is delegated to `wf-file-unpack` with
   `rt.subAttempt("unpack:<fileId>", "workflows/wf-file-unpack.js", ...)`.
   Unpacking one archive is that workflow's whole job; this one only decides
   which files need it. A child failure comes back as data, so one bad archive
   does not cost the rest of the upload.
3. `files.get` classifies every extracted entry.

The delegated child does the `files.getChunks` / `store.getWithMeta` /
`compressors.unpack` sequence and persists the entries — see its contract.

`lm-compressors` owns byte assembly, decompression, ZIP parsing, output chunking
and staging. It has no `files` or `store` client. `rp-files` and `rp-store` do
not call `lm-compressors`. The workflow carries only metadata and cache
references between those services.
