Да, фокус — **контекст в LMDB как единый источник правды**. Сведу в короткую «Spec v0.1», чтобы без двусмысленностей.

# Что фиксируем

* **Single source of truth:** всё состояние workflow лежит в LMDB под **одним root PID** (иерархические ключи).
* **Emit-once / Write-once:** узел исполняется один раз; финал пишется один раз.
* **Top-down контроль:** управление только сверху вниз; снизу — только статусы/телеметрия.

# Иерархия ключей (пример)

```
pid/<ROOT>/meta                     // версия графа, автор, таймштампы запуска
pid/<ROOT>/tombstone                // {reason, ts} для kill/stop

pid/<ROOT>/sched/ready/<nodeId>     // фронтир готовых узлов (после seal)
pid/<ROOT>/locks/<nodeId>           // CAS-замок (owner, lease_until)
pid/<ROOT>/runtime/<nodeId>         // {state:"started", owner, ts, heartbeat}

pid/<ROOT>/results/<nodeId>         // WRITE-ONCE финал узла (status, data|error, ts*)

# Сплиттер-обёртка (fan-out ссылками на внешние WF)
pid/<ROOT>/node/<Splitter>/fanout/<i> = {
  item_key,                         // детерминированный ключ элемента (хеш/ID)
  child_ref: {
    target,                         // имя/версия внешнего WF
    idempotency_key,                // для очереди запуска
    child_pid?,                     // PID внешнего WF (когда он стартован)
    state,                          // pending|enqueued|launched|succeeded|failed|canceled|timeout
    enqueued_at?, launched_at?, finished_at?, last_error?
  }
}

# (опц) агрегатор результатов детей/каналы
pid/<ROOT>/results/<Aggregator> = {
  policy, counts{total,done,ok,fail,timeout,canceled},
  out: { ok:[], retryable:[], hardfail:[], timeout:[] } | result: ...
}
```

> Длинные сегменты (имена, item\_key) — **хешируй**, чтобы уложиться в лимит ключа LMDB (≤ 511 байт).

# Инварианты

* **Single-writer per PID:** sticky-routing + lease; в момент времени пишет один владелец.
* **Seal-once:** вход узла фиксируется перед стартом; после seal вход не меняется.
* **Write-once:** `results/<nodeId>` записывается ровно один раз (CAS/putIfAbsent).
* **Нет обратных ссылок:** дети не хранят `parentId` в control-plane (только в аналитике при желании).
* **Идемпотентный спавн/запуск:** все идентификаторы детерминированы (child\_pid, idempotency\_key).

# Очереди и триггеры (как стыкуем)

* **Между workflow:** единая таблица/очередь `inbox` с `enqueue/reserve/ack/nack/dlq`, `idempotency_key`, `lease_until`.
* **Запуск внешних WF для fan-out:** родитель публикует задачи (по `idempotency_key`), триггер стартует WF, возвращает `child_pid` и обновляет `fanout/<i>.state`.
* **Команды устройствам:** пер-машинные очереди с ack/timeout и идемпотентными `command_id`.

# Управление (top-down)

* **Kill:** ставим `tombstone` на root → отменяем `pending/enqueued`, рассылаем `Cancel(child_pid)` тем, кто `launched`, ждём финалов по `fanout/*`.
* **Pause/Resume:** аналогично через команды сверху вниз; записи — рядом с узлом/детём в его префиксе.

# Наблюдаемость (минимум)

* По префиксу `pid/<ROOT>/`: видно всё — кто готов, кто стартован, кто завершён.
* У сплиттера/агрегатора: `policy`, `counts`, сводка по каналам/результату.
* Метрики очередей: `ready/reserved/done/dead`, возраст элементов p95.

# Практические советы

* Храни ID как **BINARY(16)** (UUID v4/v7), наружу — **base64url(22)**.
* Любые переменные/длинные сегменты ключей — **SHA-256 → первые 16 байт**.
* Делай периодические **снапшоты** и **компакцию** (журнал событий опционален, проекции — главные).
* chaos-тест: убивай воркера в любой фазе — одновременного двойного запуска быть не должно (lease защитит).

Это и есть «единый источник правды в LMDB»: один корень на процесс, префиксные сканы вместо JOIN, строгие write-once/emit-once, и управляемый top-down контроль.
