@0xa1b2c3d4e5f60007;

using Common = import "common.capnp";

# Data access for Files (filesystem) stores.
# Keys are relative file paths; values are raw binary blobs.
# No serialization layer — data is written/read byte-for-byte.

interface FilesStore {
  put @0 (ms :Text, store :Text, key :Text, data :Data)
      -> (telemetry :Common.Telemetry);

  get @1 (ms :Text, store :Text, key :Text)
      -> (data :Data, found :Bool, telemetry :Common.Telemetry);

  delete @2 (ms :Text, store :Text, key :Text)
         -> (deleted :Bool, telemetry :Common.Telemetry);

  exists @3 (ms :Text, store :Text, key :Text)
         -> (exists :Bool, telemetry :Common.Telemetry);

  # Recursively list all file keys under the store root.
  listKeys @4 (ms :Text, store :Text)
           -> (keys :List(Text), telemetry :Common.Telemetry);
}
