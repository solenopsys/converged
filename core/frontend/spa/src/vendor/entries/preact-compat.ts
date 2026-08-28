/**
 * The full `preact/compat` — as its own file, not inside preact.js: it's only
 * needed by the microfrontend layer (their views are written against the
 * React-compatible API), and it has no business on the critical path. The
 * difference isn't cosmetic: compat brings React prop semantics (`onChange`
 * on an input, ref objects, portals) that the core doesn't have.
 *
 * The path is physical for the same reason as in preact.ts: the import map
 * routes the `preact/compat` specifier to this same file, and the bundle
 * would import itself. Hooks don't end up inside it — see preact-hooks-proxy.ts.
 */

// @ts-ignore Physical path: the specifier would lead back to this same file.
export * from "../../../node_modules/preact/compat/dist/compat.mjs";
// @ts-ignore See the import above.
export { default } from "../../../node_modules/preact/compat/dist/compat.mjs";

/**
 * compat hands hooks through in transit, and the bundler doesn't carry a
 * double star (`entry → compat → hooks`) through to the final module — hence
 * the named list. The source is the same shared preact.js: it also serves the
 * proxy inside the build.
 */
export {
  useCallback,
  useContext,
  useDebugValue,
  useEffect,
  useErrorBoundary,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "preact";
