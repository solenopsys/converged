import { registry, type EventBus } from "front-core";

const THREADS_SHOW = "threads.show";
const THREADS_MODULE = "mf-threads";

let threadsRuntimePromise: Promise<void> | null = null;

type ThreadOpenParams = {
  threadId: string;
  title?: string;
  placement?: "center" | "sidebar:right";
  variant?: "dashboard" | "thread";
};

async function ensureThreadsActionRegistered(bus: EventBus): Promise<void> {
  if (registry.get(THREADS_SHOW)) return;

  threadsRuntimePromise ??= import(THREADS_MODULE)
    .then((runtime) => {
      if (!registry.get(THREADS_SHOW) && runtime?.default?.plug) {
        runtime.default.plug(bus);
      }
    })
    .finally(() => {
      threadsRuntimePromise = null;
    });

  await threadsRuntimePromise;
}

export async function openThread(bus: EventBus, params: ThreadOpenParams): Promise<void> {
  await ensureThreadsActionRegistered(bus);
  bus.run(THREADS_SHOW, params);
}
