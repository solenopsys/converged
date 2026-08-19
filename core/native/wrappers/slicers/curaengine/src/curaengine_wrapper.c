#define _POSIX_C_SOURCE 200809L

#include "curaengine_wrapper.h"

#include <errno.h>
#include <fcntl.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#include <spawn.h>

extern char **environ;

static _Thread_local char last_error[8192];

static void set_error(const char *format, ...)
{
    va_list args;
    va_start(args, format);
    vsnprintf(last_error, sizeof(last_error), format, args);
    va_end(args);
}

const char *curaengine_wrapper_last_error(void)
{
    return last_error;
}

static bool is_safe_filename(const char *value)
{
    if (value == NULL || value[0] == '\0' || strlen(value) > 240)
        return false;
    for (const unsigned char *p = (const unsigned char *)value; *p; ++p) {
        if (!( (*p >= 'a' && *p <= 'z') || (*p >= 'A' && *p <= 'Z') ||
               (*p >= '0' && *p <= '9') || *p == '.' || *p == '_' || *p == '-' ))
            return false;
    }
    return strcmp(value, ".") != 0 && strcmp(value, "..") != 0;
}

static char *join_path(const char *dir, const char *name)
{
    const size_t size = strlen(dir) + 1 + strlen(name) + 1;
    char *path = malloc(size);
    if (path != NULL)
        snprintf(path, size, "%s/%s", dir, name);
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
        const ssize_t n = write(fd, data + written, data_len - written);
        if (n < 0 && errno == EINTR)
            continue;
        if (n <= 0) {
            set_error("cannot write %s: %s", path, strerror(errno));
            close(fd);
            return -1;
        }
        written += (size_t)n;
    }
    if (close(fd) != 0) {
        set_error("cannot close %s: %s", path, strerror(errno));
        return -1;
    }
    return 0;
}

static int read_file(const char *path, uint8_t **data, size_t *data_len)
{
    struct stat st;
    if (stat(path, &st) != 0 || st.st_size < 0) {
        set_error("CuraEngine did not produce G-code: %s", strerror(errno));
        return -1;
    }
    if ((uintmax_t)st.st_size > (uintmax_t)1024 * 1024 * 1024) {
        set_error("G-code exceeds the 1 GiB wrapper limit");
        return -1;
    }
    const size_t size = (size_t)st.st_size;
    uint8_t *buffer = malloc(size == 0 ? 1 : size);
    if (buffer == NULL) {
        set_error("out of memory while reading G-code");
        return -1;
    }
    const int fd = open(path, O_RDONLY | O_CLOEXEC);
    if (fd < 0) {
        free(buffer);
        set_error("cannot read G-code: %s", strerror(errno));
        return -1;
    }
    size_t read_len = 0;
    while (read_len < size) {
        const ssize_t n = read(fd, buffer + read_len, size - read_len);
        if (n < 0 && errno == EINTR)
            continue;
        if (n <= 0) {
            free(buffer);
            close(fd);
            set_error("cannot fully read G-code: %s", strerror(errno));
            return -1;
        }
        read_len += (size_t)n;
    }
    close(fd);
    *data = buffer;
    *data_len = size;
    return 0;
}

static void append_log_error(const char *log_path, int exit_code)
{
    FILE *file = fopen(log_path, "rb");
    if (file == NULL) {
        set_error("CuraEngine exited with code %d", exit_code);
        return;
    }
    const size_t read_len = fread(last_error, 1, sizeof(last_error) - 1, file);
    fclose(file);
    last_error[read_len] = '\0';
    if (read_len == 0)
        set_error("CuraEngine exited with code %d", exit_code);
}

static char **environment_with_search_path(const char *search_path)
{
    size_t count = 0;
    while (environ[count] != NULL)
        ++count;
    char **envp = calloc(count + 2, sizeof(*envp));
    if (envp == NULL)
        return NULL;

    const char prefix[] = "CURA_ENGINE_SEARCH_PATH=";
    size_t out = 0;
    for (size_t i = 0; i < count; ++i) {
        if (strncmp(environ[i], prefix, sizeof(prefix) - 1) != 0)
            envp[out++] = environ[i];
    }
    const size_t path_len = sizeof(prefix) - 1 + strlen(search_path) + 1;
    envp[out] = malloc(path_len);
    if (envp[out] == NULL) {
        free(envp);
        return NULL;
    }
    snprintf(envp[out], path_len, "%s%s", prefix, search_path);
    return envp;
}

