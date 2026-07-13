import { createHttpBackend } from "nrpc";
import { metadata } from "g-calls";
import { CallsServiceImpl } from "./service";
import { LlmGateBridge } from "./llm-gate-bridge";

const plugin = (config: any) => {
	// Shared service instance for this configured runtime — used by both nrpc and the background bridge.
	const serviceInstance = new CallsServiceImpl(config);
	// createHttpBackend accepts an already-instantiated object (line 326 in http-backend.ts)
	const app = createHttpBackend({ metadata, serviceImpl: serviceInstance })(
		config,
	);

	if (typeof config?.registerStartupTask === "function") {
		config.registerStartupTask("nrpc:calls", async () => {
			// Nothing extra — nrpc backend handles its own init
		});

		config.registerStartupTask("llm-gate-bridge", async () => {
			if (process.env.LLM_GATE_BRIDGE_ENABLED !== "true") {
				console.info(
					"[ms-calls] llm-gate-bridge disabled; centimanus writes to service stores directly",
				);
				return;
			}

			try {
				// Give the service stores time to initialise
				await (serviceInstance as any).initPromise;
				const bridge = new LlmGateBridge(
					serviceInstance,
					config?.cache ?? config?.valkey,
				);
				bridge.start();

				if (typeof config.registerShutdownTask === "function") {
					config.registerShutdownTask("llm-gate-bridge", async () =>
						bridge.stop(),
					);
				}
			} catch (err) {
				console.warn("[ms-calls] llm-gate-bridge startup failed:", err);
			}
		});
	}

	return app;
};

export default plugin;
