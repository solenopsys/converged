#include "curaengine_wrapper.h"

#include <stdio.h>
#include <stdlib.h>

static unsigned char *read_bytes(const char *path, size_t *size)
{
    FILE *file = fopen(path, "rb");
    if (!file || fseek(file, 0, SEEK_END) || (*size = (size_t)ftell(file)) == (size_t)-1 || fseek(file, 0, SEEK_SET))
        return NULL;
    unsigned char *data = malloc(*size);
    if (!data || fread(data, 1, *size, file) != *size) {
        free(data);
        data = NULL;
    }
    fclose(file);
    return data;
}

int main(int argc, char **argv)
{
    if (argc != 5) {
        fprintf(stderr, "usage: %s ENGINE MODEL.STL PRINTER.DEF.JSON EXTRUDER.DEF.JSON\n", argv[0]);
        return 2;
    }
    size_t model_len, definition_len, extruder_len;
    unsigned char *model = read_bytes(argv[2], &model_len);
    unsigned char *definition = read_bytes(argv[3], &definition_len);
    unsigned char *extruder = read_bytes(argv[4], &extruder_len);
    const char *settings[] = { "layer_height=0.2", "adhesion_type=none", "infill_sparse_density=20" };
    const curaengine_named_file files[] = { { "fdmextruder.def.json", extruder, extruder_len } };
    curaengine_slice_input input = {
        .model_stl = model, .model_stl_len = model_len,
        .definition_json = definition, .definition_json_len = definition_len,
        .model_name = "model.stl", .definition_name = "fdmprinter.def.json",
        .engine_path = argv[1], .settings = settings, .settings_len = 3,
        .search_files = files, .search_files_len = 1, .threads = 1,
    };
    curaengine_slice_result result;
    const int rc = curaengine_slice(&input, &result);
    free(model);
    free(definition);
    free(extruder);
    if (rc != 0) {
        fprintf(stderr, "%s\n", curaengine_wrapper_last_error());
        return 1;
    }
    printf("gcode=%zu exit_code=%d\n", result.gcode_len, result.exit_code);
    curaengine_slice_result_free(&result);
    return 0;
}
