import * as preact from "preact";
import { options } from "preact";

/**
 * Весь Preact одним файлом: ядро, хуки, jsx-рантайм и тот кусок `compat`,
 * который нам действительно нужен. Карта импорта ведёт сюда все спецификаторы
 * — раздельные фасады были четырьмя запросами ради общего ядра, которое всё
 * равно грузится целиком.
 */

export * from "preact";

// @ts-ignore Физический путь: спецификатор вёл бы обратно в этот же файл.
export * from "../../../node_modules/preact/hooks/dist/hooks.mjs";

// Fragment отсюда не реэкспортируем: он уже приехал из ядра, а jsx-рантайм
// отдаёт ровно ту же ссылку.
export {
  jsx,
  jsxs,
  jsxDEV,
  // @ts-ignore См. импорт выше.
} from "../../../node_modules/preact/jsx-runtime/dist/jsxRuntime.mjs";

// Это та самая реализация, которую отдаёт `preact/compat`.
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
