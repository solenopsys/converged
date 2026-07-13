#ifndef CURAENGINE_WRAPPER_H
#define CURAENGINE_WRAPPER_H

#include <stddef.h>
#include <stdint.h>

#if defined(_WIN32)
#  if defined(CURAENGINE_WRAPPER_BUILD)
#    define CURAENGINE_API __declspec(dllexport)
#  else
#    define CURAENGINE_API __declspec(dllimport)
#  endif
#else
#  define CURAENGINE_API __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    const char *name;
    const uint8_t *data;
    size_t data_len;
} curaengine_named_file;

/*
 * The engine is intentionally an executable, not an in-process C++ library.
 * CuraEngine owns global singleton state and can call exit() on invalid input.
 */
typedef struct {
    const uint8_t *model_stl;
    size_t model_stl_len;
    const uint8_t *definition_json;
    size_t definition_json_len;
    const char *model_name;
    const char *definition_name;
    const char *engine_path; /* NULL: CURAENGINE_BINARY, then CuraEngine on PATH. */
    const char *const *settings;
    size_t settings_len;
    const curaengine_named_file *search_files;
    size_t search_files_len;
    uint32_t threads;
} curaengine_slice_input;

typedef struct {
    uint8_t *gcode;
    size_t gcode_len;
    int exit_code;
} curaengine_slice_result;

CURAENGINE_API int curaengine_slice(const curaengine_slice_input *input,
                                    curaengine_slice_result *result);
CURAENGINE_API void curaengine_slice_result_free(curaengine_slice_result *result);
CURAENGINE_API const char *curaengine_wrapper_last_error(void);

#ifdef __cplusplus
}
#endif

#endif