void curaengine_slice_result_free(curaengine_slice_result *result)
{
    if (result == NULL)
        return;
    free(result->gcode);
    memset(result, 0, sizeof(*result));
}

int curaengine_slice(const curaengine_slice_input *input, curaengine_slice_result *result)
{
    char template[] = "/tmp/curaengine-wrapper-XXXXXX";
    char *temp_dir = NULL;
    char *model_path = NULL;
    char *definition_path = NULL;
    char *output_path = NULL;
    char *log_path = NULL;
    char *search_dirs = NULL;
    char *engine_search_path = NULL;
    char **search_paths = NULL;
    char **search_dir_paths = NULL;
    char **argv = NULL;
    char **envp = NULL;
    int status = -1;
    int rc = -1;

    last_error[0] = '\0';
    if (input == NULL || result == NULL || input->model_stl == NULL || input->model_stl_len == 0 ||
        input->definition_json == NULL || input->definition_json_len == 0) {
        set_error("model STL and printer definition JSON are required");
        return -1;
    }
    if ((input->settings_len != 0 && input->settings == NULL) ||
        (input->search_files_len != 0 && input->search_files == NULL)) {
        set_error("settings and search file arrays must be present when their lengths are non-zero");
        return -1;
    }
    memset(result, 0, sizeof(*result));

    const char *model_name = is_safe_filename(input->model_name) ? input->model_name : "model.stl";
    const char *definition_name = is_safe_filename(input->definition_name) ? input->definition_name : "definition.def.json";
    temp_dir = mkdtemp(template);
    if (temp_dir == NULL) {
        set_error("cannot create temporary CuraEngine directory: %s", strerror(errno));
        goto cleanup;
    }
    model_path = join_path(temp_dir, model_name);
    definition_path = join_path(temp_dir, definition_name);
    output_path = join_path(temp_dir, "out.gcode");
    log_path = join_path(temp_dir, "engine.log");
    if (!model_path || !definition_path || !output_path || !log_path) {
        set_error("out of memory while preparing CuraEngine files");
        goto cleanup;
    }
    if (write_file(model_path, input->model_stl, input->model_stl_len) != 0 ||
        write_file(definition_path, input->definition_json, input->definition_json_len) != 0)
        goto cleanup;

    if (input->search_files_len > 0) {
        search_paths = calloc(input->search_files_len, sizeof(*search_paths));
        search_dir_paths = calloc(input->search_files_len, sizeof(*search_dir_paths));
        size_t dirs_size = 1;
        if (search_paths == NULL || search_dir_paths == NULL) {
            set_error("out of memory while preparing CuraEngine search files");
            goto cleanup;
        }
        for (size_t i = 0; i < input->search_files_len; ++i) {
            const curaengine_named_file *file = &input->search_files[i];
            if (file->data == NULL || !is_safe_filename(file->name)) {
                set_error("invalid CuraEngine search file at index %zu", i);
                goto cleanup;
            }
            char dir_name[32];
            snprintf(dir_name, sizeof(dir_name), "search_%zu", i);
            search_dir_paths[i] = join_path(temp_dir, dir_name);
            if (search_dir_paths[i] == NULL) {
                set_error("out of memory while preparing CuraEngine search file");
                goto cleanup;
            }
            search_paths[i] = join_path(search_dir_paths[i], file->name);
            if (!search_paths[i] || mkdir(search_dir_paths[i], 0700) != 0 ||
                write_file(search_paths[i], file->data, file->data_len) != 0) {
                if (last_error[0] == '\0')
                    set_error("cannot prepare CuraEngine search file: %s", strerror(errno));
                goto cleanup;
            }
            dirs_size += strlen(search_dir_paths[i]) + 1;
        }
        search_dirs = malloc(dirs_size);
        if (search_dirs == NULL) {
            set_error("out of memory while preparing CuraEngine search paths");
            goto cleanup;
        }
        search_dirs[0] = '\0';
        for (size_t i = 0; i < input->search_files_len; ++i) {
            if (i != 0)
                strcat(search_dirs, ":");
            strcat(search_dirs, search_dir_paths[i]);
        }
    }

    const size_t engine_search_size = strlen(temp_dir) + (search_dirs ? 1 + strlen(search_dirs) : 0) + 1;
    engine_search_path = malloc(engine_search_size);
    if (engine_search_path == NULL) {
        set_error("out of memory while preparing CuraEngine search paths");
        goto cleanup;
    }
    snprintf(engine_search_path, engine_search_size, "%s%s%s", temp_dir, search_dirs ? ":" : "", search_dirs ? search_dirs : "");
    envp = environment_with_search_path(engine_search_path);
    if (envp == NULL) {
        set_error("out of memory while preparing CuraEngine environment");
        goto cleanup;
    }

    const size_t argv_len = 8 + (input->threads ? 1 : 0) + input->settings_len * 2 + 1;
    argv = calloc(argv_len, sizeof(*argv));
    if (argv == NULL) {
        set_error("out of memory while preparing CuraEngine arguments");
        goto cleanup;
    }
    const char *engine = input->engine_path;
    if (engine == NULL || engine[0] == '\0')
        engine = getenv("CURAENGINE_BINARY");
    if (engine == NULL || engine[0] == '\0')
        engine = "CuraEngine";
    size_t argi = 0;
    argv[argi++] = (char *)engine;
    argv[argi++] = "slice";
    argv[argi++] = "-j";
    argv[argi++] = definition_path;
    argv[argi++] = "-l";
    argv[argi++] = model_path;
    argv[argi++] = "-o";
    argv[argi++] = output_path;
    char threads_arg[32];
    if (input->threads) {
        snprintf(threads_arg, sizeof(threads_arg), "-m%u", input->threads);
        argv[argi++] = threads_arg;
    }
    for (size_t i = 0; i < input->settings_len; ++i) {
        if (input->settings[i] == NULL || input->settings[i][0] == '\0') {
            set_error("invalid CuraEngine setting at index %zu", i);
            goto cleanup;
        }
        argv[argi++] = "-s";
        argv[argi++] = (char *)input->settings[i];
    }
    const int log_fd = open(log_path, O_CREAT | O_TRUNC | O_WRONLY | O_CLOEXEC, 0600);
    if (log_fd < 0) {
        set_error("cannot create CuraEngine log: %s", strerror(errno));
        goto cleanup;
    }
    posix_spawn_file_actions_t actions;
    posix_spawn_file_actions_init(&actions);
    posix_spawn_file_actions_adddup2(&actions, log_fd, STDERR_FILENO);
    posix_spawn_file_actions_addclose(&actions, log_fd);
    pid_t pid;
    int spawn_status = strchr(engine, '/') ? posix_spawn(&pid, engine, &actions, NULL, argv, envp)
                                           : posix_spawnp(&pid, engine, &actions, NULL, argv, envp);
    posix_spawn_file_actions_destroy(&actions);
    close(log_fd);
    if (spawn_status != 0) {
        set_error("cannot start CuraEngine: %s", strerror(spawn_status));
        goto cleanup;
    }
    while (waitpid(pid, &status, 0) < 0) {
        if (errno != EINTR) {
            set_error("cannot wait for CuraEngine: %s", strerror(errno));
            goto cleanup;
        }
    }
    result->exit_code = WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
    if (result->exit_code != 0) {
        append_log_error(log_path, result->exit_code);
        goto cleanup;
    }
    if (read_file(output_path, &result->gcode, &result->gcode_len) != 0)
        goto cleanup;
    rc = 0;

cleanup:
    if (rc != 0)
        curaengine_slice_result_free(result);
    if (envp != NULL) {
        for (size_t i = 0; envp[i] != NULL; ++i) {
            if (strncmp(envp[i], "CURA_ENGINE_SEARCH_PATH=", 24) == 0)
                free(envp[i]);
        }
    }
    free(envp);
    free(argv);
    if (search_paths != NULL) {
        for (size_t i = 0; i < input->search_files_len; ++i) {
            if (search_paths[i] != NULL)
                unlink(search_paths[i]);
            if (search_dir_paths[i] != NULL)
                rmdir(search_dir_paths[i]);
        }
    }
    free(search_paths);
    free(search_dir_paths);
    if (model_path != NULL) unlink(model_path);
    if (definition_path != NULL) unlink(definition_path);
    if (output_path != NULL) unlink(output_path);
    if (log_path != NULL) unlink(log_path);
    if (temp_dir != NULL) rmdir(temp_dir);
    free(model_path);
    free(definition_path);
    free(output_path);
    free(log_path);
    free(search_dirs);
    free(engine_search_path);
    return rc;
}
