@0xa1b2c3d4e5f60005;

using Common = import "common.capnp";

# Data access for KV (libmdbx) stores.
# Keys are hierarchical text paths; values are raw binary blobs.
# Range queries use lexicographic ordering.

interface KvStore {
  put @0 (ms :Text, store :Text, key :Text, value :Data)
      -> (telemetry :Common.Telemetry);

  get @1 (ms :Text, store :Text, key :Text)
      -> (value :Data, found :Bool, telemetry :Common.Telemetry);

  delete @2 (ms :Text, store :Text, key :Text)
         -> (deleted :Bool, telemetry :Common.Telemetry);

  # List all keys that share the given prefix. Empty prefix = list all.
  listKeys @3 (ms :Text, store :Text, prefix :Text)
           -> (keys :List(Text), telemetry :Common.Telemetry);

  # Return all key-value pairs in [start, end) lexicographic range.
  getRange @4 (ms :Text, store :Text, start :Text, end :Text)
           -> (pairs :List(Common.KvPair), telemetry :Common.Telemetry);
}
