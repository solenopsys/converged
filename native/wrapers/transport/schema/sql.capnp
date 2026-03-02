@0xa1b2c3d4e5f60004;

using Common = import "common.capnp";

# Data access for SQL (WAL SQLite) and Column (Stanchion SQLite) stores.
# Both store types share the same wire interface — the store type in the manifest
# determines which engine handles the request on the Zig side.

interface SqlStore {
  # Execute a write statement (INSERT / UPDATE / DELETE / DDL).
  # Returns no data, only telemetry and affected row count.
  exec @0 (ms :Text, store :Text, sql :Text)
       -> (rowsAffected :Int64, telemetry :Common.Telemetry);

  # Execute a read query and return all matching rows.
  query @1 (ms :Text, store :Text, sql :Text)
        -> (rows :List(Common.Row), telemetry :Common.Telemetry);
}
