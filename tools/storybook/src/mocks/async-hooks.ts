export const AsyncLocalStorage = class {
  getStore() { return undefined; }
  run(_store: unknown, fn: () => unknown) { return fn(); }
};
export const AsyncResource = class {};
export const createHook = () => ({ enable() {}, disable() {} });
export const executionAsyncId = () => 0;
export const triggerAsyncId = () => 0;
