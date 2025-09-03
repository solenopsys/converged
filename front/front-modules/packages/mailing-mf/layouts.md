ты всё правильно чувствуешь: если мы «отвязываем» UI от страниц, одного флага «приоритет размещения» мало. Нужен **отдельный менеджер лайаутов**, который принимает «запросы на размещение» от команд/компонентов и **детерминированно** решает, как разложить панели. Вот минимальная схема, которая работает и не превращается в монстра.

# 1) Модель вместо «жёстких страниц»

Вводим три сущности:

**A. Роли панелей (не компоненты!)**

* `primary` — основное содержимое (детали/таблица/редактор).
* `inspector` — боковая «инспекция/форма».
* `preview` — предпросмотр/медиа.
* `navigator` — список/фильтры.
* `console` — логи/прогресс/ошибки.
  (Добавишь свои, но держи короткий список.)

**B. Шаблоны лайаута (templates)**

* `single` (одно окно),
* `master-detail` (main + side),
* `tri-split` (left + main + right),
* `main-bottom` (main + bottom console).

**C. Правила раскладки (policy)**
Условия → какой шаблон/куда класть панель.

Пример (YAML-вид, хранится рядом с кодом):

```yaml
templates:
  master-detail:
    slots:
      main:  { roles: ["primary"],  minw: 520, grow: 2 }
      side:  { roles: ["inspector","preview"], minw: 320, grow: 1, collapsible: true }
  main-bottom:
    slots:
      main:  { roles: ["primary"], minh: 360, grow: 2 }
      bottom:{ roles: ["console","preview"], minh: 180, grow: 1, collapsible: true }

rules:
  - when: { device: "mobile" } use: { template: "single", inspector: "sheet" }
  - when: { needs: ["primary","inspector"] } use: { template: "master-detail", side: { anchor: "right", width: 360 } }
  - when: { needs: ["primary","console"] }   use: { template: "main-bottom", bottom: { height: "30%" } }
  - place:
      - if: { role: "inspector" } then: { slot: "side" }
      - if: { role: "console" }   then: { slot: "bottom" }
fallbacks:
  - collapse: "inspector"   # если не помещается — свернуть
  - tabify: ["preview"]     # сложить в табы
```

# 2) Как «команда» просит лайаут (а не диктует)

Команда **не говорит** «открой справа», она даёт **подсказку**:

```ts
presentationHint: {
  role: "inspector",              // какую роль хочет контент
  affinity: { entity: "order", id: "ORD-42" }, // к чему примкнуть
  exclusivity: "editor",          // взаимоисключающие группы
  preferred: { side: "right", width: 360 }, // необязательные пожелания
}
```

Layout Manager принимает *несколько* таких запросов от команд и «решает» по policy.

# 3) Алгоритм размещения (детерминированный)

1. **Собери потребности**: набор ролей, их количество, эксклюзивные группы.
2. **Выбери шаблон** по `rules.when` (учитывая device/pointer/размер).
3. **Расположи** панели по `rules.place` и ролям слотов.
4. **Примени предпочтения** (ширина/якорь) если не конфликтуют.
5. Если конфликты → **fallbacks**: свернуть/переключить в таб/перекрыть `sheet`.
6. Верни **UI-план**: `OPEN_SURFACE(template) + ATTACH(role→component)`.

> Важно: решение **всегда** воспроизводимо для одинакового контекста.

# 4) Мини-ABI для лайаута (что должен уметь рантайм)

```ts
type TemplateId = "single" | "master-detail" | "tri-split" | "main-bottom";
type Role = "primary" | "inspector" | "preview" | "navigator" | "console";

type LayoutRequest = {
  role: Role;
  key: string;                    // стабильный идентификатор панели (напр. entityId)
  affinity?: { entity?: string; id?: string };
  preferred?: { side?: "left"|"right"; width?: number; height?: number };
  exclusivity?: "editor"|"media"|"job";
};

interface LayoutManager {
  apply(requests: LayoutRequest[], env: { device:"mobile"|"desktop"; width:number; height:number }): LayoutPlan;
}

type LayoutPlan = {
  template: TemplateId;
  slots: Record<string, { role: Role; key: string }[]>;  // несколько панелей могут быть табами в слоте
  overlays?: Array<{ role: Role; key: string; surface: "sheet"|"modal" }>;
};
```

# 5) Где брать «requests»

* Из **результата команды** (cap выводит `presentationHint.role`).
* Из **событий пользовательских действий** («открыть редактирование» → `role:"inspector", exclusivity:"editor"`).
* Из **предпочтений юзера** (пин панели = постоянный request).

# 6) Пользовательские конфигурации («рабочие места»)

* Сохраняй **layout recipe** на пользователя/домен: выбранный `template`, закреплённые панели (`role+key`), размеры слотов.
* Любая команда **не ломает** рецепт: она лишь подсовывает `request`, а менеджер вписывает его в текущий шаблон или уводит в sheet/modal, если не лезет.
* Быстрая смена рабочего места: «Аналитика», «Операции», «Поддержка» — это разные recipes одного и того же движка.

# 7) Почему твой «приоритет» не решал

Приоритет — это только **кто важнее**. Но лайаут — это **задача размещения с ограничениями**:

* роли и слоты,
* минимальные размеры,
* совместимость и эксклюзивность,
* среда (мобила/десктоп),
* предпочтения юзера.

Без формальных **правил** и **шаблонов** приоритет ведёт к хаосу (или к жёстко пришитым панелям).

# 8) Что сделать прямо сейчас (коротко)

1. Ввести **роли** и **шаблоны** (4 шт. хватит).
2. Описать **policy rules** как в YAML выше.
3. Научить команды отдавать **presentationHint.role/affinity**.
4. Написать функцию `apply(requests, env) → LayoutPlan` и **удерживать** её детерминизм тестами.
5. Сохранение/загрузка **layout recipe** на юзера.

# 9) Пример сценария (как это работает)

* Команда: «Открыть заказ ORD-42» → `role:"primary", affinity:{entity:"order",id:"ORD-42"}`.
  Политика (desktop) выбирает `master-detail`, кладёт детали в `main`.
* Команда: «Редактировать» → `role:"inspector", exclusivity:"editor"`.
  Менеджер кладёт форму в `side` шириной 360; другой `editor` закроется по exclusivity.
* Команда: «Показать логи» → `role:"console"`.
  Шаблон меняется на `main-bottom` или добавляется нижняя док-панель (по policy).
* На мобиле то же самое уходит в `sheet` (правило `device=mobile`).

---

Итог: ты сохраняешь **командную парадигму** (никаких страниц), но получаешь **контролируемые конфигурации панелей** через роли + шаблоны + правила. Это понятнее, чем «ручной лайаут», и **детерминированно** — как ты и хотел.
