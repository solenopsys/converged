// C++ wrapper around capnp-generated wire types.
// Exposes an extern "C" API so Zig can @cImport("../include/transport.h").
// This file requires src/generated/wire.capnp.h to be present (run generate.sh first).

#include "../include/transport.h"
#include "generated/wire.capnp.h"

#include <capnp/message.h>
#include <capnp/serialize.h>
#include <kj/array.h>

#include <cstring>
#include <cstdlib>
#include <string>

// ── Internal structs ──────────────────────────────────────────────────────────

struct TransportRequest {
    capnp::MallocMessageBuilder message;
    Request::Builder            req;
    TransportRequest() : req(message.initRoot<Request>()) {}
};

struct TransportResponse {
    kj::Array<capnp::word>        words;
    capnp::FlatArrayMessageReader reader;
    Response::Reader              resp;
    std::string                   err_cache;

    explicit TransportResponse(kj::Array<capnp::word> w)
        : words(kj::mv(w))
        , reader(words)
        , resp(reader.getRoot<Response>())
    {}
};

// ── Helpers ───────────────────────────────────────────────────────────────────

static TransportRequest* make_req(const char* ms, const char* store) {
    auto* r = new TransportRequest();
    if (ms)    r->req.setMs(ms);
    if (store) r->req.setStore(store);
    return r;
}

// ── Request constructors ──────────────────────────────────────────────────────

extern "C" TransportRequest* transport_req_ping(void) {
    auto* r = new TransportRequest();
    r->req.getBody().setPing();
    return r;
}

extern "C" TransportRequest* transport_req_shutdown(void) {
    auto* r = new TransportRequest();
    r->req.getBody().setShutdown();
    return r;
}

extern "C" TransportRequest* transport_req_open(const char* ms, const char* store, StoreTypeC store_type) {
    auto* r = make_req(ms, store);
    r->req.getBody().initOpen().setStoreType(static_cast<StoreType>(store_type));
    return r;
}

extern "C" TransportRequest* transport_req_close(const char* ms, const char* store) {
    auto* r = make_req(ms, store);
    r->req.getBody().setClose();
    return r;
}

extern "C" TransportRequest* transport_req_exec_sql(const char* ms, const char* store, const char* sql) {
    auto* r = make_req(ms, store);
    r->req.getBody().initExecSql().setSql(sql);
    return r;
}

extern "C" TransportRequest* transport_req_query_sql(const char* ms, const char* store, const char* sql) {
    auto* r = make_req(ms, store);
    r->req.getBody().initQuerySql().setSql(sql);
    return r;
}

extern "C" TransportRequest* transport_req_size(const char* ms, const char* store) {
    auto* r = make_req(ms, store);
    r->req.getBody().setSize();
    return r;
}

extern "C" TransportRequest* transport_req_manifest(const char* ms, const char* store) {
    auto* r = make_req(ms, store);
    r->req.getBody().setManifest();
    return r;
}

extern "C" TransportRequest* transport_req_migrate(const char* ms, const char* store, const char* migration_id) {
    auto* r = make_req(ms, store);
    r->req.getBody().initMigrate().setMigrationId(migration_id);
    return r;
}

extern "C" TransportRequest* transport_req_archive(const char* ms, const char* store, const char* output_path) {
    auto* r = make_req(ms, store);
    r->req.getBody().initArchive().setOutputPath(output_path);
    return r;
}

extern "C" TransportRequest* transport_req_kv_put(const char* ms, const char* store,
                                                   const char* key, const uint8_t* value, size_t value_len) {
    auto* r = make_req(ms, store);
    auto body = r->req.getBody().initKvPut();
    body.setKey(key);
    body.setValue(kj::arrayPtr(reinterpret_cast<const kj::byte*>(value), value_len));
    return r;
}

