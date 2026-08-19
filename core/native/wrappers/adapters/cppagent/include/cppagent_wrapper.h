#ifndef CPPAGENT_WRAPPER_H
#define CPPAGENT_WRAPPER_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
Return codes:
  0   success
  -1  invalid handle/arguments
  -2  runtime failure (check last error)
*/

void *cppagent_wrapper_create(void);
void cppagent_wrapper_destroy(void *handle);

/*
Starts cppagent process:
  <agent_bin> run <config_path>

Arguments:
  agent_bin: path to cppagent executable (required)
  config_path: path to agent config file (required)
  work_dir: process working directory, nullable
  host/port/probe_path: endpoint used by health-check
  wait_ready_timeout_ms:
    0 => do not wait readiness
    >0 => wait until endpoint responds 2xx, otherwise stop and fail
*/
int32_t cppagent_wrapper_start(
    void *handle,
    const char *agent_bin,
    const char *config_path,
    const char *work_dir,
    const char *host,
    uint16_t port,
    const char *probe_path,
    uint32_t wait_ready_timeout_ms
);

/*
Stops running process:
  SIGTERM -> wait timeout_ms -> SIGKILL
*/
int32_t cppagent_wrapper_stop(void *handle, uint32_t timeout_ms);

/*
Returns:
  1 running
  0 not running
 -1 invalid handle
*/
int32_t cppagent_wrapper_is_running(void *handle);

/*
Returns:
  >0 process pid
   0 not running
  -1 invalid handle
*/
int32_t cppagent_wrapper_pid(void *handle);

/*
Health check against configured endpoint (GET probe_path):
  1 healthy (HTTP 2xx)
  0 not healthy
 -1 invalid handle
*/
int32_t cppagent_wrapper_check_health(void *handle);

/*
Gets last error text as allocated buffer.
Use cppagent_wrapper_free_buffer to free.
*/
int32_t cppagent_wrapper_get_last_error(void *handle, uint8_t **out_ptr, size_t *out_len);
void cppagent_wrapper_free_buffer(uint8_t *ptr, size_t len);

#ifdef __cplusplus
}
#endif

#endif
