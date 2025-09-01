  коротко:

* **LMDB = единый источник правды.** Всё состояние живёт под одним `pid/<ROOT>`.
* **Иерархические ключи.** `pid/<ROOT>/node/.../results|runtime|fanout/...` → прозрачность, быстрые префиксные сканы, без JOIN.
* **Emit-once / Write-once.** Узел исполняется один раз, `results` пишутся один раз.
* **Top-down контроль.** Родитель знает все свои подпроцессы (`fanout/<i>`), управляет ими; у детей нет `parentId` в control-plane.
* **Подпроцессы.** Либо вложенные под тем же root (subwf), либо внешние WF, но с явной ссылкой `child_pid` в родителе.
* **Триггеры.** Новые root PID создаются только извне (очередь/cron/CDC), не внутри DAG.
* **Kill/Pause/Resume.** Ставим tombstone на root → каскадная отмена через `fanout/<i>`.
* **Очереди.** Универсальная модель `enqueue/reserve/ack/nack/dlq` с lease и idempotency\_key, работает и для меж-WF, и для устройств.
* **Single-writer per PID.** Один владелец контекста (lease/raft), recovery через префикс `pid/<ROOT>`.
 