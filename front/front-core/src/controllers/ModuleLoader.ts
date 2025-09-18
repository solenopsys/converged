
type ModuleConfig = {
	name: string;
	link: string;
	locales?: Record<string, string>;
	protected?: boolean;
};

type ModuleLoadOptions = {
	
}

type LoadedModule = {
	name: string;
	id: string;
	link: string;
	locales?: Record<string, string>;
	isProtected?: boolean; 
	menu?: any;
	plugin: Plugin;
	originalExports: any;
};

import { Plugin } from "./types";

type ModuleExport = {
	plugin: Plugin;
	css?: string;
	externals?: Record<string, string>;
	id?: string;
	menu?: any;
};

export type {ModuleConfig, ModuleLoadOptions, LoadedModule, ModuleExport};

export class ModuleLoader {
	private loadedModules: Map<string, LoadedModule> = new Map();
	private loadingPromises: Map<string, Promise<LoadedModule>> = new Map();

	constructor() { }

	// Загрузка модуля
	async loadModule(moduleConfig: ModuleConfig, options?: ModuleLoadOptions): Promise<LoadedModule> {
		const { name, link, locales, protected: isProtected } = moduleConfig;

		// Проверяем, не загружается ли модуль уже
		if (this.loadingPromises.has(name)) {
			return await this.loadingPromises.get(name)!;
		}

		// Проверяем, не загружен ли модуль уже
		if (this.loadedModules.has(name)) {
			return this.loadedModules.get(name)!;
		}

		// Создаем промис загрузки
		const loadingPromise = this._loadModuleInternal(moduleConfig, options);
		this.loadingPromises.set(name, loadingPromise);

		try {
			const module = await loadingPromise;
			this.loadedModules.set(name, module);
			return module;
		} finally {
			this.loadingPromises.delete(name);
		}
	}

	// Внутренняя загрузка модуля
	private async _loadModuleInternal(moduleConfig: ModuleConfig, options?: ModuleLoadOptions): Promise<LoadedModule> {
		const { name, link, locales, protected: isProtected } = moduleConfig;

		try {
			console.log(`Loading module: ${name} from ${link}`);

			// Загружаем модуль
			const moduleExports: { default: ModuleExport } = await import(link);

			if (!moduleExports || !moduleExports.default) {
				throw new Error(`Module ${name} does not have default export`);
			}

			const {
				plugin,
				css,
				externals,
				id,
				menu
			} = moduleExports.default;

			 

			// Загружаем CSS
			if (css) {
				await this._loadCSS(name, css);
			}

			// Загружаем внешние зависимости
			if (externals) {
				await this._loadExternals(link, externals);
			}

			// Создаем объект загруженного модуля
			const loadedModule: LoadedModule = {
				name,
				id: id || name,
				link,
				locales,
				isProtected, 
				plugin,
				menu,
				originalExports: moduleExports.default
			};
 

			console.log(`Successfully loaded module: ${name}`, loadedModule);
			return loadedModule;

		} catch (error: any) {
			console.error(`Failed to load module ${name}:`, error);
			throw new Error(`Failed to load module ${name}: ${error.message}`);
		}
	}

	// Загрузка CSS
	private async _loadCSS(moduleName: string, css: string): Promise<void> {
		const styleId = `module-css-${moduleName}`;

		// Проверяем, не загружен ли CSS уже
		if (document.getElementById(styleId)) {
			return;
		}

		const style = document.createElement('style');
		style.id = styleId;
		style.textContent = css;
		document.head.appendChild(style);

		console.log(`Loaded CSS for module: ${moduleName}`);
	}

	// Загрузка внешних зависимостей
	private async _loadExternals(moduleLink: string, externals: Record<string, string>): Promise<void> {
		try {
			await this._injectToScopeImportMap(moduleLink, externals);

			Object.entries(externals).forEach(([name, url]) => {
				console.log(`External dependency loaded: ${name} -> ${url}`);
			});
		} catch (error: any) {
			console.error('Failed to load external dependencies:', error);
		}
	}

	// Инъекция external зависимостей в import map
	private async _injectToScopeImportMap(link: string, sourceMap: Record<string, string>): Promise<string> {
		try {
			const response = await fetch(link);
			const html = await response.text();

			const parser = new DOMParser();
			const doc = parser.parseFromString(html, 'text/html');
			const importMapScript = doc.querySelector('script[type="importmap"]');

			if (importMapScript) {
				const existingImportMap = JSON.parse(importMapScript.textContent || '{}');
				Object.assign(existingImportMap.imports, sourceMap);
				importMapScript.textContent = JSON.stringify(existingImportMap, null, 2);
			}

			return doc.documentElement.outerHTML;
		} catch (error: any) {
			console.error('Failed to inject import map:', error);
			throw error;
		}
	}

	// Получение загруженного модуля
	getModule(name: string): LoadedModule | undefined {
		return this.loadedModules.get(name);
	}

	// Получение всех загруженных модулей
	getAllModules(): LoadedModule[] {
		return Array.from(this.loadedModules.values());
	}

	// Проверка, загружен ли модуль
	isModuleLoaded(name: string): boolean {
		return this.loadedModules.has(name);
	}



	// Очистка загруженных модулей
	clearModules(): void {
		// Удаляем CSS
		for (const moduleName of this.loadedModules.keys()) {
			const styleId = `module-css-${moduleName}`;
			const styleElement = document.getElementById(styleId);
			if (styleElement) {
				styleElement.remove();
			}
		}

		this.loadedModules.clear();
		this.loadingPromises.clear();
	}

	// Перезагрузка модуля
	async reloadModule(name: string): Promise<LoadedModule> {
		// Удаляем старый модуль
		if (this.loadedModules.has(name)) {
			const styleId = `module-css-${name}`;
			const styleElement = document.getElementById(styleId);
			if (styleElement) {
				styleElement.remove();
			}
			this.loadedModules.delete(name);
		}

		// Найдем конфигурацию модуля (это нужно передавать извне)
		// Пока просто выбрасываем ошибку
		throw new Error('Module reload requires original module config');
	}
}