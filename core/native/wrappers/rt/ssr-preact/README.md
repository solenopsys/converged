# ssr-preact — тестовый Preact SSR-проект для прогона на 3 движках

Минимальный SSR через `preact-render-to-string`, собранный в **один JS-файл**
без импортов — такой бандл грузится в JSC / QuickJS / V8 как source buffer
через общий `Engine.load` + вызывается через `globalThis.__crullerHandle`.

Конвенция хендлера (синхронная, engine-neutral):
- вход: UTF-8 JSON `{"method","path","headers","body"}`;
- выход: UTF-8 JSON `{"status","headers","body"}` (body — полный HTML).

Ендпоинты:
- `/`, `/about`, любой другой путь → Preact SSR (`Page`), 200 + `text/html`;
- `/calc[?iterations=N]` → детерминированный CPU: целочисленный hash-chain
  (`Math.imul`, 32-bit), default 100000 итераций, max 1000000.
  Ответ 200 + `application/json` с точной контрольной суммой
  (`{"result":502474356,"iterations":100000}`) — бенч-харнес сверяет её
  строго, расхождение движков = mismatch, а не шум;
- битый JSON → 400 `bad request`.

```bash
bun install
bun run bundle     # -> dist/bundle.js (iife, browser, minify)
```

Проверка на движках — из `../cruller`:
```bash
zig build rt-test   # юнит-тесты движков, включая SSR-слайс
```
Кросс-движковый прогон готового `dist/bundle.js` — см. `../cruller/ssr-run/`
(план) или `zig build ssr-run -Dbundle=...`.
