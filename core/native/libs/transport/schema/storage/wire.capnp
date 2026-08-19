@0xa1b2c3d4e5f6000f;

# On-wire serialization for the Unix socket transport.
# Framing: 4-byte LE length prefix before each capnp flat-array message.
# Bun → storage: Request.  Storage → Bun: Response.

enum StoreType {
  sql    @0;
  kv     @1;
  column @2;
  vector @3;
  files  @4;
  graph  @5;
}

struct Telemetry {
  durationUs   @0 :UInt64;
  opCount      @1 :UInt32;
  bytesRead    @2 :UInt64;
  bytesWritten @3 :UInt64;
}

struct Request {
  ms    @0 :Text;
  store @1 :Text;

  body :union {
    ping        @2  :Void;
    shutdown    @3  :Void;
    open        @4  :Void;
    close       @5  :Void;
    execSql     @6  :SqlBody;
    querySql    @7  :SqlBody;
    size        @8  :Void;
    manifest    @9  :Void;
    migrate     @10 :MigrateBody;
    archive     @11 :ArchiveBody;
    kvPut       @12 :KvPutBody;
    kvGet       @13 :KvKeyBody;
    kvDelete    @14 :KvKeyBody;
    kvList      @15 :KvListBody;
    filePut     @16 :FilePutBody;
    fileGetToCache @17 :FileKeyBody;
    fileDelete  @18 :FileKeyBody;
    fileList    @19 :Void;
    vecSearch   @20 :VecSearchBody;
    kvCompact   @21 :Void;
    dumpCreate  @22 :Void;
    dumpList    @23 :Void;
    dumpDelete  @24 :DumpDeleteBody;
    dumpRead    @25 :DumpReadBody;
    create      @26 :CreateBody;
    storeStats  @27 :Void;
    kvPutFromCache @28 :KvCacheRefBody;
    kvGetToCache   @29 :KvKeyBody;
  }

  struct CreateBody    { storeType @0 :StoreType; }
  struct SqlBody       { sql @0 :Text; }
  struct MigrateBody   { migrationId @0 :Text; }
  struct ArchiveBody   { outputPath @0 :Text; }
  struct KvPutBody     { key @0 :Text; value @1 :Data; }
  struct KvKeyBody     { key @0 :Text; }
  struct KvCacheRefBody { key @0 :Text; cacheKey @1 :Text; }
  struct KvListBody    { prefix @0 :Text; }
  struct FilePutBody   { key @0 :Text; data @1 :Data; }
  struct FileKeyBody   { key @0 :Text; }
  struct VecSearchBody {
    table        @0 :Text;
    vectorColumn @1 :Text;
    queryVector  @2 :List(Float32);
    limit        @3 :UInt32;
  }
  struct DumpDeleteBody { fileName @0 :Text; }
  struct DumpReadBody   { fileName @0 :Text; offset @1 :UInt64; length @2 :UInt32; }
}

struct Response {
  telemetry @0 :Telemetry;

  result :union {
    error    @1  :Text;
    empty    @2  :Void;
    rows     @3  :List(Row);
    data     @4  :Data;
    size     @5  :UInt64;
    keys     @6  :List(Text);
    manifest @7  :ManifestData;
    found    @8  :FoundData;
    affected @9  :Int64;
    search     @10 :List(SearchResult);
    pairs      @11 :List(KvPair);
    storeStats @12 :StoreStatData;
  }

  struct StoreStatData {
    cacheBytes @0 :UInt64;  # RAM: SQLite page cache or LMDBX mapped used pages
    diskBytes  @1 :UInt64;  # on-disk file size
  }

  struct KvPair {
    key   @0 :Text;
    value @1 :Data;
  }

  struct Row {
    columns @0 :List(Text);
    values  @1 :List(Value);
  }

  struct Value {
    union {
      null    @0 :Void;
      integer @1 :Int64;
      real    @2 :Float64;
      text    @3 :Text;
      blob    @4 :Data;
    }
  }

  struct ManifestData {
    name         @0 :Text;
    storeType    @1 :StoreType;
    dataLocation @2 :Text;
    version      @3 :UInt32;
    migrations   @4 :List(Text);
  }

  struct FoundData {
    found @0 :Bool;
    data  @1 :Data;
  }

  struct SearchResult {
    row   @0 :Row;
    score @1 :Float64;
  }
}
