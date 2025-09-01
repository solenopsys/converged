
Если положить **state первым сегментом**, то:

* `pid/<ROOT>/result/*` → одним range-scan сразу видишь **все готовые узлы**.
* `pid/<ROOT>/start/*` → видишь все «живые попытки» (активные, без результата).
* Проверка зависимостей: просто смотришь, есть ли `result/<predId>` у предков.
* Определение «workflow завершён» → если кол-во `result/*` == кол-ву узлов в схеме → конец.

---

# 🔑 Минимальная схема (state-first)

```
pid/<ROOT>/meta                  → { wf_version, created_at, total_nodes }

pid/<ROOT>/start/<nodeId>/<ts>   → { owner, lease }       // попытки запуска
pid/<ROOT>/result/<nodeId>       → { status, data, ts }   // финал (write-once)

pid/<ROOT>/tombstone?            → { reason, ts }         // для kill/stop
```

---

# ⚙️ Как работает процессор `step(pid)`

1. Проверяет `tombstone` → если есть → завершение с флагом kill.
2. Сканирует `result/*` → знает, какие узлы завершены.
3. По схеме (из `meta`) находит узлы, у которых **все предки есть в `result/*`** и самих ещё нет в `result/*`.
4. Для такого узла добавляет `start/<id>/<now>` с lease.
5. Возвращает «запущен узел X» или, если `result/*` == `total_nodes`, то «workflow завершён».

---

# 📈 Пример

```
pid/42/start/A/1000   → {owner=w1}
pid/42/result/A       → {status:ok}

pid/42/start/B/1010   → {owner=w2}
pid/42/result/B       → {status:ok}

pid/42/start/C/1050   → {owner=w3}
(нет result/C)
```

* result/A, result/B есть → C считается готовым (все зависимости закрыты).
* Нет result/C → C ещё в работе.
* Когда появится result/C → счётчик result == total\_nodes → сигнал «workflow завершён».

---

# ⚖️ Выгоды state-first

* **Мгновенный обзор:** одним range-scan по `result/*` → видно, что уже готово.
* **Чистая модель:** `start/*` = попытки, `result/*` = факты, никаких промежуточных «runtime/ready».
* **Простое условие окончания:** `count(result/*) == total_nodes`.

---
