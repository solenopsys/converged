# rp-analytics

## Purpose

Stores first-party browser analytics events and compact interaction summaries
for visitor sessions. The shell collector sends batches through Fujin, while
this repository owns the column-store journal and query API. Server-side IP
enrichment uses SQL stores for GeoLite2 Country, City, and ASN IP ranges.

## Responsibility boundary

Owns browser analytics ingestion and retrieval; does not own browser capture,
bot classification, or presentation dashboards.

## Direct module dependencies

- None

## GeoLite2 import

The `analytics import country|city|asn` CLI command downloads and streams the
GeoLite2 CSV archive from MaxMind. Set `MAXMIND_ACCOUNT_ID` and
`MAXMIND_LICENSE_KEY` in the CLI environment. The command streams ZIP entries,
parses CSV rows, and sends batches of 1,000 to this repository. The repository
upserts each batch, then removes stale ranges only after the complete archive
has been read successfully. The UI only pages through stored records; it does
not download or unpack archives.

Country and City network records are joined to their English Locations CSV by
`geoname_id`; City locations also provide region and city names. ASN records
contain the network, ASN number, and organization. The stores keep normalized
IP ranges and location metadata, not source ZIP/CSV files.

Keep MaxMind attribution in the product documentation and review the GeoLite
license before exposing derived location data to analytics customers.

## Solution membership

- `analitycs`

## Source

`modules/repositories/analytics/rp-analytics`
