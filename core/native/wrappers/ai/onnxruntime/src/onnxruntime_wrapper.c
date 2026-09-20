#include "onnxruntime_wrapper.h"
#include "onnxruntime_c_api.h"

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct ortw_session {
    const OrtApi *api;
    OrtEnv *env;
    OrtSession *session;
    OrtMemoryInfo *memory;
};

static _Thread_local char last_error[2048];

static void set_error(const char *format, ...) {
    va_list args;
    va_start(args, format);
    vsnprintf(last_error, sizeof(last_error), format, args);
    va_end(args);
}

static int take_status(const OrtApi *api, OrtStatus *status) {
    if (status == NULL) return 0;
    set_error("%s", api->GetErrorMessage(status));
    api->ReleaseStatus(status);
    return -1;
}

const char *ortw_last_error(void) {
    return last_error;
}

void ortw_tensor_output_free(ortw_tensor_output *output) {
    if (output == NULL) return;
    free(output->data);
    free(output->shape);
    memset(output, 0, sizeof(*output));
}

void ortw_session_destroy(ortw_session *session) {
    if (session == NULL) return;
    if (session->memory != NULL) session->api->ReleaseMemoryInfo(session->memory);
    if (session->session != NULL) session->api->ReleaseSession(session->session);
    if (session->env != NULL) session->api->ReleaseEnv(session->env);
    free(session);
}

int ortw_session_create(const char *model_path, int intra_op_threads, ortw_session **out_session) {
    const OrtApiBase *base;
    const OrtApi *api;
    OrtSessionOptions *options = NULL;
    ortw_session *result = NULL;

    last_error[0] = '\0';
    if (model_path == NULL || model_path[0] == '\0' || out_session == NULL) {
        set_error("model_path and out_session are required");
        return -1;
    }
    *out_session = NULL;
    base = OrtGetApiBase();
    if (base == NULL || (api = base->GetApi(ORT_API_VERSION)) == NULL) {
        set_error("ONNX Runtime API version %d is unavailable", ORT_API_VERSION);
        return -1;
    }
    result = calloc(1, sizeof(*result));
    if (result == NULL) {
        set_error("out of memory while creating ONNX Runtime session");
        return -1;
    }
    result->api = api;
    if (take_status(api, api->CreateEnv(ORT_LOGGING_LEVEL_WARNING, "onnxruntime-wrapper", &result->env)) ||
        take_status(api, api->CreateSessionOptions(&options)))
        goto fail;
    if (intra_op_threads > 0 && take_status(api, api->SetIntraOpNumThreads(options, intra_op_threads))) goto fail;
    if (take_status(api, api->SetSessionGraphOptimizationLevel(options, ORT_ENABLE_EXTENDED)) ||
        take_status(api, api->CreateSession(result->env, model_path, options, &result->session)) ||
        take_status(api, api->CreateCpuMemoryInfo(OrtArenaAllocator, OrtMemTypeDefault, &result->memory)))
        goto fail;
    api->ReleaseSessionOptions(options);
    *out_session = result;
    return 0;

fail:
    if (options != NULL) api->ReleaseSessionOptions(options);
    ortw_session_destroy(result);
    return -1;
}

