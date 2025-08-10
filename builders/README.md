
## Как использовать

1.  В `package.json` вашего проекта, где вы хотите использовать эту утилиту, добавьте скрипт в секцию `"scripts"`:

    ```json
    "scripts": {
      "build:rpc": "bun run <path-to-nrpc>/src/builder.ts src/service-implementation.ts src/service-interface.ts dist/"
    }
    ```

    Замените:
    *   `<path-to-nrpc>` на путь к пакету `nrpc`.
    *   `src/service-implementation.ts` на путь к файлу с реализацией вашего сервиса.
    *   `src/service-interface.ts` на путь к файлу с определением интерфейса вашего сервиса.
    *   `dist/` на директорию для сгенерированных файлов.

2.  Запустите скрипт:

    ```bash
    bun run build:rpc
    ```