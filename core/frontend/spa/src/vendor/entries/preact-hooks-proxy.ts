/**
 * Substitute for the `preact/hooks` specifier inside the compat build.
 *
 * Reason: `preact/compat` contains `export * from "preact/hooks"`, and across
 * an external boundary the bundler unwraps a star into a reference to a
 * namespace that doesn't exist — the module fails on the first line. Here the
 * star becomes internal.
 *
 * The re-export goes through local bindings specifically, not `export ...
 * from "preact"`: the bundler doesn't assemble a namespace object from
 * transit names either, and the error comes back. The functions themselves
 * arrive from the shared preact.js — there's still one hooks instance.
 */
import {
  useCallback as callback,
  useContext as context,
  useDebugValue as debugValue,
  useEffect as effect,
  useErrorBoundary as errorBoundary,
  useId as id,
  useImperativeHandle as imperativeHandle,
  useLayoutEffect as layoutEffect,
  useMemo as memo,
  useReducer as reducer,
  useRef as ref,
  useState as state,
} from "preact";

export const useCallback = callback;
export const useContext = context;
export const useDebugValue = debugValue;
export const useEffect = effect;
export const useErrorBoundary = errorBoundary;
export const useId = id;
export const useImperativeHandle = imperativeHandle;
export const useLayoutEffect = layoutEffect;
export const useMemo = memo;
export const useReducer = reducer;
export const useRef = ref;
export const useState = state;
