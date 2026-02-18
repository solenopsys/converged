#ifndef MARLIN_OCTOPRINT_ADAPTER_H
#define MARLIN_OCTOPRINT_ADAPTER_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Return codes: 0 success, -1 invalid handle/args, -2 execution error */

enum marlin_heater_kind {
    MARLIN_HEATER_CURRENT_TOOL = 0,
    MARLIN_HEATER_TOOL = 1,
    MARLIN_HEATER_BED = 2,
    MARLIN_HEATER_CHAMBER = 3
};

enum marlin_interface_flags {
    MARLIN_FLAG_JOG_ABSOLUTE = 1u << 0
};

enum marlin_axis_mask {
    MARLIN_AXIS_X = 1u << 0,
    MARLIN_AXIS_Y = 1u << 1,
    MARLIN_AXIS_Z = 1u << 2
};

enum marlin_interface_command_id {
    MARLIN_CMD_JOB_START = 1,
    MARLIN_CMD_JOB_RESTART = 2,
    MARLIN_CMD_JOB_PAUSE = 3,
    MARLIN_CMD_JOB_RESUME = 4,
    MARLIN_CMD_JOB_TOGGLE_PAUSE = 5,
    MARLIN_CMD_JOB_CANCEL = 6,

    MARLIN_CMD_PRINTHEAD_JOG = 10,
    MARLIN_CMD_PRINTHEAD_HOME = 11,
    MARLIN_CMD_PRINTHEAD_FEEDRATE = 12,

    MARLIN_CMD_TOOL_SELECT = 20,
    MARLIN_CMD_TOOL_TARGET = 21,
    MARLIN_CMD_TOOL_OFFSET = 22,
    MARLIN_CMD_TOOL_EXTRUDE = 23,
    MARLIN_CMD_TOOL_FLOWRATE = 24,

    MARLIN_CMD_BED_TARGET = 30,
    MARLIN_CMD_BED_OFFSET = 31,
    MARLIN_CMD_CHAMBER_TARGET = 32,
    MARLIN_CMD_CHAMBER_OFFSET = 33,

    MARLIN_CMD_SD_INIT = 40,
    MARLIN_CMD_SD_REFRESH = 41,
    MARLIN_CMD_SD_RELEASE = 42,

    MARLIN_CMD_CONNECTION_REPAIR = 50,
    MARLIN_CMD_EMERGENCY_STOP = 51,

    MARLIN_CMD_RAW_GCODE = 60,
    MARLIN_CMD_RAW_SCRIPT = 61
};

typedef struct marlin_interface_command {
    int32_t command_id;
    uint32_t flags;
    uint32_t axis_mask;
    int32_t tool;
    int32_t heater;
    double value_a;
    double value_b;
    double value_c;
    double value_d;
    const char *text;
} marlin_interface_command_t;

void *marlin_adapter_create(void);
void marlin_adapter_destroy(void *handle);

int32_t marlin_adapter_connect(void *handle, const char *port, uint32_t baudrate);
int32_t marlin_adapter_disconnect(void *handle);

int32_t marlin_adapter_queue_gcode(void *handle, const char *gcode);
int32_t marlin_adapter_execute_command(void *handle, const marlin_interface_command_t *command);
int32_t marlin_adapter_execute_command_simple(
    void *handle,
    int32_t command_id,
    uint32_t flags,
    uint32_t axis_mask,
    int32_t tool,
    int32_t heater,
    double value_a,
    double value_b,
    double value_c,
    double value_d,
    const char *text
);

int32_t marlin_adapter_load_print_file(void *handle, const char *path);
int32_t marlin_adapter_start_print(void *handle);
int32_t marlin_adapter_pause_print(void *handle);
int32_t marlin_adapter_resume_print(void *handle);
int32_t marlin_adapter_cancel_print(void *handle);

int32_t marlin_adapter_get_state_json(void *handle, uint8_t **out_ptr, size_t *out_len);
int32_t marlin_adapter_get_state_code(void *handle);
void marlin_adapter_free_buffer(uint8_t *ptr, size_t len);

#ifdef __cplusplus
}
#endif

#endif
