#ifndef OPENCAMLIB_WRAPPER_H
#define OPENCAMLIB_WRAPPER_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#if defined(__GNUC__) || defined(__clang__)
#define OPENCAMLIB_WRAPPER_API __attribute__((visibility("default")))
#else
#define OPENCAMLIB_WRAPPER_API
#endif

typedef struct {
    const uint8_t *stl_data;
    size_t stl_len;
    double tool_diameter;
    double tool_length;
    double stepover;
    double sampling;
    double min_sampling;
    double feed;
    double rapid;
    double safe_z;
    uint8_t include_gcode;
} opencamlib_milling_input;

typedef struct {
    uint32_t triangles;
    double min_x;
    double min_y;
    double min_z;
    double max_x;
    double max_y;
    double max_z;
    double safe_z;
    uint32_t passes;
    uint64_t points;
    double cut_length_mm;
    double rapid_length_mm;
    double cut_time_sec;
    double rapid_time_sec;
    double total_time_sec;
    uint8_t *gcode;
    size_t gcode_len;
} opencamlib_milling_result;

/* Returns 0 on success. `gcode`, when requested, is released with result_free. */
OPENCAMLIB_WRAPPER_API int opencamlib_milling_extract(
    const opencamlib_milling_input *input,
    opencamlib_milling_result *result
);
OPENCAMLIB_WRAPPER_API void opencamlib_milling_result_free(opencamlib_milling_result *result);
OPENCAMLIB_WRAPPER_API const char *opencamlib_wrapper_last_error(void);

#undef OPENCAMLIB_WRAPPER_API

#ifdef __cplusplus
}
#endif

#endif
