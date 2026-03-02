#ifndef TRANSPORT_H
#define TRANSPORT_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Opaque handles */
typedef struct TransportRequest  TransportRequest;
typedef struct TransportResponse TransportResponse;

/* StoreType mirrors the capnp enum */
typedef enum {
    STORE_SQL    = 0,
    STORE_KV     = 1,
    STORE_COLUMN = 2,
    STORE_VECTOR = 3,
    STORE_FILES  = 4,
} StoreTypeC;

/* Value type tags returned by transport_resp_value_type() */
typedef enum {
    VALUE_NULL    = 0,
    VALUE_INTEGER = 1,
    VALUE_REAL    = 2,
    VALUE_TEXT    = 3,
    VALUE_BLOB    = 4,
} ValueTypeC;

/* ── Request constructors ──────────────────────────────────────────────────── */

TransportRequest* transport_req_ping(void);
TransportRequest* transport_req_shutdown(void);
TransportRequest* transport_req_open(const char* ms, const char* store, StoreTypeC store_type);
TransportRequest* transport_req_close(const char* ms, const char* store);
TransportRequest* transport_req_exec_sql(const char* ms, const char* store, const char* sql);
TransportRequest* transport_req_query_sql(const char* ms, const char* store, const char* sql);
TransportRequest* transport_req_size(const char* ms, const char* store);
TransportRequest* transport_req_manifest(const char* ms, const char* store);
TransportRequest* transport_req_migrate(const char* ms, const char* store, const char* migration_id);
TransportRequest* transport_req_archive(const char* ms, const char* store, const char* output_path);
TransportRequest* transport_req_kv_put(const char* ms, const char* store, const char* key, const uint8_t* value, size_t value_len);
TransportRequest* transport_req_kv_get(const char* ms, const char* store, const char* key);
TransportRequest* transport_req_kv_delete(const char* ms, const char* store, const char* key);
TransportRequest* transport_req_kv_list(const char* ms, const char* store, const char* prefix);
TransportRequest* transport_req_file_put(const char* ms, const char* store, const char* key, const uint8_t* data, size_t data_len);
TransportRequest* transport_req_file_get(const char* ms, const char* store, const char* key);
TransportRequest* transport_req_file_delete(const char* ms, const char* store, const char* key);
TransportRequest* transport_req_file_list(const char* ms, const char* store);

/* Serialize request to a flat capnp buffer. Caller must free with transport_free_buf(). */
int32_t transport_req_encode(TransportRequest* req, uint8_t** out_buf, size_t* out_len);
void    transport_req_free(TransportRequest* req);

/* ── Response decoding ─────────────────────────────────────────────────────── */

/* Decode a flat capnp buffer into a response handle. */
TransportResponse* transport_resp_decode(const uint8_t* buf, size_t len);
void               transport_resp_free(TransportResponse* resp);

/* 1 = ok, 0 = error */
int32_t     transport_resp_ok(TransportResponse* resp);
const char* transport_resp_error(TransportResponse* resp);

/* Telemetry */
uint64_t transport_resp_duration_us(TransportResponse* resp);
uint32_t transport_resp_op_count(TransportResponse* resp);

/* Scalar results */
int64_t  transport_resp_affected(TransportResponse* resp);
uint64_t transport_resp_size(TransportResponse* resp);

/* Rows (SQL / Column / Vector query) */
uint32_t    transport_resp_row_count(TransportResponse* resp);
uint32_t    transport_resp_col_count(TransportResponse* resp, uint32_t row);
const char* transport_resp_col_name(TransportResponse* resp, uint32_t row, uint32_t col);
ValueTypeC  transport_resp_value_type(TransportResponse* resp, uint32_t row, uint32_t col);
int64_t     transport_resp_value_int(TransportResponse* resp, uint32_t row, uint32_t col);
double      transport_resp_value_real(TransportResponse* resp, uint32_t row, uint32_t col);
const char* transport_resp_value_text(TransportResponse* resp, uint32_t row, uint32_t col);

/* Keys list (KV / Files) */
uint32_t    transport_resp_key_count(TransportResponse* resp);
const char* transport_resp_key_at(TransportResponse* resp, uint32_t i);

