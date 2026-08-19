# bambu-local-adapter

Локальный Zig-адаптер для принтеров Bambu Lab без облака.

Транспорт:
- MQTT over TLS (`ssl://<printer-ip>:8883`)
- логин: `bblp`
- пароль: `access code` принтера

Назначение:
- управление печатью (pause/resume/stop)
- отправка raw JSON команд
- отправка raw G-code через `gcode_line`
- получение телеметрии и ошибок через callback
- использование как FFI библиотеки (`.so + .h`)

## Что реализовано

- C ABI (`include/bambu_local_adapter.h`)
- локальное подключение к принтеру (`bambu_adapter_connect`, `bambu_adapter_connect_ex`)
- подписка на `device/<serial>/report`
- публикация в `device/<serial>/request`
- handshake, как в HA интеграции:
  - `get_version`
  - `pushall`
- команды:
  - `pause`
  - `resume`
  - `stop`
  - `gcode_line`
  - raw JSON
  - `get_version`, `pushall`, `start push`
- callback событий:
  - `BAMBU_EVENT_CONNECTED`
  - `BAMBU_EVENT_DISCONNECTED`
  - `BAMBU_EVENT_REPORT_RAW`
  - `BAMBU_EVENT_TELEMETRY` (`print` payload)
  - `BAMBU_EVENT_INFO` (`info` payload)
  - `BAMBU_EVENT_SYSTEM` (`system` payload)
  - `BAMBU_EVENT_ERROR` (при `print_error != 0` или `mc_print_error_code != "0"`)
- snapshot состояния через `bambu_adapter_get_state_json`

## Структура

- `build.zig` - сборка `.so`
- `src/main.zig` - MQTT/TLS + парсинг + FFI exports
- `include/bambu_local_adapter.h` - C header
- `vendor/paho.mqtt.c` - вендор MQTT C клиента
- `vendor/openssl-devel` - локальные OpenSSL headers/libs для сборки (без установки `-devel` пакетов в систему)

## Сборка

```bash
cd gestalt/clarity/projects/converged-portal/native/adapters/bambu-local
zig build
zig build test
```

Артефакты:

- `zig-out/lib/libbambu_local_adapter.so`
- `zig-out/include/bambu_local_adapter.h`

## Быстрый C пример

```c
#include <stdio.h>
#include <stdint.h>
#include "bambu_local_adapter.h"

static void on_event(void *user_data, int32_t event_type, const uint8_t *payload, size_t payload_len) {
    (void)user_data;
    printf("event=%d payload=%.*s\n", event_type, (int)payload_len, (const char *)payload);
}

int main(void) {
    void *h = bambu_adapter_create();
    if (!h) return 1;

    bambu_adapter_set_event_callback(h, on_event, NULL);

    // По умолчанию insecure TLS включен (для локальных self-signed сертификатов)
    if (bambu_adapter_connect(h, "192.168.1.80", "01P00C123456789", "12345678") != 0) {
        bambu_adapter_destroy(h);
        return 2;
    }

    bambu_adapter_request_version(h);
    bambu_adapter_request_push_all(h);

    bambu_adapter_send_gcode_line(h, "M105");

    bambu_adapter_pause_print(h);
    bambu_adapter_resume_print(h);

    // Raw JSON (любой поддержанный принтером command)
    bambu_adapter_send_raw_json(
        h,
        "{\"print\":{\"sequence_id\":\"0\",\"command\":\"stop\"}}"
    );

    uint8_t *state = NULL;
    size_t state_len = 0;
    if (bambu_adapter_get_state_json(h, &state, &state_len) == 0 && state) {
        printf("state=%.*s\n", (int)state_len, (const char *)state);
        bambu_adapter_free_buffer(state, state_len);
    }

    bambu_adapter_disconnect(h);
    bambu_adapter_destroy(h);
    return 0;
}
```

Компиляция примера:

```bash
cc example.c \
  -I./zig-out/include \
  -L./zig-out/lib \
  -lbambu_local_adapter \
  -Wl,-rpath,'$ORIGIN/zig-out/lib'
```

## API: главное

Lifecycle:

1. `bambu_adapter_create`
2. `bambu_adapter_set_event_callback`
3. `bambu_adapter_connect` или `bambu_adapter_connect_ex`
4. команды (`*_pause_*`, `*_resume_*`, `*_send_raw_json`, `*_send_gcode_line` и т.д.)
5. `bambu_adapter_get_state_json` (опционально)
6. `bambu_adapter_disconnect`
7. `bambu_adapter_destroy`

Коды возврата:

- `0` - успех
- `-1` - invalid args / invalid handle
- `-2` - execution error

## Примечания по безопасности

- `bambu_adapter_connect()` использует `insecure TLS` для максимальной совместимости в LAN.
- Если нужен строгий TLS, используйте `bambu_adapter_connect_ex(..., insecure_tls=0, ca_cert_path="/path/to/ca.pem")`.

## Что важно для FFI

- Callback payload передается как `const uint8_t* + size_t`.
- Payload буфер валиден только в рамках вызова callback.
- Для долгого хранения копируйте payload на своей стороне.

## Ограничения

- Только LAN режим (без Bambu Cloud).
- Камера/FTPS в этот адаптер не включены.
- Поддерживается generic управление и телеметрия через MQTT payload.
