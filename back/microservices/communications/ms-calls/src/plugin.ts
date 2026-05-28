import { createHttpBackend } from "nrpc";
import { metadata } from "g-calls";
import { CallsServiceImpl } from "./service";
import { LlmGateBridge } from "./llm-gate-bridge";

// Shared service instance — used by both nrpc and the background bridge
const serviceInstance = new CallsServiceImpl();

const plugin = (config: any) => {
  // createHttpBackend accepts an already-instantiated object (line 326 in http-backend.ts)
  const app = createHttpBackend({ metadata, serviceImpl: serviceInstance })(config);

  if (typeof config?.registerStartupTask === "function") {
    config.registerStartupTask("nrpc:calls", async () => {
      // Nothing extra — nrpc backend handles its own init
    });

    config.registerStartupTask("llm-gate-bridge", async () => {
      try {
        // Give the service stores time to initialise
        await (serviceInstance as any).initPromise;
        const bridge = new LlmGateBridge(serviceInstance);
        bridge.start();

        if (typeof config.registerShutdownTask === "function") {
          config.registerShutdownTask("llm-gate-bridge", async () => bridge.stop());
        }
      } catch (err) {
        console.warn("[ms-calls] llm-gate-bridge startup failed:", err);
      }
    });
  }

  return app;
};

export default plugin;
