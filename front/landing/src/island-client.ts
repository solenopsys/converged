import { mountSsrMenuShell, bus } from 'front-core';
import { createRuntimeGatesServiceClient } from 'g-rt-gates';

// App-level bus handlers — registered before any UI mounts
const gatesClient = createRuntimeGatesServiceClient({ baseUrl: "/runtime" });
bus.register({
  id: "auth.send-magic-link",
  description: "Send magic link via runtime",
  invoke: (params: { email: string; returnTo?: string }) => gatesClient.sendMagicLink(params),
});

mountSsrMenuShell();
