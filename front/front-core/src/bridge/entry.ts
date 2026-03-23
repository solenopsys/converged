import { createBridgeController } from './controller';

const bridge = createBridgeController();
const bridgeGlobal = globalThis as typeof globalThis & {
  __SSR_SPA_BRIDGE__?: ReturnType<typeof createBridgeController>;
};

bridgeGlobal.__SSR_SPA_BRIDGE__ = bridge;

if (typeof document !== 'undefined') {
  document.dispatchEvent(new CustomEvent('ssr-spa-bridge:ready'));
}
