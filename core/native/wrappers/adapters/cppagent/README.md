# cppagent Zig Wrapper

Zig FFI wrapper для [mtconnect/cppagent](https://github.com/mtconnect/cppagent).

Этот враппер управляет `cppagent` как внешним процессом:
- запускает `cppagent run <agent.cfg>`;
- останавливает процесс (TERM/KILL);
- проверяет health (`GET /probe` по HTTP);
- отдаёт API через C ABI (`.so + .h`) для FFI.

## Почему так

`cppagent` как library (`agent_lib`) тянет большой набор C++ зависимостей (Boost, OpenSSL, LibXml2, date, mqtt_cpp, RapidJSON и др.). Для быстрой интеграции в ваш стек сделан процессный враппер: стабильный API, простой деплой, минимум связности.

Если нужно, можно сделать следующий слой: прямой embed `agent_lib` через C++ shim + Zig.

## Структура

- `build.zig` - сборка `libcppagent_wrapper.so`
- `src/main.zig` - реализация process wrapper + exports
- `include/cppagent_wrapper.h` - C ABI header
- `tools/build_cppagent.sh` - helper для сборки `cppagent` из GitHub

## Сборка враппера

```bash
cd native/wrapers/cppagent
zig build
zig build test
```

Артефакты:
- `zig-out/lib/libcppagent_wrapper.so`
- `zig-out/include/cppagent_wrapper.h`

## Получить бинарь cppagent

Вариант 1:
- взять готовый релиз `cppagent` с GitHub Releases.

Вариант 2:
- собрать из исходников через helper:

```bash
cd native/wrapers/cppagent
./tools/build_cppagent.sh /tmp/cppagent-build
```

После сборки бинарь обычно здесь:
- `/tmp/cppagent-build/cppagent/build/agent/agent`

## FFI API

См. `include/cppagent_wrapper.h`.

Основные функции:
- `cppagent_wrapper_create/destroy`
- `cppagent_wrapper_start`
- `cppagent_wrapper_stop`
- `cppagent_wrapper_is_running`
- `cppagent_wrapper_pid`
- `cppagent_wrapper_check_health`
- `cppagent_wrapper_get_last_error`
- `cppagent_wrapper_free_buffer`

Коды возврата:
- `0` успех
- `-1` bad handle / bad args
- `-2` runtime error (`get_last_error`)

## Пример на C

```c
#include <stdint.h>
#include <stdio.h>
#include "cppagent_wrapper.h"

int main(void) {
    void *h = cppagent_wrapper_create();
    if (!h) return 1;

    int rc = cppagent_wrapper_start(
        h,
        "/opt/mtconnect/agent",      // cppagent binary
        "/opt/mtconnect/agent.cfg",  // config
        "/opt/mtconnect",            // cwd
        "127.0.0.1",                 // health host
        5000,                        // health port
        "/probe",                    // health path
        5000                         // wait ready timeout ms
    );

    if (rc != 0) {
        uint8_t *err = NULL;
        size_t len = 0;
        if (cppagent_wrapper_get_last_error(h, &err, &len) == 0 && err) {
            fwrite(err, 1, len, stderr);
            fputc('\n', stderr);
            cppagent_wrapper_free_buffer(err, len);
        }
        cppagent_wrapper_destroy(h);
        return 2;
    }

    printf("running=%d pid=%d health=%d\n",
        cppagent_wrapper_is_running(h),
        cppagent_wrapper_pid(h),
        cppagent_wrapper_check_health(h));

    cppagent_wrapper_stop(h, 3000);
    cppagent_wrapper_destroy(h);
    return 0;
}
```

## Ограничения текущей реализации

- Linux/POSIX runtime (fork/exec/kill/waitpid).
- Не оборачивает `agent_lib` C++ API напрямую.
- Health-check только по plain HTTP endpoint.
