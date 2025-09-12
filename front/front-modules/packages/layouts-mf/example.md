Да, «switch на сотни кейсов» — это боль. Делай **реестр компонентов** (registry) + **саморегистрацию микрофронтов**. Тогда layout рендерит “по данным”, а не через хардкод.

Ниже минимальный, масштабируемый паттерн.

---

# 1) Реестр компонентов (один на приложение)

```ts
// component-registry.ts
export type SlotName = "left" | "center" | "right" | "bottom";
export type CapId = string; // "node.editor", "workflow.inspect", ...

type Loader<P = any> = () => Promise<{ default: React.FC<P> }>;

class ComponentRegistry {
  private map = new Map<string, Loader>();

  // ключ = `${slot}:${capId}`
  register<P>(slot: SlotName, cap: CapId, loader: Loader<P>) {
    this.map.set(`${slot}:${cap}`, loader as Loader);
  }

  get(slot: SlotName, cap: CapId): Loader | undefined {
    return this.map.get(`${slot}:${cap}`);
  }
}

export const registry = new ComponentRegistry();
```

---

# 2) Рендерер слота (универсальный)

```tsx
// SlotRenderer.tsx
import React, { Suspense } from "react";
import { registry } from "./component-registry";

export function SlotRenderer({
  slot,
  cap,
  params,
  fallback,
}: {
  slot: "left" | "center" | "right" | "bottom";
  cap?: string | null;
  params?: any;
  fallback?: React.ReactNode;
}) {
  if (!cap) return null;

  const loader = registry.get(slot, cap);
  if (!loader) return <div className="p-3 text-red-500">Unknown cap: {cap}</div>;

  const Lazy = React.lazy(loader);
  // @ts-expect-error params типизируешь на своём уровне
  return (
    <Suspense fallback={fallback ?? <div className="p-3">Loading…</div>}>
      <Lazy {...(params ?? {})} />
    </Suspense>
  );
}
```

---

# 3) Сцена в Effector остаётся прежней

```ts
// scene-model.ts
import { createStore, createEvent, sample } from "effector";

export interface SceneSlot { cap: string | null; params?: any }
export interface Scene { left: SceneSlot; center: SceneSlot; right: SceneSlot; bottom: SceneSlot }

export const $scene = createStore<Scene>({
  left:   { cap: "menu" },
  center: { cap: "welcome" },
  right:  { cap: null },
  bottom: { cap: null },
});

export const openNode = createEvent<{ workflowId: string; nodeId: string }>();

sample({
  clock: openNode,
  source: $scene,
  fn: (scene, { workflowId, nodeId }): Scene => ({
    ...scene,
    center: { cap: "node.editor", params: { nodeId } },
    right:  { cap: "workflow.inspect", params: { workflowId } },
  }),
  target: $scene,
});
```

---

# 4) Лайаут рендерит по данным (никаких switch)

```tsx
// AppLayout.tsx
import { useUnit } from "effector-react";
import { $scene } from "./scene-model";
import { SlotRenderer } from "./SlotRenderer";

export function AppLayout() {
  const scene = useUnit($scene);
  return (
    <div className="grid grid-cols-[280px_1fr_380px] h-screen">
      <aside className="border-r">
        <SlotRenderer slot="left" {...scene.left} />
      </aside>
      <main>
        <SlotRenderer slot="center" {...scene.center} />
      </main>
      <aside className="border-l">
        <SlotRenderer slot="right" {...scene.right} />
      </aside>
      {/* bottom по желанию */}
    </div>
  );
}
```

---

# 5) Саморегистрация микрофронтов (плагинно)

Каждый micro-frontend экспортит **манифест**, где регистрирует свои компоненты для нужных слотов:

```ts
// mf-node/index.ts (side-effect import)
import { registry } from "@/component-registry";

// center: редактор ноды
registry.register("center", "node.editor", () => import("./NodeEditor"));
// right: инспектор workflow
registry.register("right", "workflow.inspect", () => import("./WorkflowInspect"));
// left: меню DAG
registry.register("left", "dag.menu", () => import("./DagMenu"));
```

Главное приложение просто **один раз** импортирует манифесты (лениво/по условиям фич-флагов):

```ts
// plugins.ts
export async function loadCorePlugins() {
  await Promise.all([
    import("@/mf-node"),     // внутри произойдёт registry.register(...)
    import("@/mf-orders"),
    import("@/mf-audio"),
  ]);
}
```

Вызываешь `loadCorePlugins()` в точке входа; дальше всё работает «по данным».

---

# 6) Кастомизация без хардкода

* **Варианты:** регистрируй разные cap по ID (например, `"node.editor@compact"`), а в сцене выбирай нужный.
* **Версии:** `"node.editor@v2"` — мигрируешь сцену или делаешь алиас.
* **Фолбэк:** если компонента нет, `SlotRenderer` уже показывает «Unknown cap».

---

# 7) (Опционально) типобезопасность

Можно завести общий тип реестра, если хочешь строгую типизацию `params`:

```ts
// contracts.d.ts
export interface CapContracts {
  "node.editor": { nodeId: string }
  "workflow.inspect": { workflowId: string }
  "dag.menu": void
  "welcome": void
}
// helper:
type CapParams<K extends keyof CapContracts> = CapContracts[K] extends void ? {} : CapContracts[K];
```

И использовать generics в `register<K extends keyof CapContracts>(slot, cap: K, loader: () => Promise<{default: FC<CapParams<K>>}>)`.

---

## Что получаешь

* **Ноль switch-case** — только реестр.
* **Масштабирование до сотен компонентов**: каждый МФ сам регистрирует свои cap → слот.
* **Lazy-chunking**: компоненты грузятся по требованию.
* **Горизонтальное расширение**: добавить новый cap = выпустить МФ, который сам себя зарегистрирует.

Если хочешь, добью примером с «вариантами» (compact/detailed) и алиасами (`registry.alias("node.edit","node.editor@v2")`), чтобы миграции проходили без боли.
