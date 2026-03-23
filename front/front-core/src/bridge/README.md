# SSR-SPA Bridge (Draft)

`front-core/src/bridge` is a framework-agnostic core layer for the SSR-first shell:

- `menu-model.ts`: normalize menu JSON from SSR payloads.
- `panel-state.ts`: deterministic reducer for menu/panel visibility.
- `spa-loader.ts`: lazy SPA module loading with cache and retry.
- `controller.ts`: orchestrates menu + panels + module loader.
- `entry.ts`: tiny browser bootstrap for a standalone `bridge.js` bundle.

This folder is intentionally React-free, so a lightweight vanilla script can use it as the runtime bridge between SSR HTML and on-demand SPA modules.

