# rp-galery

## Purpose

Media collections over the shared file layer: galleries organize fileIds from rp-files; bytes stay in rp-store. No binary storage of its own.

## Responsibility boundary

Owns gallery entities and organization logic; does not own binary object storage or file records.

## Direct module dependencies

- None

## Solution membership

- `content`

## Source

`modules/repositories/content/rp-galery`
