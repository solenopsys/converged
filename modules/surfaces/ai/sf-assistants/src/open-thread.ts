import { type ActionRegistry, registry } from "front-core";

const THREADS_SHOW = "threads.show";
const THREADS_MODULE = "sf-threads";

let threadsRuntimePromise: Promise<void> | null = null;

type ThreadOpenParams = {
	threadId: string;
	title?: string;
	placement?: "center" | "sidebar:right";
	variant?: "dashboard" | "thread";
};

async function ensureThreadsActionRegistered(
	bus: ActionRegistry,
): Promise<void> {
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

export async function openThread(
	bus: ActionRegistry,
	params: ThreadOpenParams,
): Promise<void> {
	await ensureThreadsActionRegistered(bus);
	bus.run(THREADS_SHOW, params);
}
