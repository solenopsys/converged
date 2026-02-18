# marlin-octoprint-adapter

Zig-адаптер для управления Marlin по serial-порту с FFI API.

Цель: дать легковесную библиотеку (`.so` + `.h`) с интерфейсом команд уровня OctoPrint (`job`, `printhead`, `tool`, `bed`, `chamber`, `sd`, `connection`, `control`), чтобы вызывать из любого языка через FFI.

## Что реализовано

- Serial I/O на POSIX (`termios`, `open/read/write`).
- Очередь команд с `ok/wait`, `Resend`, line numbers/checksum (`N...*checksum`).
- Базовые состояния принтера (`disconnected/connecting/operational/printing/paused/error`).
- Загрузка gcode-файла и печать по линиям.
- FFI-команды интерфейса (без HTTP-слоя OctoPrint).
- Телеметрия:
  - температуры (`T`, `B`, `C`);
  - позиция (`X/Y/Z/E`);
  - SD progress (`SD printing byte ...`);
  - `FIRMWARE_NAME`;
  - `//action:*`.

## Структура

- `build.zig` - сборка библиотеки и тестов.
- `src/main.zig` - вся логика serial + FFI экспорты.
- `include/marlin_octoprint_adapter.h` - C ABI header.
- `zig-out/lib/libmarlin_octoprint_adapter.so` - собранная библиотека.
- `zig-out/include/marlin_octoprint_adapter.h` - установленный header.

## Требования

- Linux (используется `termios`/`unistd`).
- Zig 0.15.x.
- Доступ к serial устройству (`/dev/tty*`) у пользователя.

## Сборка

```bash
cd gestalt/clarity/projects/converged-portal/native/adapters/marlin-octoprint
zig build
zig build test
```

Артефакты:

- `zig-out/lib/libmarlin_octoprint_adapter.so`
- `zig-out/include/marlin_octoprint_adapter.h`

## Быстрый FFI старт (C)

```c
#include <stdint.h>
#include <stdio.h>
#include "marlin_octoprint_adapter.h"

int main(void) {
    void *h = marlin_adapter_create();
    if (!h) return 1;

    if (marlin_adapter_connect(h, "/dev/ttyUSB0", 115200) != 0) {
        marlin_adapter_destroy(h);
        return 2;
    }

    marlin_interface_command_t cmd = {0};
    cmd.command_id = MARLIN_CMD_PRINTHEAD_JOG;
    cmd.axis_mask = MARLIN_AXIS_X;
    cmd.value_a = 5.0;   // X
    cmd.value_d = 1800;  // F
    marlin_adapter_execute_command(h, &cmd);

    cmd.command_id = MARLIN_CMD_TOOL_TARGET;
    cmd.heater = MARLIN_HEATER_CURRENT_TOOL;
    cmd.value_a = 205.0;
    marlin_adapter_execute_command(h, &cmd);

    cmd.command_id = MARLIN_CMD_BED_TARGET;
    cmd.value_a = 60.0;
    marlin_adapter_execute_command(h, &cmd);

    // Прямой gcode
    marlin_adapter_queue_gcode(h, "M105");

    uint8_t *json = NULL;
    size_t json_len = 0;
    if (marlin_adapter_get_state_json(h, &json, &json_len) == 0 && json) {
        fwrite(json, 1, json_len, stdout);
        putchar('\n');
        marlin_adapter_free_buffer(json, json_len);
    }

    marlin_adapter_disconnect(h);
    marlin_adapter_destroy(h);
    return 0;
}
```

Пример компиляции:

```bash
cc example.c \
  -I./zig-out/include \
  -L./zig-out/lib \
  -lmarlin_octoprint_adapter \
  -Wl,-rpath,'$ORIGIN/zig-out/lib'
```

## Lifecycle API

1. `marlin_adapter_create()`
2. `marlin_adapter_connect(handle, port, baudrate)`
3. Вызовы команд:
   - `marlin_adapter_execute_command(...)`
   - `marlin_adapter_execute_command_simple(...)`
   - `marlin_adapter_queue_gcode(...)` для raw gcode
4. Состояние:
   - `marlin_adapter_get_state_code(...)`
   - `marlin_adapter_get_state_json(...)`
5. Освобождение:
   - `marlin_adapter_free_buffer(...)` для JSON буфера
   - `marlin_adapter_disconnect(...)`
   - `marlin_adapter_destroy(...)`