int ortw_session_run(ortw_session *session, const ortw_tensor_input *inputs, size_t input_count,
                     const char *const *output_names, size_t output_count, ortw_tensor_output *outputs) {
    OrtValue **input_values = NULL;
    OrtValue **output_values = NULL;
    const char **input_names = NULL;
    int rc = -1;

    last_error[0] = '\0';
    if (session == NULL || inputs == NULL || input_count == 0 || output_names == NULL || output_count == 0 || outputs == NULL) {
        set_error("session, inputs, output_names, and outputs are required");
        return -1;
    }
    memset(outputs, 0, output_count * sizeof(*outputs));
    input_values = calloc(input_count, sizeof(*input_values));
    output_values = calloc(output_count, sizeof(*output_values));
    input_names = calloc(input_count, sizeof(*input_names));
    if (input_values == NULL || output_values == NULL || input_names == NULL) {
        set_error("out of memory while preparing ONNX Runtime call");
        goto cleanup;
    }
    for (size_t i = 0; i < input_count; ++i) {
        const ortw_tensor_input *input = &inputs[i];
        if (input->name == NULL || input->data == NULL || input->shape == NULL || input->shape_len == 0 || input->data_bytes == 0) {
            set_error("invalid tensor input at index %zu", i);
            goto cleanup;
        }
        input_names[i] = input->name;
        if (take_status(session->api, session->api->CreateTensorWithDataAsOrtValue(
                session->memory, (void *)input->data, input->data_bytes, input->shape,
                input->shape_len, (ONNXTensorElementDataType)input->type, &input_values[i])))
            goto cleanup;
    }
    if (take_status(session->api, session->api->Run(session->session, NULL, input_names,
            (const OrtValue *const *)input_values, input_count, output_names, output_count, output_values)))
        goto cleanup;
    for (size_t i = 0; i < output_count; ++i) {
        OrtTensorTypeAndShapeInfo *info = NULL;
        ONNXTensorElementDataType type;
        size_t count, shape_len;
        size_t element_size;
        void *source = NULL;
        if (take_status(session->api, session->api->GetTensorTypeAndShape(output_values[i], &info))) goto cleanup;
        if (take_status(session->api, session->api->GetTensorElementType(info, &type))) goto cleanup;
        if (take_status(session->api, session->api->GetDimensionsCount(info, &shape_len))) {
            session->api->ReleaseTensorTypeAndShapeInfo(info); goto cleanup;
        }
        if (take_status(session->api, session->api->GetTensorShapeElementCount(info, &count))) {
            session->api->ReleaseTensorTypeAndShapeInfo(info); goto cleanup;
        }
        element_size = type == ONNX_TENSOR_ELEMENT_DATA_TYPE_FLOAT ? sizeof(float) :
                       type == ONNX_TENSOR_ELEMENT_DATA_TYPE_DOUBLE ? sizeof(double) :
                       type == ONNX_TENSOR_ELEMENT_DATA_TYPE_INT64 ? sizeof(int64_t) :
                       type == ONNX_TENSOR_ELEMENT_DATA_TYPE_INT32 ? sizeof(int32_t) : 0;
        if (element_size == 0) {
            session->api->ReleaseTensorTypeAndShapeInfo(info);
            set_error("unsupported output tensor element type %d", (int)type); goto cleanup;
        }
        outputs[i].shape = malloc(shape_len * sizeof(*outputs[i].shape));
        outputs[i].data = malloc(count * element_size);
        if (outputs[i].shape == NULL || outputs[i].data == NULL ||
            take_status(session->api, session->api->GetDimensions(info, outputs[i].shape, shape_len)) ||
            take_status(session->api, session->api->GetTensorMutableData(output_values[i], &source))) {
            session->api->ReleaseTensorTypeAndShapeInfo(info); goto cleanup;
        }
        memcpy(outputs[i].data, source, count * element_size);
        outputs[i].shape_len = shape_len;
        outputs[i].data_bytes = count * element_size;
        outputs[i].type = (ortw_tensor_type)type;
        session->api->ReleaseTensorTypeAndShapeInfo(info);
    }
    rc = 0;

cleanup:
    if (input_values != NULL) for (size_t i = 0; i < input_count; ++i) if (input_values[i] != NULL) session->api->ReleaseValue(input_values[i]);
    if (output_values != NULL) for (size_t i = 0; i < output_count; ++i) if (output_values[i] != NULL) session->api->ReleaseValue(output_values[i]);
    if (rc != 0) for (size_t i = 0; i < output_count; ++i) ortw_tensor_output_free(&outputs[i]);
    free(input_names);
    free(input_values);
    free(output_values);
    return rc;
}
