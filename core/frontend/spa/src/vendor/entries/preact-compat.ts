/**
 * Полный `preact/compat` — отдельным файлом, а не внутри preact.js: он нужен
 * только слою микрофронтендов (их вьюхи написаны на React-совместимом API), и
 * в критическом пути ему делать нечего. Разница не косметическая: compat
 * приводит React-семантику пропсов (`onChange` на input, ref-объекты,
 * порталы), которой в ядре нет.
 *
 * Путь физический по той же причине, что и в preact.ts: спецификатор
 * `preact/compat` карта импорта ведёт в этот же файл, и бандл импортировал бы
 * сам себя. Хуки внутрь не попадают — см. preact-hooks-proxy.ts.
 */

// @ts-ignore Физический путь: спецификатор вёл бы обратно в этот же файл.
export * from "../../../node_modules/preact/compat/dist/compat.mjs";
// @ts-ignore См. импорт выше.
export { default } from "../../../node_modules/preact/compat/dist/compat.mjs";

/**
 * Хуки compat отдаёт транзитом, а двойную звезду (`entry → compat → hooks`)
 * бандлер до итогового модуля не доводит — отсюда поимённый список. Источник
 * тот же общий preact.js: он же обслуживает и прокси внутри сборки.
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