extern "C" TransportRequest* transport_req_kv_get(const char* ms, const char* store, const char* key) {
    auto* r = make_req(ms, store);
    r->req.getBody().initKvGet().setKey(key);
    return r;
}

extern "C" TransportRequest* transport_req_kv_delete(const char* ms, const char* store, const char* key) {
    auto* r = make_req(ms, store);
    r->req.getBody().initKvDelete().setKey(key);
    return r;
}

extern "C" TransportRequest* transport_req_kv_list(const char* ms, const char* store, const char* prefix) {
    auto* r = make_req(ms, store);
    r->req.getBody().initKvList().setPrefix(prefix ? prefix : "");
    return r;
}

extern "C" TransportRequest* transport_req_file_put(const char* ms, const char* store,
                                                     const char* key, const uint8_t* data, size_t data_len) {
    auto* r = make_req(ms, store);
    auto body = r->req.getBody().initFilePut();
    body.setKey(key);
    body.setData(kj::arrayPtr(reinterpret_cast<const kj::byte*>(data), data_len));
    return r;
}

extern "C" TransportRequest* transport_req_file_get(const char* ms, const char* store, const char* key) {
    auto* r = make_req(ms, store);
    r->req.getBody().initFileGet().setKey(key);
    return r;
}

extern "C" TransportRequest* transport_req_file_delete(const char* ms, const char* store, const char* key) {
    auto* r = make_req(ms, store);
    r->req.getBody().initFileDelete().setKey(key);
    return r;
}

extern "C" TransportRequest* transport_req_file_list(const char* ms, const char* store) {
    auto* r = make_req(ms, store);
    r->req.getBody().setFileList();
    return r;
}

// ── Encode / free request ─────────────────────────────────────────────────────

extern "C" int32_t transport_req_encode(TransportRequest* req, uint8_t** out_buf, size_t* out_len) {
    if (!req || !out_buf || !out_len) return -1;
    try {
        auto flat  = capnp::messageToFlatArray(req->message);
        auto bytes = flat.asBytes();
        size_t len = bytes.size();
        auto*  buf = static_cast<uint8_t*>(malloc(len));
        if (!buf) return -1;
        memcpy(buf, bytes.begin(), len);
        *out_buf = buf;
        *out_len = len;
        return 0;
    } catch (...) { return -1; }
}

extern "C" void transport_req_free(TransportRequest* req) { delete req; }

// ── Decode response ───────────────────────────────────────────────────────────

extern "C" TransportResponse* transport_resp_decode(const uint8_t* buf, size_t len) {
    if (!buf || len == 0 || len % sizeof(capnp::word) != 0) return nullptr;
    try {
        size_t word_count = len / sizeof(capnp::word);
        auto   words      = kj::heapArray<capnp::word>(word_count);
        memcpy(words.begin(), buf, len);
        return new TransportResponse(kj::mv(words));
    } catch (...) { return nullptr; }
}

extern "C" void transport_resp_free(TransportResponse* resp) { delete resp; }

// ── Response accessors ────────────────────────────────────────────────────────

extern "C" int32_t transport_resp_ok(TransportResponse* resp) {
    if (!resp) return 0;
    return resp->resp.getResult().which() != Response::Result::ERROR ? 1 : 0;
}

extern "C" const char* transport_resp_error(TransportResponse* resp) {
    if (!resp) return nullptr;
    if (resp->resp.getResult().which() != Response::Result::ERROR) return nullptr;
    resp->err_cache = resp->resp.getResult().getError().cStr();
    return resp->err_cache.c_str();
}

extern "C" uint64_t transport_resp_duration_us(TransportResponse* resp) {
    return resp ? resp->resp.getTelemetry().getDurationUs() : 0;
}

extern "C" uint32_t transport_resp_op_count(TransportResponse* resp) {
    return resp ? resp->resp.getTelemetry().getOpCount() : 0;
}

