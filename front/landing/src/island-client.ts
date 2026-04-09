import { mountSsrMenuShell, bus } from 'front-core';
import { createRuntimeServiceClient } from 'g-runtime';

// App-level bus handlers — registered before any UI mounts
const runtimeClient = createRuntimeServiceClient({ baseUrl: "/services" });
bus.register({
  id: "auth.send-magic-link",
  description: "Send magic link via runtime",
  invoke: (params: { email: string; returnTo?: string }) => runtimeClient.sendMagicLink(params),
});

mountSsrMenuShell();
