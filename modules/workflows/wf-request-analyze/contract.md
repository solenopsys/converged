# Request Analyze Contract

`wf-request-analyze` turns an existing request into an analysed one. Deciding
that a set of files *is* a request belongs to the assistant; everything after
that decision is this workflow. It is never exposed as a chat tool.

The workflow uses NRPC in this order:

1. `requests.getRequestModel(requestId)` reads the request, whose `files` map is
   display name -> file ID.
2. `files.get(fileId)` classifies each of them. Metadata alone decides what is a
   production model, so drawings and notes are never staged.
3. Each model is delegated to `wf-file-analyze` with
   `rt.subAttempt("analyze:<fileId>", "workflows/wf-file-analyze.js", ...)`.
   Analysing one file is that workflow's whole job; this one only decides which
   files deserve it and merges what the children report. A model that fails
   costs only its own estimate.
4. The delegated child stages the model (`files.materialize` + `files.detectType`),
   gets a GLB preview from `modelconvertor.convert` and an estimate from
   `ptah.analyze` — `opencamlib` for the `cnc` target, `curaengine` for `print`
   (which needs `options.definitionFileId`) — and stores artifacts through
   `files.persist`. Everything rides as `CacheRef`s.
5. `requests.applyRequestUpdate` writes the result back in one node: the GLB
   previews join `files` (the detail view matches a model's preview by base
   name), and the estimates and errors ride as `file_analysis_estimates` and
   `file_analysis_errors` parameters, typed `json` and grouped under `analysis`.

Slicing and CAM run in the ptah processor containers — neither workflow ever
touches model bytes, only metadata and cache references.
