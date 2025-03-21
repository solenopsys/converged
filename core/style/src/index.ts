export * from "./browser/class-injector";
export * from "./browser/styles-injector";

import type { PresetUnoOptions } from "@unocss/preset-uno";
import presetUno from "@unocss/preset-uno";
import type { RuntimeContext } from "./browser/config";
import init from "./browser/config";

import presetMini from "@unocss/preset-mini";
import presetAttributify from "@unocss/preset-attributify";

init({
	defaults: {
		presets: [presetMini(), presetAttributify()],
	},
});

export function init_unocss(){
	window.__unocss_runtime = window.__unocss_runtime ?? ({} as RuntimeContext);
	window.__unocss_runtime.presets = Object.assign(
	  window.__unocss_runtime?.presets ?? {},
	  {
		presetUno: (options: PresetUnoOptions) => presetUno(options),
	  },
	);
  
	// Добавляем обработчик для перегенерации стилей после рендеринга
	const observer = new MutationObserver(() => {
	  window.uno?.refreshAll();
	});
  
	// Наблюдаем за изменениями в DOM
	observer.observe(document.body, {
	  childList: true,
	  subtree: true
	});
  }