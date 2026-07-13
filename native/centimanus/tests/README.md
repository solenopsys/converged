# Tests

## Unit tests (storage chain, no infrastructure)

Проверяют, что Store/Transcript/Recorder реально заполняют хранилища
(threads, calls/fragments, context) при прохождении данных через шлюз.
Работают против in-memory мока behemoth transport
(`converged-portal/native/behemoth/transport/src/mock.zig`) — тот же C ABI
и тот же dlopen-путь, что в проде, но без сокетов и стораджа.

```bash
zig build test-store   # только storage-тесты (src/store_tests.zig)
zig build test         # все unit-тесты
```

# Integration Tests

```bash
pip install -r requirements.txt

# Тест только Zig (запущен на порту 8090)
RUN_ZIG=1 pytest -v

# Тест обоих (Go на 8081, Zig на 8090)
RUN_GO=1 RUN_ZIG=1 pytest -v

# С mock OpenAI (OPENAI_REALTIME_CALLS_URL должен указывать на mock)
RUN_ZIG=1 pytest -v test_sip.py::TestSipWithMockOpenAI

# Только сравнительные тесты Go vs Zig
RUN_GO=1 RUN_ZIG=1 pytest -v test_compare.py
```

## Переменные окружения

| Переменная | Default | Описание |
|---|---|---|
| `RUN_GO` | `0` | Включить Go gateway |
| `RUN_ZIG` | `1` | Включить Zig gateway |
| `GO_HTTP_PORT` | `8081` | HTTP порт Go |
| `GO_SIP_PORT` | `5060` | SIP порт Go |
| `ZIG_HTTP_PORT` | `8090` | HTTP порт Zig |
| `ZIG_SIP_PORT` | `5061` | SIP порт Zig |
| `MOCK_OPENAI_PORT` | `19876` | Порт mock OpenAI сервера |
