#ifndef ONNXRUNTIME_WRAPPER_H
#define ONNXRUNTIME_WRAPPER_H

#include <stddef.h>
#include <stdint.h>

#if defined(_WIN32)
#  if defined(ONNXRUNTIME_WRAPPER_BUILD)
#    define ORT_WRAPPER_API __declspec(dllexport)
#  else
#    define ORT_WRAPPER_API __declspec(dllimport)
#  endif
#else
#  define ORT_WRAPPER_API __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef struct ortw_session ortw_session;

/* Values match ONNXTensorElementDataType from onnxruntime_c_api.h. */
typedef enum {
    ORTW_UNDEFINED = 0,
    ORTW_FLOAT = 1,
    ORTW_UINT8 = 2,
    ORTW_INT8 = 3,
    ORTW_UINT16 = 4,
    ORTW_INT16 = 5,
    ORTW_INT32 = 6,
    ORTW_INT64 = 7,
    ORTW_STRING = 8,
    ORTW_BOOL = 9,
    ORTW_FLOAT16 = 10,
    ORTW_DOUBLE = 11,
    ORTW_UINT32 = 12,
    ORTW_UINT64 = 13,
} ortw_tensor_type;

typedef struct {
    const char *name;
    const void *data;
    size_t data_bytes;
    const int64_t *shape;
    size_t shape_len;
    ortw_tensor_type type;
} ortw_tensor_input;

typedef struct {
    void *data;
    size_t data_bytes;
    int64_t *shape;
    size_t shape_len;
    ortw_tensor_type type;
} ortw_tensor_output;

/* Creates an isolated CPU session. `intra_op_threads == 0` leaves ORT default. */
ORT_WRAPPER_API int ortw_session_create(const char *model_path,
                                        int intra_op_threads,
                                        ortw_session **out_session);
ORT_WRAPPER_API void ortw_session_destroy(ortw_session *session);

/* Runs named inputs and returns malloc-owned output tensors in output order. */
ORT_WRAPPER_API int ortw_session_run(ortw_session *session,
                                     const ortw_tensor_input *inputs,
                                     size_t input_count,
                                     const char *const *output_names,
                                     size_t output_count,
                                     ortw_tensor_output *outputs);
ORT_WRAPPER_API void ortw_tensor_output_free(ortw_tensor_output *output);
ORT_WRAPPER_API const char *ortw_last_error(void);

#ifdef __cplusplus
}
#endif

#endif