extern "C" int64_t transport_resp_affected(TransportResponse* resp) {
    if (!resp || resp->resp.getResult().which() != Response::Result::AFFECTED) return 0;
    return resp->resp.getResult().getAffected();
}

extern "C" uint64_t transport_resp_size(TransportResponse* resp) {
    if (!resp || resp->resp.getResult().which() != Response::Result::SIZE) return 0;
    return resp->resp.getResult().getSize();
}

extern "C" uint32_t transport_resp_row_count(TransportResponse* resp) {
    if (!resp || resp->resp.getResult().which() != Response::Result::ROWS) return 0;
    return resp->resp.getResult().getRows().size();
}

extern "C" uint32_t transport_resp_col_count(TransportResponse* resp, uint32_t row) {
    if (!resp || resp->resp.getResult().which() != Response::Result::ROWS) return 0;
    auto rows = resp->resp.getResult().getRows();
    if (row >= rows.size()) return 0;
    return rows[row].getColumns().size();
}

extern "C" const char* transport_resp_col_name(TransportResponse* resp, uint32_t row, uint32_t col) {
    if (!resp || resp->resp.getResult().which() != Response::Result::ROWS) return nullptr;
    auto rows = resp->resp.getResult().getRows();
    if (row >= rows.size()) return nullptr;
    auto cols = rows[row].getColumns();
    if (col >= cols.size()) return nullptr;
    return cols[col].cStr();
}

extern "C" ValueTypeC transport_resp_value_type(TransportResponse* resp, uint32_t row, uint32_t col) {
    if (!resp || resp->resp.getResult().which() != Response::Result::ROWS) return VALUE_NULL;
    auto rows = resp->resp.getResult().getRows();
    if (row >= rows.size()) return VALUE_NULL;
    auto vals = rows[row].getValues();
    if (col >= vals.size()) return VALUE_NULL;
    return static_cast<ValueTypeC>(vals[col].which());
}

extern "C" int64_t transport_resp_value_int(TransportResponse* resp, uint32_t row, uint32_t col) {
    if (!resp || resp->resp.getResult().which() != Response::Result::ROWS) return 0;
    auto rows = resp->resp.getResult().getRows();
    if (row >= rows.size()) return 0;
    auto vals = rows[row].getValues();
    if (col >= vals.size() || vals[col].which() != Response::Value::INTEGER) return 0;
    return vals[col].getInteger();
}

extern "C" double transport_resp_value_real(TransportResponse* resp, uint32_t row, uint32_t col) {
    if (!resp || resp->resp.getResult().which() != Response::Result::ROWS) return 0.0;
    auto rows = resp->resp.getResult().getRows();
    if (row >= rows.size()) return 0.0;
    auto vals = rows[row].getValues();
    if (col >= vals.size() || vals[col].which() != Response::Value::REAL) return 0.0;
    return vals[col].getReal();
}

extern "C" const char* transport_resp_value_text(TransportResponse* resp, uint32_t row, uint32_t col) {
    if (!resp || resp->resp.getResult().which() != Response::Result::ROWS) return nullptr;
    auto rows = resp->resp.getResult().getRows();
    if (row >= rows.size()) return nullptr;
    auto vals = rows[row].getValues();
    if (col >= vals.size() || vals[col].which() != Response::Value::TEXT) return nullptr;
    return vals[col].getText().cStr();
}

extern "C" uint32_t transport_resp_key_count(TransportResponse* resp) {
    if (!resp || resp->resp.getResult().which() != Response::Result::KEYS) return 0;
    return resp->resp.getResult().getKeys().size();
}

extern "C" const char* transport_resp_key_at(TransportResponse* resp, uint32_t i) {
    if (!resp || resp->resp.getResult().which() != Response::Result::KEYS) return nullptr;
    auto keys = resp->resp.getResult().getKeys();
    if (i >= keys.size()) return nullptr;
    return keys[i].cStr();
}

