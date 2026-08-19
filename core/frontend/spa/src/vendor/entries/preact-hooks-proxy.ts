/**
 * Подмена спецификатора `preact/hooks` внутри сборки compat.
 *
 * Причина: в `preact/compat` лежит `export * from "preact/hooks"`, а звезду
 * через границу external бандлер разворачивает в ссылку на несуществующее
 * пространство имён — модуль падает на первой строке. Здесь звезда становится
 * внутренней.
 *
 * Реэкспорт именно через локальные привязки, а не `export ... from "preact"`:
 * из транзитных имён бандлер объект пространства имён тоже не собирает, и
 * ошибка возвращается. Сами функции приезжают из общего preact.js — инстанс
 * хуков остаётся один.
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
