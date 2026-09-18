# rp-files

## Purpose

The single file abstraction of the ecosystem: any module that needs
"files" comes here instead of growing its own table of names and paths.
Keeps metadata, collections, and chunk lists; the bytes themselves live in
`rp-store`.

## Mental model

File = record (name, extension, collection, owner) + ordered list of chunk
references in `rp-store`. Classification (`detectType`), materialization,
and persist operate on metadata — bytes are lifted only when really needed
(model staging, download serving).

## Ecosystem value

The entry point of the whole file intake:

- Requests and orders: attachments, drawings, models — no byte copying
  between domains, just binding a fileId to an entity.
- Production: `wf-files-process` → `wf-file-unpack` → `wf-file-analyze`
  carry only fileIds and metadata; ZIPs unpack into new files right here,
  slicing artifacts and GLB previews persist here too.
- Content: galleries, markdown attachments, static — names and collection
  organization with no knowledge of object storage.
- Any extension works out of the box: type is decided by metadata, not by
  a hardcoded format list.

## Non-goals

- Stores no bytes — that is `rp-store`.
- No unpacking, conversion, or slicing — that is `lm-compressors`,
  `lm-modelconvertor`, processors (opencamlib/curaengine).
- No business semantics: what a file means for an order or request is
  decided by the calling domain.

## Responsibility boundary

Owns file records, collections and chunk-list lifecycle; does not own
object storage implementation details or byte transformations.

## Direct module dependencies

- `rp-store` — the content-addressed block store every file's bytes live in.
  rp-files keeps names, collections and the chunk list; it stores no data.

## Solution membership

- `requests`

## Source

`modules/repositories/data/rp-files`
