#include "fluentbit_wrapper.h"

#include <stdio.h>
#include <string.h>

int main(void)
{
    static const char config[] =
        "[SERVICE]\n"
        "    Flush 1\n"
        "    Log_Level error\n"
        "@INCLUDE input.conf\n"
        "@INCLUDE output.conf\n";
    static const char input[] =
        "[INPUT]\n"
        "    Name tail\n"
        "    Tag smoke\n"
        "    Path /tmp/fluentbit-wrapper-smoke.log\n";
    static const char output[] =
        "[OUTPUT]\n"
        "    Name es\n"
        "    Match *\n"
        "    Host 127.0.0.1\n"
        "    Port 1\n"
        "    Retry_Limit False\n";
    const fluentbit_named_file files[] = {
        { "input.conf", (const uint8_t *)input, sizeof(input) - 1 },
        { "output.conf", (const uint8_t *)output, sizeof(output) - 1 },
    };
    const fluentbit_engine_input engine_input = {
        .config = (const uint8_t *)config,
        .config_len = sizeof(config) - 1,
        .config_name = "fluent-bit.conf",
        .files = files,
        .files_len = 2,
    };

    fluentbit_engine *engine = fluentbit_engine_start(&engine_input);
    if (engine == NULL) {
        fprintf(stderr, "%s\n", fluentbit_wrapper_last_error());
        return 1;
    }
    if (fluentbit_engine_stop(engine) != 0) {
        fprintf(stderr, "%s\n", fluentbit_wrapper_last_error());
        fluentbit_engine_destroy(engine);
        return 1;
    }
    fluentbit_engine_destroy(engine);
    puts("started and stopped");
    return 0;
}
