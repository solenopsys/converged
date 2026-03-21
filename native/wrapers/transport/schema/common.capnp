@0xa1b2c3d4e5f60001;

# Common types shared across all storage interfaces.

struct Telemetry {
  # Embedded in every response — wall time, op count, bytes transferred.
  durationUs   @0 :UInt64;  # microseconds from request start to response ready
  opCount      @1 :UInt32;  # number of internal storage operations performed
  bytesRead    @2 :UInt64;
  bytesWritten @3 :UInt64;
}

enum StoreType {
  sql    @0;  # SQLite (Kysely/WAL)
  kv     @1;  # libmdbx key-value
  column @2;  # SQLite + Stanchion column-oriented extension
  vector @3;  # SQLite + sqlite-vec vector search extension
  files  @4;  # raw filesystem
  graph  @5;  # RyuGraph property-graph store
}

struct Row {
  # One result row from a SQL/column/vector query.
  # Column names and values positionally aligned.
  columns @0 :List(Text);
  values  @1 :List(Value);
}

struct Value {
  # SQLite-typed value (NULL / INTEGER / REAL / TEXT / BLOB).
  union {
    null    @0 :Void;
    integer @1 :Int64;
    real    @2 :Float64;
    text    @3 :Text;
    blob    @4 :Data;
  }
}

struct KvPair {
  key   @0 :Text;
  value @1 :Data;
}