## Коды возврата

Общий контракт (почти у всех экспортов):

- `0`: успех
- `-1`: invalid handle/arguments
- `-2`: ошибка выполнения (валидация, не то состояние, ошибка очереди/serial и т.д.)

## Модель команд FFI

Команда:

```c
typedef struct marlin_interface_command {
    int32_t command_id;
    uint32_t flags;
    uint32_t axis_mask;
    int32_t tool;
    int32_t heater;
    double value_a;
    double value_b;
    double value_c;
    double value_d;
    const char *text;
} marlin_interface_command_t;
```

### Семантика полей

- `command_id`: тип команды (`MARLIN_CMD_*`).
- `flags`: флаги команды. Сейчас используется `MARLIN_FLAG_JOG_ABSOLUTE`.
- `axis_mask`: маска осей (`MARLIN_AXIS_X/Y/Z`) для `jog/home`.
- `tool`: индекс экструдера (`0..7`), где нужно.
- `heater`: `MARLIN_HEATER_*` для `tool_target`.
- `value_a..value_d`: числовые параметры команды.
- `text`: строка для `RAW_GCODE/RAW_SCRIPT`.

## Полный список команд интерфейса

Ниже перечислены все поддержанные команды и что они делают внутри адаптера.

### job

- `MARLIN_CMD_JOB_START` (`1`)
  - Запуск печати загруженного файла.
- `MARLIN_CMD_JOB_RESTART` (`2`)
  - В текущей реализации эквивалентен `start`.
- `MARLIN_CMD_JOB_PAUSE` (`3`)
  - Пауза локального print loop.
- `MARLIN_CMD_JOB_RESUME` (`4`)
  - Возобновление локального print loop.
- `MARLIN_CMD_JOB_TOGGLE_PAUSE` (`5`)
  - Toggle pause/resume.
- `MARLIN_CMD_JOB_CANCEL` (`6`)
  - Остановка печати и сброс прогресса.

### printhead

- `MARLIN_CMD_PRINTHEAD_JOG` (`10`)
  - `axis_mask`: какие оси двигать.
  - `value_a/value_b/value_c`: шаг по `X/Y/Z`.
  - `value_d`: feedrate `F` (опционально).
  - `flags & MARLIN_FLAG_JOG_ABSOLUTE == 0`:
    - `G91`, `G0 ...`, `G90`.
  - `flags & MARLIN_FLAG_JOG_ABSOLUTE != 0`:
    - `G90`, `G0 ...`.
- `MARLIN_CMD_PRINTHEAD_HOME` (`11`)
  - `axis_mask`: оси.
  - Отправляет: `G91`, `G28 X0 Y0 Z0` (по маске), `G90`.
- `MARLIN_CMD_PRINTHEAD_FEEDRATE` (`12`)
  - `value_a`: фактор.
  - Если `<= 10.0`, трактуется как множитель (`1.25` => `125%`).
  - Если `> 10.0`, трактуется как уже процент.
  - Отправляет `M220 S<percent>`.

### tool

- `MARLIN_CMD_TOOL_SELECT` (`20`)
  - `tool`: `0..7`.
  - Отправляет `T<tool>`.
- `MARLIN_CMD_TOOL_TARGET` (`21`)
  - `heater`:
    - `MARLIN_HEATER_CURRENT_TOOL`: `M104 S<temp+offset[current]>`
    - `MARLIN_HEATER_TOOL`: `M104 T<tool> S<temp+offset[tool]>`
    - `MARLIN_HEATER_BED`: как `BED_TARGET`
    - `MARLIN_HEATER_CHAMBER`: как `CHAMBER_TARGET`
  - `value_a`: целевая температура.
  - `tool`: нужен, если `heater=MARLIN_HEATER_TOOL`.
- `MARLIN_CMD_TOOL_OFFSET` (`22`)
  - `value_a`: offset для инструмента.
  - `tool`: `0..7` (или `-1`, тогда текущий инструмент).
  - Важно: offset хранится локально в адаптере и применяется к future target-командам.
- `MARLIN_CMD_TOOL_EXTRUDE` (`23`)
  - `value_a`: amount `E`.
  - `value_b`: speed `F` (если `<=0`, используется дефолт `300`).
  - Отправляет: `G91`, `M83`, `G1 E... F...`, `M82`, `G90`.
