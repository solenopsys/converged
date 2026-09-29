# rp-analytics

## Purpose

Stores first-party browser analytics events and compact interaction summaries
for visitor sessions. The shell collector sends batches through Fujin, while
this repository owns the column-store journal and query API. Server-side IP
enrichment uses separate SQL stores for GeoLite2 Country and GeoLite2 ASN
network ranges.

## Responsibility boundary

Owns browser analytics ingestion and retrieval; does not own browser capture,
bot classification, or presentation dashboards.

## Direct module dependencies

- None

## GeoLite2 import

`importGeoLiteCountryBatch` and `importGeoLiteAsnBatch` accept up to 5,000
normalized CIDR rows per call. Country rows contain `network`, `country_code`,
and optionally `country_name`; ASN rows contain `network`, `asn`, and
`organization`. Clear the matching store before loading a complete replacement
dataset so obsolete ranges are removed. The stores keep IP ranges, not source
CSV files.

Country and ASN CSVs are provided by MaxMind for SQL imports. Country block
records need to be joined to the English Locations CSV by geoname id before
calling the import API. Keep the downloaded license and attribution files with
the dataset. GeoLite data is restricted by MaxMind's EULA and must not be
exposed to third parties without the applicable redistribution rights.

## Solution membership

- `analitycs`

## Source

`modules/repositories/analytics/rp-analytics`