extern "C" int32_t transport_resp_found(TransportResponse* resp) {
    if (!resp || resp->resp.getResult().which() != Response::Result::FOUND) return 0;
    return resp->resp.getResult().getFound().getFound() ? 1 : 0;
}

extern "C" const uint8_t* transport_resp_data_ptr(TransportResponse* resp) {
    if (!resp) return nullptr;
    if (resp->resp.getResult().which() == Response::Result::FOUND) {
        auto f = resp->resp.getResult().getFound();
        return f.getFound() ? reinterpret_cast<const uint8_t*>(f.getData().begin()) : nullptr;
    }
    if (resp->resp.getResult().which() == Response::Result::DATA) {
        return reinterpret_cast<const uint8_t*>(resp->resp.getResult().getData().begin());
    }
    return nullptr;
}

extern "C" size_t transport_resp_data_len(TransportResponse* resp) {
    if (!resp) return 0;
    if (resp->resp.getResult().which() == Response::Result::FOUND) {
        auto f = resp->resp.getResult().getFound();
        return f.getFound() ? f.getData().size() : 0;
    }
    if (resp->resp.getResult().which() == Response::Result::DATA) {
        return resp->resp.getResult().getData().size();
    }
    return 0;
}

extern "C" const char* transport_resp_manifest_name(TransportResponse* resp) {
    if (!resp || resp->resp.getResult().which() != Response::Result::MANIFEST) return nullptr;
    return resp->resp.getResult().getManifest().getName().cStr();
}

extern "C" uint8_t transport_resp_manifest_type(TransportResponse* resp) {
    if (!resp || resp->resp.getResult().which() != Response::Result::MANIFEST) return 0;
    return static_cast<uint8_t>(resp->resp.getResult().getManifest().getStoreType());
}

extern "C" uint32_t transport_resp_manifest_version(TransportResponse* resp) {
    if (!resp || resp->resp.getResult().which() != Response::Result::MANIFEST) return 0;
    return resp->resp.getResult().getManifest().getVersion();
}

extern "C" uint32_t transport_resp_manifest_migration_count(TransportResponse* resp) {
    if (!resp || resp->resp.getResult().which() != Response::Result::MANIFEST) return 0;
    return resp->resp.getResult().getManifest().getMigrations().size();
}

extern "C" const char* transport_resp_manifest_migration_at(TransportResponse* resp, uint32_t i) {
    if (!resp || resp->resp.getResult().which() != Response::Result::MANIFEST) return nullptr;
    auto migs = resp->resp.getResult().getManifest().getMigrations();
    if (i >= migs.size()) return nullptr;
    return migs[i].cStr();
}

extern "C" void transport_free_buf(uint8_t* buf, size_t /*len*/) { free(buf); }

// ── Server-side: decode incoming request ──────────────────────────────────────

struct TransportRequestReader {
    kj::Array<capnp::word>        words;
    capnp::FlatArrayMessageReader reader;
    Request::Reader               req;
    explicit TransportRequestReader(kj::Array<capnp::word> w)
        : words(kj::mv(w)), reader(words), req(reader.getRoot<Request>()) {}
};

extern "C" TransportRequestReader* transport_req_reader_decode(const uint8_t* buf, size_t len) {
    if (!buf || len == 0 || len % sizeof(capnp::word) != 0) return nullptr;
    try {
        size_t wc = len / sizeof(capnp::word);
        auto words = kj::heapArray<capnp::word>(wc);
        memcpy(words.begin(), buf, len);
        return new TransportRequestReader(kj::mv(words));
    } catch (...) { return nullptr; }
}

extern "C" void transport_req_reader_free(TransportRequestReader* r) { delete r; }

extern "C" RequestCmd transport_req_reader_cmd(TransportRequestReader* r) {
    if (!r) return REQ_PING;
    return static_cast<RequestCmd>(r->req.getBody().which());
}