- `MARLIN_CMD_TOOL_FLOWRATE` (`24`)
  - `value_a`: фактор, правила как у feedrate.
  - Отправляет `M221 S<percent>`.

### bed/chamber

- `MARLIN_CMD_BED_TARGET` (`30`)
  - `value_a`: target.
  - Отправляет `M140 S<target+bed_offset>`.
- `MARLIN_CMD_BED_OFFSET` (`31`)
  - `value_a`: локальный offset для bed.
- `MARLIN_CMD_CHAMBER_TARGET` (`32`)
  - `value_a`: target.
  - Отправляет `M141 S<target+chamber_offset>`.
- `MARLIN_CMD_CHAMBER_OFFSET` (`33`)
  - `value_a`: локальный offset для chamber.

### sd

- `MARLIN_CMD_SD_INIT` (`40`) -> `M21`
- `MARLIN_CMD_SD_REFRESH` (`41`) -> `M20`
- `MARLIN_CMD_SD_RELEASE` (`42`) -> `M22`

### connection/control

- `MARLIN_CMD_CONNECTION_REPAIR` (`50`)
  - Локальный reset ожидания `ok`/resend (аналог fake ack поведения на уровне адаптера).
- `MARLIN_CMD_EMERGENCY_STOP` (`51`)
  - Отправляет `M112`.
- `MARLIN_CMD_RAW_GCODE` (`60`)
  - `text`: одна команда gcode.
- `MARLIN_CMD_RAW_SCRIPT` (`61`)
  - `text`: многострочный gcode (`\n`-разделитель), каждая строка отправляется отдельно.

## Дополнительные API функции

- `marlin_adapter_queue_gcode(handle, "G28")`
  - Прямая постановка single gcode в очередь.
- `marlin_adapter_load_print_file(handle, path)`
  - Загружает gcode-файл в память и подготавливает к `start_print`.
- `marlin_adapter_start_print/pause_print/resume_print/cancel_print`
  - Низкоуровневые print control функции (дублируют `job` команды).

## Снимок состояния (`get_state_json`)

JSON содержит:

- `connected`, `state`, `port`, `baudrate`
- `awaiting_ok`, `checksum_enabled`
- `printing`, `paused`, `print_index`, `print_total`
- `queue_depth`, `line_number`
- `firmware_name`, `last_error`, `last_line`
- `telemetry`:
  - `hotend_actual/hotend_target`
  - `bed_actual/bed_target`
  - `chamber_actual/chamber_target`
  - `pos_x/pos_y/pos_z/pos_e`
  - `sd_current/sd_total`
  - `progress`
- `current_tool`
- `tool_offsets` (8 значений)
- `bed_offset`, `chamber_offset`

## Поведение serial-слоя

- При connect адаптер ставит в очередь:
  - `M110 N0`
  - `M115`
  - `M155 S2`
  - `M154 S5`
- Периодический polling:
  - `M105` каждые ~2s
  - `M114` каждые ~5s
- Обработка ответов:
  - `ok`, `wait`
  - `Resend`/`rs`
  - `error:`/`!!`
  - `//action:pause/resume/cancel/start`

## Ограничения (важно)

Это не полный OctoPrint runtime. Это FFI-адаптер, совместимый по командному интерфейсу.

Сейчас упрощены:

- Нет HTTP API, auth, users, permissions.
- Нет плагинной системы OctoPrint.
- Нет полного сценарного движка `sendGcodeScript`:
  - `RAW_SCRIPT` = только multiline gcode.
- Нет полной SD file-management логики OctoPrint (только `M21/M20/M22` через команды).
- Offset логика реализована локально в адаптере (как легкий слой).

## Отладка

- Проверять `marlin_adapter_get_state_json` для `last_error`, `last_line`, `queue_depth`, `awaiting_ok`.
- Если зависло ожидание подтверждения:
  - вызвать `MARLIN_CMD_CONNECTION_REPAIR`.
- Проверить права на `/dev/tty*` и корректный `baudrate`.

## Источник интерфейсов

Командная модель бралась из актуальных API/клиентских команд OctoPrint:

- `src/octoprint/server/api/printer.py`
- `src/octoprint/server/api/job.py`
- `src/octoprint/server/api/connection.py`
- `src/octoprint/plugins/serial_connector/connector.py`
- `src/octoprint/plugins/serial_connector/serial_comm.py`

И адаптирована к легковесному FFI API без HTTP-обвязки.
