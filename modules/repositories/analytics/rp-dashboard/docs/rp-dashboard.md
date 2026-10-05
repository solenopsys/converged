# rp-dashboard

## Purpose

Personal dashboard storage: remembers pinned indicators and last-known JSON
payloads for charts. Metrics are still computed by their owning services.

## Responsibility boundary

Owns pin rows (widget, title, source, position) with per-user visibility and a
KVS cache for chart payloads. Cache entries are identified by
`modulename.graphicname` (for example `sf-orders.daily-volume`). The cache is a
last-known display snapshot; it is not an authoritative metric source.

## Chart cache

`getChartCache(key)` returns `{ key, data, updatedAt }` or `null`, and
`setChartCache(key, data)` replaces the snapshot. Keys must have exactly two
dot-separated segments. The frontend dashboard reads IndexedDB first, then
this server KVS on a browser miss; server hits are copied to IndexedDB. The
statistic component mounts after this cache lookup and receives `cachedData`
and `onCacheData` props. A chart should render
`cachedData` immediately when present, continue its normal live request, and
call `onCacheData(data)` only after receiving a successful (`ok`) live result.
That callback updates both caches for the next dashboard open. Browser entries
are local to the current browser profile, while server entries can be reused
across browsers. Cache read/write failures must not prevent the live chart from
loading.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/analytics/rp-dashboard`