extern "C" const char* transport_req_reader_ms(TransportRequestReader* r) {
    return r ? r->req.getMs().cStr() : "";
}
extern "C" const char* transport_req_reader_store(TransportRequestReader* r) {
    return r ? r->req.getStore().cStr() : "";
}

extern "C" StoreTypeC transport_req_reader_store_type(TransportRequestReader* r) {
    if (!r || r->req.getBody().which() != Request::Body::OPEN) return STORE_SQL;
    return static_cast<StoreTypeC>(r->req.getBody().getOpen().getStoreType());
}
extern "C" const char* transport_req_reader_sql(TransportRequestReader* r) {
    if (!r) return "";
    auto which = r->req.getBody().which();
    if (which == Request::Body::EXEC_SQL)  return r->req.getBody().getExecSql().getSql().cStr();
    if (which == Request::Body::QUERY_SQL) return r->req.getBody().getQuerySql().getSql().cStr();
    return "";
}
extern "C" const char* transport_req_reader_migration_id(TransportRequestReader* r) {
    if (!r || r->req.getBody().which() != Request::Body::MIGRATE) return "";
    return r->req.getBody().getMigrate().getMigrationId().cStr();
}
extern "C" const char* transport_req_reader_output_path(TransportRequestReader* r) {
    if (!r || r->req.getBody().which() != Request::Body::ARCHIVE) return "";
    return r->req.getBody().getArchive().getOutputPath().cStr();
}
extern "C" const char* transport_req_reader_key(TransportRequestReader* r) {
    if (!r) return "";
    auto which = r->req.getBody().which();
    if (which == Request::Body::KV_PUT)      return r->req.getBody().getKvPut().getKey().cStr();
    if (which == Request::Body::KV_GET)      return r->req.getBody().getKvGet().getKey().cStr();
    if (which == Request::Body::KV_DELETE)   return r->req.getBody().getKvDelete().getKey().cStr();
    if (which == Request::Body::FILE_PUT)    return r->req.getBody().getFilePut().getKey().cStr();
    if (which == Request::Body::FILE_GET)    return r->req.getBody().getFileGet().getKey().cStr();
    if (which == Request::Body::FILE_DELETE) return r->req.getBody().getFileDelete().getKey().cStr();
    return "";
}
extern "C" const uint8_t* transport_req_reader_value_ptr(TransportRequestReader* r) {
    if (!r) return nullptr;
    auto which = r->req.getBody().which();
    if (which == Request::Body::KV_PUT)   return reinterpret_cast<const uint8_t*>(r->req.getBody().getKvPut().getValue().begin());
    if (which == Request::Body::FILE_PUT) return reinterpret_cast<const uint8_t*>(r->req.getBody().getFilePut().getData().begin());
    return nullptr;
}
extern "C" size_t transport_req_reader_value_len(TransportRequestReader* r) {
    if (!r) return 0;
    auto which = r->req.getBody().which();
    if (which == Request::Body::KV_PUT)   return r->req.getBody().getKvPut().getValue().size();
    if (which == Request::Body::FILE_PUT) return r->req.getBody().getFilePut().getData().size();
    return 0;
}
extern "C" const char* transport_req_reader_prefix(TransportRequestReader* r) {
    if (!r || r->req.getBody().which() != Request::Body::KV_LIST) return "";
    return r->req.getBody().getKvList().getPrefix().cStr();
}

// ── Server-side: encode outgoing response ────────────────────────────────────

static void setTelemetry(Response::Builder& resp, TelemetryC tel) {
    auto t = resp.getTelemetry();
    t.setDurationUs(tel.dur_us);
    t.setOpCount(tel.op_count);
}

static int32_t encodeResponse(capnp::MallocMessageBuilder& msg, uint8_t** out, size_t* out_len) {
    try {
        auto flat  = capnp::messageToFlatArray(msg);
        auto bytes = flat.asBytes();
        size_t len = bytes.size();
        auto*  buf = static_cast<uint8_t*>(malloc(len));
        if (!buf) return -1;
        memcpy(buf, bytes.begin(), len);
        *out = buf; *out_len = len;
        return 0;
    } catch (...) { return -1; }
}

