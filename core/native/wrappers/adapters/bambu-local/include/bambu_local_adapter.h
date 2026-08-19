#ifndef BAMBU_LOCAL_ADAPTER_H
#define BAMBU_LOCAL_ADAPTER_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
 * Return codes:
 *  0  success
 * -1  invalid args / invalid handle
 * -2  execution error
 */

enum bambu_adapter_event_type {
    BAMBU_EVENT_CONNECTED = 1,
    BAMBU_EVENT_DISCONNECTED = 2,
    BAMBU_EVENT_REPORT_RAW = 10,
    BAMBU_EVENT_TELEMETRY = 11,
    BAMBU_EVENT_INFO = 12,
    BAMBU_EVENT_SYSTEM = 13,
    BAMBU_EVENT_ERROR = 14
};

enum bambu_adapter_state_code {
    BAMBU_STATE_DISCONNECTED = 0,
    BAMBU_STATE_CONNECTING = 1,
    BAMBU_STATE_CONNECTED = 2,
    BAMBU_STATE_FAILED = 3
};

enum bambu_interface_command_id {
    BAMBU_CMD_GET_VERSION = 1,
    BAMBU_CMD_PUSH_ALL = 2,
    BAMBU_CMD_START_PUSH = 3,

    BAMBU_CMD_PAUSE = 10,
    BAMBU_CMD_RESUME = 11,
    BAMBU_CMD_STOP = 12,

    BAMBU_CMD_GCODE_LINE = 20,
    BAMBU_CMD_RAW_JSON = 21
};

typedef struct bambu_interface_command {
    int32_t command_id;
    const char *text;
} bambu_interface_command_t;

typedef void (*bambu_adapter_event_cb_t)(
    void *user_data,
    int32_t event_type,
    const uint8_t *payload,
    size_t payload_len
);

void *bambu_adapter_create(void);
void bambu_adapter_destroy(void *handle);

void bambu_adapter_set_event_callback(
    void *handle,
    bambu_adapter_event_cb_t cb,
    void *user_data
);

int32_t bambu_adapter_connect(
    void *handle,
    const char *host,
    const char *serial,
    const char *access_code
);

int32_t bambu_adapter_connect_ex(
    void *handle,
    const char *host,
    uint16_t port,
    const char *serial,
    const char *access_code,
    int32_t insecure_tls,
    const char *ca_cert_path
);

int32_t bambu_adapter_disconnect(void *handle);

int32_t bambu_adapter_execute_command(
    void *handle,
    const bambu_interface_command_t *command
);

int32_t bambu_adapter_execute_command_simple(
    void *handle,
    int32_t command_id,
    const char *text
);

int32_t bambu_adapter_send_raw_json(void *handle, const char *json_payload);
int32_t bambu_adapter_send_gcode_line(void *handle, const char *gcode_line);
int32_t bambu_adapter_pause_print(void *handle);
int32_t bambu_adapter_resume_print(void *handle);
int32_t bambu_adapter_stop_print(void *handle);
int32_t bambu_adapter_request_push_all(void *handle);
int32_t bambu_adapter_request_version(void *handle);

int32_t bambu_adapter_get_state_code(void *handle);
int32_t bambu_adapter_get_state_json(void *handle, uint8_t **out_ptr, size_t *out_len);
void bambu_adapter_free_buffer(uint8_t *ptr, size_t len);

#ifdef __cplusplus
}
#endif

#endif
