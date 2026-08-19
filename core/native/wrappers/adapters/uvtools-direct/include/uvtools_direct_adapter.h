#ifndef UVTOOLS_DIRECT_ADAPTER_H
#define UVTOOLS_DIRECT_ADAPTER_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
 * Return codes:
 *  0  success (process exited with code 0)
 * -1  invalid args / invalid handle
 * -2  adapter execution error (spawn/io/internal)
 * -3  process finished with non-zero exit code
 * -4  process timed out
 */

enum uvtools_adapter_state_code {
    UVTOOLS_STATE_IDLE = 0,
    UVTOOLS_STATE_RUNNING = 1,
    UVTOOLS_STATE_FAILED = 2
};

enum uvtools_interface_command_id {
    UVTOOLS_CMD_SET_PROPERTIES = 1,
    UVTOOLS_CMD_RUN = 2,
    UVTOOLS_CMD_CONVERT = 3,
    UVTOOLS_CMD_EXTRACT = 4,
    UVTOOLS_CMD_COPY_PARAMETERS = 5,
    UVTOOLS_CMD_SET_THUMBNAIL = 6,
    UVTOOLS_CMD_COMPARE = 7,
    UVTOOLS_CMD_PRINT_ISSUES = 8,
    UVTOOLS_CMD_PRINT_PROPERTIES = 9,
    UVTOOLS_CMD_PRINT_GCODE = 10,
    UVTOOLS_CMD_PRINT_MACHINES = 11,
    UVTOOLS_CMD_PRINT_FORMATS = 12,
    UVTOOLS_CMD_BENCHMARK_LAYER_CODECS = 13,
    UVTOOLS_CMD_RAW = 100
};

typedef struct uvtools_interface_command {
    int32_t command_id;
    const char *input_path;
    const char *secondary_path;
    const char *output_path;
    const char *extra_args;
} uvtools_interface_command_t;

void *uvtools_adapter_create(void);
void uvtools_adapter_destroy(void *handle);

int32_t uvtools_adapter_set_executable(void *handle, const char *executable_path);
int32_t uvtools_adapter_set_workdir(void *handle, const char *workdir_path);
int32_t uvtools_adapter_set_timeout_ms(void *handle, uint32_t timeout_ms);
int32_t uvtools_adapter_set_max_output_bytes(void *handle, uint64_t max_output_bytes);

/* argv does NOT include executable; first element is command, e.g. "convert" */
int32_t uvtools_adapter_execute_argv(
    void *handle,
    const char *const *argv,
    size_t argc
);

/* Example: "convert input.ctb ctb out.pwmo --version 4" */
int32_t uvtools_adapter_execute_raw(void *handle, const char *raw_args_line);

int32_t uvtools_adapter_execute_command(
    void *handle,
    const uvtools_interface_command_t *command
);

int32_t uvtools_adapter_execute_command_simple(
    void *handle,
    int32_t command_id,
    const char *input_path,
    const char *secondary_path,
    const char *output_path,
    const char *extra_args
);

int32_t uvtools_adapter_convert(
    void *handle,
    const char *input_path,
    const char *target_type_or_ext,
    const char *output_path,
    const char *extra_args
);

int32_t uvtools_adapter_extract(
    void *handle,
    const char *input_path,
    const char *output_dir,
    const char *extra_args
);

int32_t uvtools_adapter_run(
    void *handle,
    const char *input_path,
    const char *classes_or_files,
    const char *extra_args
);

int32_t uvtools_adapter_compare(
    void *handle,
    const char *input_path_a,
    const char *input_path_b,
    const char *extra_args
);

int32_t uvtools_adapter_print_issues(
    void *handle,
    const char *input_path,
    const char *extra_args
);

int32_t uvtools_adapter_print_properties(
    void *handle,
    const char *input_path,
    const char *extra_args
);

int32_t uvtools_adapter_print_gcode(
    void *handle,
    const char *input_path,
    const char *extra_args
);

int32_t uvtools_adapter_get_state_code(void *handle);
int32_t uvtools_adapter_get_last_exit_code(void *handle);
int32_t uvtools_adapter_get_last_success(void *handle);
int32_t uvtools_adapter_get_last_timed_out(void *handle);

int32_t uvtools_adapter_get_last_stdout(void *handle, uint8_t **out_ptr, size_t *out_len);
int32_t uvtools_adapter_get_last_stderr(void *handle, uint8_t **out_ptr, size_t *out_len);
int32_t uvtools_adapter_get_last_error(void *handle, uint8_t **out_ptr, size_t *out_len);
int32_t uvtools_adapter_get_last_args(void *handle, uint8_t **out_ptr, size_t *out_len);
int32_t uvtools_adapter_get_state_json(void *handle, uint8_t **out_ptr, size_t *out_len);

void uvtools_adapter_free_buffer(uint8_t *ptr, size_t len);

#ifdef __cplusplus
}
#endif

#endif
