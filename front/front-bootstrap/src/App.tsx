import React, { Suspense, useState, useEffect } from "react";
import { ThemeProvider } from "converged-core";
import { AuthProvider } from "./auth/AuthContext";
import { createModulesServiceClient } from "./generated";
import { MenuController, LocaleController, translateJson } from "converged-core";
import { registry as actions } from "converged-core";
import { createEvent } from "effector";
import { SlotProvider, useSlotMount } from "converged-core";

export const $moduleLoadEvent = createEvent<string>();
$moduleLoadEvent.watch((value) => {
	console.log("store value:", value);
});


import { ModuleLoader } from "converged-core";
import {
	ModuleConfig,
	LoadedModule,
	View,
} from "converged-core";

const menuController = MenuController.getInstance();
const localeController = LocaleController.getInstance();
const modulesClient = createModulesServiceClient();

const moduleLoader = new ModuleLoader();


const App: React.FC = () => {
	const [modules, setModules] = useState<LoadedModule[]>([]);
	const [currentView, setCurrentView] = useState<View | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	// Обработчик изменения URL
	useEffect(() => {
		const handleLocationChange = (): void => {
			//const newView = routingProcessor.processRoute(window.location.pathname, modules);
			//	setCurrentView(newView);
		};

		// Слушаем изменения URL
		window.addEventListener('popstate', handleLocationChange);

		// Обрабатываем текущий URL
		handleLocationChange();

		return () => {
			window.removeEventListener('popstate', handleLocationChange);
		};
	}, [modules]);



	// Загрузка модулей
	useEffect(() => {
		const loadModules = async (): Promise<void> => {
			try {
				const data: ModuleConfig[] = await modulesClient.list();
				console.log("Loaded modules:", data);

				// Загружаем все модули
				const loadedModules = await Promise.all(
					data.map(async (moduleConfig: ModuleConfig): Promise<LoadedModule | null> => {
						try {
							const loadedModule = await moduleLoader.loadModule(moduleConfig);

							// Устанавливаем локали
							if (moduleConfig.locales) {
								localeController.setLocales(moduleConfig.name, moduleConfig.locales);
							}

							// Загружаем переводы и добавляем в меню
							await loadModuleTranslations(loadedModule);
							loadedModule.actions.forEach(action => {
								actions.register(action);
							});

							$moduleLoadEvent(loadedModule.id);

							return loadedModule;
						} catch (error: any) {
							console.error(`Failed to load module ${moduleConfig.name}:`, error);
							return null;
						}
					})
				);

				const map = actions.run("layout.mapping", {});
				console.log("Layout mapping:", map);

				const SW = map["sidebar"];
				console.log("Simple widget:", SW);

				actions.run("layout.mount", { widget: SW, ctx: {} });
				actions.run("left.menu.mount", {  });
				actions.run("dag.show_code_source_list", {});
				//actions.run("incoming_mails.show", {});

		 


				//	mount(SW, "global:toast")

				// Фильтруем успешно загруженные модули
				const validModules = loadedModules.filter((module): module is LoadedModule => module !== null);
				setModules(validModules);

				// Инициализируем роутинг с загруженными модулями
				//	routingProcessor.initialize(validModules);

			} catch (err: any) {
				console.error("Error loading modules:", err);
				setError(err.message);
				setModules([]);
			} finally {
				setIsLoading(false);
			}
		};

		loadModules();
	}, []);

	// Загрузка переводов для модуля
	const loadModuleTranslations = async (module: LoadedModule): Promise<void> => {
		if (!module.id || !module.menu) return;

		try {
			const locales = localeController.getLocales(module.id);
			const currentLanguage = 'ru'; // Можно сделать динамическим

			if (locales && locales[currentLanguage]) {
				const response = await fetch(locales[currentLanguage]);
				if (response.ok) {
					const translations = await response.json();
					const t = (key: string): string => {
						const keys = key.split('.');
						let value: any = translations;
						for (const k of keys) {
							if (value && typeof value === 'object' && k in value) {
								value = value[k];
							} else {
								return key;
							}
						}
						return typeof value === 'string' ? value : key;
					};

					const translatedMenu = translateJson(module.menu, t);
					menuController.addMenu(module.id, translatedMenu);
				}
			}
		} catch (error: any) {
			console.error('Failed to load translations for module:', error);
		}
	};

	// Обработчик навигации
	const navigate = (path: string, params: Record<string, any> = {}): void => {
		// routingProcessor.navigate(path, params);
		// const newView = routingProcessor.processRoute(path, modules);
		// setCurrentView(newView);
	};

	// Рендер ошибки
	if (error) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-red-600">Error Loading Application</h1>
					<p className="mt-2 text-gray-600">{error}</p>
				</div>
			</div>
		);
	}

	// Рендер загрузки
	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
					<p className="mt-4 text-gray-600">Loading modules...</p>
				</div>
			</div>
		);
	}

	// // Создаем контекст рендеринга
	// const renderContext: RenderContext = {
	// 	navigate,
	// 	//routingProcessor,
	// 	moduleLoader,
	// 	dynamicRenderer
	// };

	return (
		<AuthProvider>
			<ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
				<SlotProvider>
					<Suspense fallback={<div className="flex items-center justify-center min-h-screen">Загрузка...</div>}>
						{/* {dynamicRenderer.render(currentView, renderContext)} */}
					</Suspense>
				</SlotProvider>
			</ThemeProvider>
		</AuthProvider>
	);
};

export default App;