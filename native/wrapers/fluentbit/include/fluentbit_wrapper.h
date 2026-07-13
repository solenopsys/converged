#ifndef FLUENTBIT_WRAPPER_H
#define FLUENTBIT_WRAPPER_H

#include <stddef.h>
#include <stdint.h>

#if defined(_WIN32)
#  if defined(FLUENTBIT_WRAPPER_BUILD)
#    define FLUENTBIT_API __declspec(dllexport)
#  else
#    define FLUENTBIT_API __declspec(dllimport)
#  endif
#else
#  define FLUENTBIT_API __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    const char *name;
    const uint8_t *data;
    size_t data_len;
} fluentbit_named_file;

typedef struct {
    const uint8_t *config;
    size_t config_len;
    const char *config_name; /* Defaults to fluent-bit.conf. */
    const fluentbit_named_file *files; /* Files included by the config. */
    size_t files_len;
} fluentbit_engine_input;

typedef struct fluentbit_engine fluentbit_engine;

/*
 * Starts a Fluent Bit engine in its native worker thread. The returned handle
 * owns its temporary config directory and must be stopped with destroy().
 */
FLUENTBIT_API fluentbit_engine *fluentbit_engine_start(const fluentbit_engine_input *input);
FLUENTBIT_API int fluentbit_engine_stop(fluentbit_engine *engine);
FLUENTBIT_API void fluentbit_engine_destroy(fluentbit_engine *engine);
FLUENTBIT_API const char *fluentbit_wrapper_last_error(void);

#ifdef __cplusplus
}
#endif

#endif
