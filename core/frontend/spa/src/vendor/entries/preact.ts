import * as preact from "preact";
import { options } from "preact";

/**
 * All of Preact in one file: the core, hooks, the jsx runtime, and the piece
 * of `compat` we actually need. The import map routes every specifier here —
 * separate facades were four requests for a shared core that gets loaded
 * whole either way.
 */

export * from "preact";

// @ts-ignore Physical path: the specifier would lead back to this same file.
export * from "../../../node_modules/preact/hooks/dist/hooks.mjs";

// Fragment isn't re-exported from here: it already arrives from the core, and
// the jsx runtime hands out the exact same reference.
export {
  jsx,
  jsxs,
  jsxDEV,
  // @ts-ignore See the import above.
} from "../../../node_modules/preact/jsx-runtime/dist/jsxRuntime.mjs";

// This is the exact implementation that `preact/compat` hands out.
export function flushSync<T>(callback: () => T): T {
  const debounce = options.debounceRendering;
  options.debounceRendering = (render) => render();
  try {
    return callback();
  } finally {
    options.debounceRendering = debounce;
  }
}

export default preact;
