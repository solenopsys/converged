# rp-files

## Purpose

The single file abstraction of the ecosystem: any module that needs
"files" comes here instead of growing its own table of names and paths.
Keeps metadata, collections, and chunk lists; the bytes themselves live in
block storage, reached through a store service client.

## Mental model

File = record (name, extension, collection, owner) + ordered list of chunk
references in block storage. Classification (`detectType`), materialization,
and persist operate on metadata — bytes are lifted only when really needed
(model staging, download serving).

## Ecosystem value

The entry point of file intake:

- Files, chunks, collections and metadata behind one API; chunk bytes delegated to block storage.
- Any domain binds an opaque file id to its entity instead of copying bytes around.

## Non-goals

- Not raw block storage — chunk bytes live in the block store.
- Not archive unpacking or model conversion.
## Responsibility boundary

Owns file records, collections and chunk-list lifecycle; does not own
object storage implementation details or byte transformations.

## Direct module dependencies

- None — chunk bytes go through a store service client, which is a transport
  call like any external consumer makes, not a module-to-module link.
  rp-files keeps names, collections and the chunk list; it stores no data.

## Solution membership

- `requests`

## Source

`modules/repositories/data/rp-files`
