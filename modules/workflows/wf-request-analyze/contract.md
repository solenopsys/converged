# Request Analyze Contract

`wf-request-analyze` turns an existing request into an analysed one. Deciding
that a set of files *is* a request belongs to the assistant; everything after
that decision is this workflow. It is never exposed as a chat tool.

The workflow uses NRPC in this order:

1. `requests.getRequestModel(requestId)` reads the request, whose `files` map is
   display name -> file ID.
2. `files.get(fileId)` classifies each of them. Metadata alone decides what is a
   production model, so drawings and notes are never staged.
3. For each model, `files.materialize` + `files.detectType` stage it into Valkey
   as a `CacheRef`.
4. `modelconvertor.convert` returns a GLB preview and `ptah.analyze` runs the
   estimate — `opencamlib` for the `cnc` target, `curaengine` for `print`
   (which needs `options.definitionFileId`). Both take and return `CacheRef`s;
   `files.persist` stores the artifacts.
5. `requests.applyRequestUpdate` writes the result back in one node: the GLB
   previews join `files` (the detail view matches a model's preview by base
   name), and the estimates and errors ride as `file_analysis_estimates` and
   `file_analysis_errors` parameters, typed `json` and grouped under `analysis`.

Analysing a single file is `wf-file-analyze`'s atomic job; this workflow composes
that same `dag-file-steps` step once per model. Slicing and CAM run in the ptah
processor containers — the workflow carries only metadata and cache references.