extern "C" int32_t transport_encode_ok(uint8_t** out, size_t* out_len, TelemetryC tel) {
    capnp::MallocMessageBuilder msg;
    auto resp = msg.initRoot<Response>();
    setTelemetry(resp, tel);
    resp.getResult().setEmpty();
    return encodeResponse(msg, out, out_len);
}

extern "C" int32_t transport_encode_error(uint8_t** out, size_t* out_len, const char* error) {
    capnp::MallocMessageBuilder msg;
    auto resp = msg.initRoot<Response>();
    resp.getResult().setError(error ? error : "unknown error");
    return encodeResponse(msg, out, out_len);
}

extern "C" int32_t transport_encode_affected(uint8_t** out, size_t* out_len, TelemetryC tel, int64_t affected) {
    capnp::MallocMessageBuilder msg;
    auto resp = msg.initRoot<Response>();
    setTelemetry(resp, tel);
    resp.getResult().setAffected(affected);
    return encodeResponse(msg, out, out_len);
}

extern "C" int32_t transport_encode_size(uint8_t** out, size_t* out_len, TelemetryC tel, uint64_t size) {
    capnp::MallocMessageBuilder msg;
    auto resp = msg.initRoot<Response>();
    setTelemetry(resp, tel);
    resp.getResult().setSize(size);
    return encodeResponse(msg, out, out_len);
}

extern "C" int32_t transport_encode_found(uint8_t** out, size_t* out_len, TelemetryC tel,
                                           int32_t found, const uint8_t* data, size_t data_len) {
    capnp::MallocMessageBuilder msg;
    auto resp = msg.initRoot<Response>();
    setTelemetry(resp, tel);
    auto f = resp.getResult().initFound();
    f.setFound(found != 0);
    if (found && data && data_len > 0)
        f.setData(kj::arrayPtr(reinterpret_cast<const kj::byte*>(data), data_len));
    return encodeResponse(msg, out, out_len);
}

extern "C" int32_t transport_encode_keys(uint8_t** out, size_t* out_len, TelemetryC tel,
                                          const char** keys, uint32_t key_count) {
    capnp::MallocMessageBuilder msg;
    auto resp  = msg.initRoot<Response>();
    setTelemetry(resp, tel);
    auto kList = resp.getResult().initKeys(key_count);
    for (uint32_t i = 0; i < key_count; i++) kList.set(i, keys[i] ? keys[i] : "");
    return encodeResponse(msg, out, out_len);
}

extern "C" int32_t transport_encode_data(uint8_t** out, size_t* out_len, TelemetryC tel,
                                          const uint8_t* data, size_t data_len) {
    capnp::MallocMessageBuilder msg;
    auto resp = msg.initRoot<Response>();
    setTelemetry(resp, tel);
    resp.getResult().setData(kj::arrayPtr(reinterpret_cast<const kj::byte*>(data), data_len));
    return encodeResponse(msg, out, out_len);
}

extern "C" int32_t transport_encode_manifest(uint8_t** out, size_t* out_len, TelemetryC tel,
                                              const char* name, uint8_t store_type, uint32_t version,
                                              const char** migrations, uint32_t mig_count) {
    capnp::MallocMessageBuilder msg;
    auto resp = msg.initRoot<Response>();
    setTelemetry(resp, tel);
    auto m = resp.getResult().initManifest();
    m.setName(name ? name : "");
    m.setStoreType(static_cast<StoreType>(store_type));
    m.setVersion(version);
    auto migs = m.initMigrations(mig_count);
    for (uint32_t i = 0; i < mig_count; i++) migs.set(i, migrations[i] ? migrations[i] : "");
    return encodeResponse(msg, out, out_len);
}
