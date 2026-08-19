@0xa1b2c3d4e5f60006;

using Common = import "common.capnp";

# Data access for Vector (sqlite-vec) stores.
# Extends the SQL interface with a native vector similarity search method.

interface VectorStore {
  # DDL / write statements (CREATE VIRTUAL TABLE, INSERT, etc.).
  exec @0 (ms :Text, store :Text, sql :Text)
       -> (rowsAffected :Int64, telemetry :Common.Telemetry);

  # Arbitrary SQL read — useful for filtered queries alongside vector columns.
  query @1 (ms :Text, store :Text, sql :Text)
        -> (rows :List(Common.Row), telemetry :Common.Telemetry);

  # ANN search using the sqlite-vec distance functions.
  # score = 1 - distance; results sorted by score descending.
  search @2 (ms :Text, store :Text,
             table :Text, vectorColumn :Text,
             queryVector :List(Float32),
             limit :UInt32)
         -> (results :List(SearchResult), telemetry :Common.Telemetry);

  struct SearchResult {
    row   @0 :Common.Row;
    score @1 :Float64;
  }
}