/* Found / binary data (KV get / File get) */
int32_t         transport_resp_found(TransportResponse* resp);
const uint8_t*  transport_resp_data_ptr(TransportResponse* resp);
size_t          transport_resp_data_len(TransportResponse* resp);

/* Manifest */
const char* transport_resp_manifest_name(TransportResponse* resp);
uint8_t     transport_resp_manifest_type(TransportResponse* resp);
uint32_t    transport_resp_manifest_version(TransportResponse* resp);
uint32_t    transport_resp_manifest_migration_count(TransportResponse* resp);
const char* transport_resp_manifest_migration_at(TransportResponse* resp, uint32_t i);

/* Free a buffer returned by this library */
void transport_free_buf(uint8_t* buf, size_t len);

/* ── Server-side: decode incoming request ──────────────────────────────────── */

typedef struct TransportRequestReader TransportRequestReader;

typedef enum {
    REQ_PING        = 0,
    REQ_SHUTDOWN    = 1,
    REQ_OPEN        = 2,
    REQ_CLOSE       = 3,
    REQ_EXEC_SQL    = 4,
    REQ_QUERY_SQL   = 5,
    REQ_SIZE        = 6,
    REQ_MANIFEST    = 7,
    REQ_MIGRATE     = 8,
    REQ_ARCHIVE     = 9,
    REQ_KV_PUT      = 10,
    REQ_KV_GET      = 11,
    REQ_KV_DELETE   = 12,
    REQ_KV_LIST     = 13,
    REQ_FILE_PUT    = 14,
    REQ_FILE_GET    = 15,
    REQ_FILE_DELETE = 16,
    REQ_FILE_LIST   = 17,
    REQ_VEC_SEARCH  = 18,
} RequestCmd;

TransportRequestReader* transport_req_reader_decode(const uint8_t* buf, size_t len);
void        transport_req_reader_free(TransportRequestReader* r);
RequestCmd  transport_req_reader_cmd(TransportRequestReader* r);
const char* transport_req_reader_ms(TransportRequestReader* r);
const char* transport_req_reader_store(TransportRequestReader* r);
StoreTypeC  transport_req_reader_store_type(TransportRequestReader* r);
const char* transport_req_reader_sql(TransportRequestReader* r);
const char* transport_req_reader_migration_id(TransportRequestReader* r);
const char* transport_req_reader_output_path(TransportRequestReader* r);
const char* transport_req_reader_key(TransportRequestReader* r);
const uint8_t* transport_req_reader_value_ptr(TransportRequestReader* r);
size_t      transport_req_reader_value_len(TransportRequestReader* r);
const char* transport_req_reader_prefix(TransportRequestReader* r);

/* ── Server-side: encode outgoing response ─────────────────────────────────── */

typedef struct { uint64_t dur_us; uint32_t op_count; } TelemetryC;

int32_t transport_encode_ok(uint8_t** out, size_t* out_len, TelemetryC tel);
int32_t transport_encode_error(uint8_t** out, size_t* out_len, const char* error);
int32_t transport_encode_affected(uint8_t** out, size_t* out_len, TelemetryC tel, int64_t affected);
int32_t transport_encode_size(uint8_t** out, size_t* out_len, TelemetryC tel, uint64_t size);
int32_t transport_encode_found(uint8_t** out, size_t* out_len, TelemetryC tel,
                               int32_t found, const uint8_t* data, size_t data_len);
int32_t transport_encode_keys(uint8_t** out, size_t* out_len, TelemetryC tel,
                              const char** keys, uint32_t key_count);
/* data: raw bytes payload (e.g. JSON-encoded rows for SQL queries) */
int32_t transport_encode_data(uint8_t** out, size_t* out_len, TelemetryC tel,
                              const uint8_t* data, size_t data_len);
int32_t transport_encode_manifest(uint8_t** out, size_t* out_len, TelemetryC tel,
                                  const char* name, uint8_t store_type, uint32_t version,
                                  const char** migrations, uint32_t mig_count);

#ifdef __cplusplus
}
#endif

#endif /* TRANSPORT_H */
