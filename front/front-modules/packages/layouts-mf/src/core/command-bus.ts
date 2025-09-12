import { createEvent, createEffect, forward, split, createStore, sample } from "effector"

// 1) Универсальный контракт команд
type Cmd =
  | { type: "orders.list"; payload: { q?: string; page?: number } }
  | { type: "wf.open"; payload: { workflowId: string } }
  | { type: "wf.rebuild"; payload: { workflowId: string; strategy?: "clean"|"cache" } }
  | { type: "auth.logout"; payload: {} }
  // ...добавляешь без боли

// 2) Единый входной поток команд
export const commandDispatched = createEvent<Cmd>();

// 3) Фичевые события, которые ты уже бросаешь из UI/LLM/меню
export const ordersListRequested = createEvent<{ q?: string; page?: number }>();
export const workflowOpenRequested = createEvent<{ workflowId: string }>();
export const workflowRebuildRequested = createEvent<{ workflowId: string; strategy?: "clean"|"cache" }>();
export const logoutRequested = createEvent();

// Форвард в общую шину (одно место входа)
forward({ from: ordersListRequested.map(p => ({ type: "orders.list", payload: p }) as Cmd), to: commandDispatched });
forward({ from: workflowOpenRequested.map(p => ({ type: "wf.open", payload: p }) as Cmd), to: commandDispatched });
forward({ from: workflowRebuildRequested.map(p => ({ type: "wf.rebuild", payload: p }) as Cmd), to: commandDispatched });
forward({ from: logoutRequested.map(() => ({ type: "auth.logout", payload: {} } as Cmd)), to: commandDispatched });

// 4) Твой финальный обработчик (одна точка правды)
const processCommandFx = createEffect<Cmd, unknown, Error>(async (cmd) => {
  // здесь твой CommandBus/Router:
  // - валидация/нормализация (из TS-рефлексии)
  // - идемпотентность (hash от payload)
  // - роутинг: ui|rpc|hybrid
  // - метрики/логирование
  switch (cmd.type) {
    case "orders.list":
      // rpc → nRPC.orders.list(...)
      return /* result */;
    case "wf.open":
      // ui → обнови сцену/слоты (Effector-интент), URL sync побочным эффектом
      return;
    case "wf.rebuild":
      // hybrid → сперва UI (показать прогресс), затем rpc nRPC.wf.rebuild(...)
      return;
    case "auth.logout":
      // rpc + ui cleanup + shell switch + BroadcastChannel
      return;
    default:
      throw new Error(`Unknown command: ${(cmd as any).type}`);
  }
});

// 5) Проброс всех команд в финальный обработчик
sample({ clock: commandDispatched, target: processCommandFx });

// 6) (Опционально) статусы/метрики для UI
export const $lastCmd = createStore<Cmd | null>(null).on(commandDispatched, (_, c) => c);
export const $isBusy = processCommandFx.pending;
processCommandFx.failData.watch(err => console.error("[CMD FAIL]", err));
