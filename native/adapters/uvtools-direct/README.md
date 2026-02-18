# uvtools-direct-adapter

Zig FFI adapter that provides direct process-level access to the UVtools CLI (`UVtoolsCmd`).

The adapter builds as a shared library (`.so`) plus C header and exposes:
- generic command execution (`argv` and raw command line),
- interface command IDs for known UVtools commands,
- command result access (`stdout`, `stderr`, `exit_code`, `error`, `state JSON`).

## What This Adapter Does

This adapter does not reimplement UVtools internals in Zig.
It wraps the real UVtools CLI and executes it as a child process.

Why this is useful:
- behavior stays aligned with upstream UVtools,
- you can call UVtools from any language via FFI,
- all command output is available through API buffers.

## Implemented UVtools Commands

The interface command IDs map to these CLI commands:

- `UVTOOLS_CMD_SET_PROPERTIES` -> `set-properties`
- `UVTOOLS_CMD_RUN` -> `run`
- `UVTOOLS_CMD_CONVERT` -> `convert`
- `UVTOOLS_CMD_EXTRACT` -> `extract`
- `UVTOOLS_CMD_COPY_PARAMETERS` -> `copy-parameters`
- `UVTOOLS_CMD_SET_THUMBNAIL` -> `set-thumbnail`
- `UVTOOLS_CMD_COMPARE` -> `compare`
- `UVTOOLS_CMD_PRINT_ISSUES` -> `print-issues`
- `UVTOOLS_CMD_PRINT_PROPERTIES` -> `print-properties`
- `UVTOOLS_CMD_PRINT_GCODE` -> `print-gcode`
- `UVTOOLS_CMD_PRINT_MACHINES` -> `print-machines`
- `UVTOOLS_CMD_PRINT_FORMATS` -> `print-formats`
- `UVTOOLS_CMD_BENCHMARK_LAYER_CODECS` -> `benchmark-layer-codecs`
- `UVTOOLS_CMD_RAW` -> execute raw args line from `extra_args`

For maximum flexibility, use `uvtools_adapter_execute_argv()` or `uvtools_adapter_execute_raw()`.

## Project Structure

- `build.zig` - shared library + tests
- `src/main.zig` - adapter implementation
- `include/uvtools_direct_adapter.h` - C ABI
- `zig-out/lib/libuvtools_direct_adapter.so` - built library
- `zig-out/include/uvtools_direct_adapter.h` - installed header

## Requirements

- Linux
- Zig `0.15.x`
- UVtools CLI available as executable in `PATH` (default: `UVtoolsCmd`) or explicit path
- If you set executable to a `.dll`, `dotnet` runtime must be available
- `timeout` utility (GNU coreutils) for timeout enforcement

## Build

```bash
cd gestalt/clarity/projects/converged-portal/native/adapters/uvtools-direct
zig build
zig build test
```

Artifacts:

- `zig-out/lib/libuvtools_direct_adapter.so`
- `zig-out/include/uvtools_direct_adapter.h`

## Return Codes

- `0` success (process exited with code `0`)
- `-1` invalid handle or invalid arguments
- `-2` adapter/runtime execution error (spawn/internal)
- `-3` process finished with non-zero exit code
- `-4` process timed out

## Lifecycle

1. `uvtools_adapter_create()`
2. Optional setup:
- `uvtools_adapter_set_executable()`
- `uvtools_adapter_set_workdir()`
- `uvtools_adapter_set_timeout_ms()`
- `uvtools_adapter_set_max_output_bytes()`
3. Execute:
- `uvtools_adapter_execute_argv()` or
- `uvtools_adapter_execute_raw()` or
- `uvtools_adapter_execute_command()` / helpers
4. Read result:
- `uvtools_adapter_get_last_exit_code()`
- `uvtools_adapter_get_last_stdout()`
- `uvtools_adapter_get_last_stderr()`
- `uvtools_adapter_get_last_error()`
- `uvtools_adapter_get_state_json()`
5. Free returned buffers with `uvtools_adapter_free_buffer()`
6. `uvtools_adapter_destroy()`

## Configuration Notes

- Default executable: `UVtoolsCmd`
- Timeout default: `300000` ms (5 minutes)
- Max captured output default: `16 MiB`
- Timeout is enforced by prefixing command with `timeout --signal=TERM --kill-after=5s <duration>`

## C FFI Example

```c
#include <stdint.h>
#include <stdio.h>
#include "uvtools_direct_adapter.h"

static void print_buffer(void *h, int32_t (*getter)(void*, uint8_t **, size_t *)) {
    uint8_t *buf = NULL;
    size_t len = 0;
    if (getter(h, &buf, &len) == 0 && buf && len > 0) {
        fwrite(buf, 1, len, stdout);
        putchar('\n');
        uvtools_adapter_free_buffer(buf, len);
    }
}

int main(void) {
    void *h = uvtools_adapter_create();
    if (!h) return 1;

    uvtools_adapter_set_executable(h, "UVtoolsCmd");
    uvtools_adapter_set_timeout_ms(h, 120000);

    const char *argv[] = {
        "convert",
        "input.ctb",
        "pwmo",
        "output.pwmo",
        "--version",
        "4"
    };

    int32_t rc = uvtools_adapter_execute_argv(h, argv, 6);
    printf("rc=%d exit=%d success=%d\n",
           rc,
           uvtools_adapter_get_last_exit_code(h),
           uvtools_adapter_get_last_success(h));

    print_buffer(h, uvtools_adapter_get_last_stdout);
    print_buffer(h, uvtools_adapter_get_last_stderr);

    uvtools_adapter_destroy(h);
    return 0;
}
```

Compile example:

```bash
cc example.c \
  -I./zig-out/include \
  -L./zig-out/lib \
  -luvtools_direct_adapter \
  -Wl,-rpath,'$ORIGIN/zig-out/lib'
```

## Raw Command Examples

Run by `argv`:

```c
const char *args[] = {"print-properties", "my-file.ctb"};
uvtools_adapter_execute_argv(h, args, 2);
```

Run by raw line:

```c
uvtools_adapter_execute_raw(h, "run input.ctb OperationLiftHeight --property LiftHeight=8.0 -o output.ctb");
```

Run by interface command struct:

```c
uvtools_interface_command_t cmd = {
    .command_id = UVTOOLS_CMD_CONVERT,
    .input_path = "input.ctb",
    .secondary_path = "pwmo",
    .output_path = "output.pwmo",
    .extra_args = "--version 4"
};
uvtools_adapter_execute_command(h, &cmd);
```

## Output Retrieval API

All output getters allocate a new buffer each call:
- `uvtools_adapter_get_last_stdout()`
- `uvtools_adapter_get_last_stderr()`
- `uvtools_adapter_get_last_error()`
- `uvtools_adapter_get_last_args()`
- `uvtools_adapter_get_state_json()`

You must release each returned buffer with:

```c
uvtools_adapter_free_buffer(ptr, len);
```

## Thread-Safety

Adapter state is mutex-protected.
Only one command is executed at a time per adapter handle.

## Testing

Current unit tests cover:
- raw args parsing with quotes,
- command preview formatting for logs.

For end-to-end tests, point executable to a real UVtools CLI binary and run commands against sample files.
