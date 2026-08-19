@0xa1b2c3d4e5f60003;

using Common = import "common.capnp";

# Aggregated statistics across all open stores.
# Used for monitoring / health checks from the Bun side.

interface StoreStats {
  # Per-store on-disk size.
  getStoreSize @0 (ms :Text, store :Text)
               -> (bytes :UInt64, telemetry :Common.Telemetry);

  # Snapshot of every open store (size + type).
  getAllStats @1 ()
              -> (stores :List(StoreStat), telemetry :Common.Telemetry);

  struct StoreStat {
    ms        @0 :Text;
    store     @1 :Text;
    storeType @2 :Common.StoreType;
    bytes     @3 :UInt64;
  }
}
