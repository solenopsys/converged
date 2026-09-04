# Files Analyze Contract

`wf-files-analyze` is the analysis half of intake. It receives the file IDs an
upload finally amounted to — archives already expanded by `wf-files-process` —
and produces a preview and an estimate for every production model among them.

It is a sibling of `wf-files-process`, not a step inside it. Intake answers the
chat while the visitor watches their files appear; a CAM pass or a slice takes
as long as it takes. The caller starts this workflow and does not wait for it.

The workflow uses NRPC in this order:

1. `files.get(fileId)` classifies each incoming file. Metadata alone decides
   what is a production model, so drawings and notes are never staged; they come
   back in `skipped`.
2. Each model is delegated to `wf-file-analyze` with
   `rt.subAttempt("analyze:<fileId>", "workflows/wf-file-analyze.js", ...)`,
   **one at a time**. A processor is a single-threaded native library behind one
   handler thread, so a serial loop is both what it can absorb and what makes
   the partial report honest about how far the run got.
3. The delegated child stages the model (`files.materialize` + `files.detectType`),
   gets a GLB preview from `modelconvertor.convert` and an estimate from a
   processor — `opencamlib` for the `cnc` target, `curaengine` for `print`
   (which needs `options.definitionFileId`) — and stores artifacts through
   `files.persist`. Everything rides as `CacheRef`s.

Unlike `wf-request-analyze` this workflow writes nothing back: there is no
request yet when files are merely uploaded. It returns `converted`, `estimates`
and `errors` to its caller, which decides what to do with them.

Each processor is its own Fujin peer and its own routing target — `opencamlib`
and `curaengine`, declared as `@nrpcTarget` on the service contracts and carried
into the RT VM by `contractClient(..., { target })`. Slicing and CAM run in
those containers; no workflow ever touches model bytes, only metadata and cache
references.
