@0xa1b2c3d4e5f60002;

using Common = import "common.capnp";

# Abstract store lifecycle management.
# Covers: open/close stores, manifest inspection, migration bookkeeping, size, archive.
# All store types share this interface — no type-specific data access here.

interface StoreManagement {
  # Open a store, creating it on disk if it does not yet exist.
  open @0 (ms :Text, store :Text, storeType :Common.StoreType)
       -> (telemetry :Common.Telemetry);

  # Release in-memory handles.  Data remains on disk.
  close @1 (ms :Text, store :Text)
        -> (telemetry :Common.Telemetry);

  # Return the manifest for an open store.
  getManifest @2 (ms :Text, store :Text)
              -> (manifest :Manifest, telemetry :Common.Telemetry);

  # Append a migration ID to the store's migration log (idempotent — same ID is ignored).
  recordMigration @3 (ms :Text, store :Text, migrationId :Text)
                  -> (telemetry :Common.Telemetry);

  # Return on-disk size in bytes.
  getSize @4 (ms :Text, store :Text)
          -> (bytes :UInt64, telemetry :Common.Telemetry);

  # Create a tar.gz archive of the store directory at outputPath.
  createArchive @5 (ms :Text, store :Text, outputPath :Text)
                -> (telemetry :Common.Telemetry);

  struct Manifest {
    name         @0 :Text;
    storeType    @1 :Common.StoreType;
    dataLocation @2 :Text;
    version      @3 :UInt32;
    migrations   @4 :List(Text);  # applied migration IDs in order
  }
}
