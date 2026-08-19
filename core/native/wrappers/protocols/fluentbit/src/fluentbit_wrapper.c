#define _POSIX_C_SOURCE 200809L

#include "fluentbit_wrapper.h"

#include <errno.h>
#include <fcntl.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

typedef struct flb_lib_ctx flb_ctx_t;

extern flb_ctx_t *flb_create(void);
extern void flb_destroy(flb_ctx_t *ctx);
extern int flb_start(flb_ctx_t *ctx);
extern int flb_stop(flb_ctx_t *ctx);
extern int flb_lib_config_file(flb_ctx_t *ctx, const char *path);

struct fluentbit_engine {
    flb_ctx_t *context;
    char *directory;
    char *config_path;
    char **file_paths;
    size_t file_paths_len;
    bool started;
};

static _Thread_local char last_error[1024];

static void set_error(const char *format, ...)
{
    va_list args;
    va_start(args, format);
    vsnprintf(last_error, sizeof(last_error), format, args);
    va_end(args);
}

const char *fluentbit_wrapper_last_error(void)
{
    return last_error;
}

static bool is_safe_filename(const char *value)
{
    if (value == NULL || value[0] == '\0' || strlen(value) > 240)
        return false;
    for (const unsigned char *p = (const unsigned char *)value; *p; ++p) {
        if (!((*p >= 'a' && *p <= 'z') || (*p >= 'A' && *p <= 'Z') ||
              (*p >= '0' && *p <= '9') || *p == '.' || *p == '_' || *p == '-'))
            return false;
    }
    return strcmp(value, ".") != 0 && strcmp(value, "..") != 0;
}

static char *join_path(const char *directory, const char *name)
{
    const size_t size = strlen(directory) + 1 + strlen(name) + 1;
    char *path = malloc(size);
    if (path != NULL)
        snprintf(path, size, "%s/%s", directory, name);
    return path;
}

static int write_file(const char *path, const uint8_t *data, size_t data_len)
{
    const int fd = open(path, O_CREAT | O_TRUNC | O_WRONLY | O_CLOEXEC, 0600);
    if (fd < 0) {
        set_error("cannot create %s: %s", path, strerror(errno));
        return -1;
    }
    size_t written = 0;
    while (written < data_len) {
        const ssize_t count = write(fd, data + written, data_len - written);
        if (count < 0 && errno == EINTR)
            continue;
        if (count <= 0) {
            set_error("cannot write %s: %s", path, strerror(errno));
            close(fd);
            return -1;
        }
        written += (size_t)count;
    }
    if (close(fd) != 0) {
        set_error("cannot close %s: %s", path, strerror(errno));
        return -1;
    }
    return 0;
}

void fluentbit_engine_destroy(fluentbit_engine *engine)
{
    if (engine == NULL)
        return;
    if (engine->context != NULL) {
        if (engine->started)
            flb_stop(engine->context);
        flb_destroy(engine->context);
    }
    for (size_t i = 0; i < engine->file_paths_len; ++i) {
        if (engine->file_paths[i] != NULL)
            unlink(engine->file_paths[i]);
    }
    if (engine->config_path != NULL)
        unlink(engine->config_path);
    if (engine->directory != NULL)
        rmdir(engine->directory);
    free(engine->file_paths);
    free(engine->config_path);
    free(engine->directory);
    free(engine);
}

int fluentbit_engine_stop(fluentbit_engine *engine)
{
    if (engine == NULL || engine->context == NULL) {
        set_error("Fluent Bit engine handle is invalid");
        return -1;
    }
    if (!engine->started)
        return 0;
    if (flb_stop(engine->context) != 0) {
        set_error("Fluent Bit engine did not stop cleanly");
        return -1;
    }
    engine->started = false;
    return 0;
}

fluentbit_engine *fluentbit_engine_start(const fluentbit_engine_input *input)
{
    char directory_template[] = "/tmp/fluentbit-wrapper-XXXXXX";
    fluentbit_engine *engine = NULL;
    const char *config_name;

    last_error[0] = '\0';
    if (input == NULL || input->config == NULL || input->config_len == 0) {
        set_error("Fluent Bit configuration is required");
        return NULL;
    }
    if (input->files_len != 0 && input->files == NULL) {
        set_error("included configuration file array is missing");
        return NULL;
    }

    config_name = is_safe_filename(input->config_name) ? input->config_name : "fluent-bit.conf";
    engine = calloc(1, sizeof(*engine));
    if (engine == NULL) {
        set_error("out of memory while creating Fluent Bit engine");
        return NULL;
    }
    engine->directory = strdup(directory_template);
    if (engine->directory == NULL || mkdtemp(engine->directory) == NULL) {
        set_error("cannot create temporary Fluent Bit directory: %s", strerror(errno));
        fluentbit_engine_destroy(engine);
        return NULL;
    }
    engine->config_path = join_path(engine->directory, config_name);
    if (engine->config_path == NULL ||
        write_file(engine->config_path, input->config, input->config_len) != 0) {
        fluentbit_engine_destroy(engine);
        return NULL;
    }

    if (input->files_len != 0) {
        engine->file_paths = calloc(input->files_len, sizeof(*engine->file_paths));
        if (engine->file_paths == NULL) {
            set_error("out of memory while preparing Fluent Bit includes");
            fluentbit_engine_destroy(engine);
            return NULL;
        }
        engine->file_paths_len = input->files_len;
        for (size_t i = 0; i < input->files_len; ++i) {
            const fluentbit_named_file *file = &input->files[i];
            if (file->data == NULL || !is_safe_filename(file->name) ||
                strcmp(file->name, config_name) == 0) {
                set_error("invalid Fluent Bit include at index %zu", i);
                fluentbit_engine_destroy(engine);
                return NULL;
            }
            for (size_t previous = 0; previous < i; ++previous) {
                if (strcmp(file->name, input->files[previous].name) == 0) {
                    set_error("duplicate Fluent Bit include at index %zu", i);
                    fluentbit_engine_destroy(engine);
                    return NULL;
                }
            }
            engine->file_paths[i] = join_path(engine->directory, file->name);
            if (engine->file_paths[i] == NULL ||
                write_file(engine->file_paths[i], file->data, file->data_len) != 0) {
                if (last_error[0] == '\0')
                    set_error("out of memory while preparing Fluent Bit includes");
                fluentbit_engine_destroy(engine);
                return NULL;
            }
        }
    }

    engine->context = flb_create();
    if (engine->context == NULL) {
        set_error("cannot create Fluent Bit context");
        fluentbit_engine_destroy(engine);
        return NULL;
    }
    if (flb_lib_config_file(engine->context, engine->config_path) != 0) {
        set_error("cannot load Fluent Bit configuration");
        fluentbit_engine_destroy(engine);
        return NULL;
    }
    if (flb_start(engine->context) != 0) {
        set_error("cannot start Fluent Bit engine");
        fluentbit_engine_destroy(engine);
        return NULL;
    }
    engine->started = true;
    return engine;
}
