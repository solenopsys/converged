# sqlite-vec

`sqlite-vec` brings vector columns and nearest-neighbour queries to the SQLite
stores used by Converged. A vector table can keep embeddings beside the fields
that identify and describe the source object, so a search request does not
have to leave the store merely to rank similar records.

The extension provides `vec0` virtual tables for float, int8, and binary
vectors. Queries return rows ordered by distance; metadata, auxiliary columns,
and partition keys remain available to the same SQLite query. This is useful
for the platform's semantic search and retrieval paths, where filtering and
ranking belong to one operation.

The wrapper builds the upstream C extension as a native artifact. SQLite loads
it into the process that owns the database; there is no separate vector-search
service in this integration.
