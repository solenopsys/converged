import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, useState, useEffect } from "react";
import { ThemeProvider } from "converged-core";
import { AuthProvider } from "./AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { staticRoutes } from "./routes.config";
import { SidebarLayout } from "converged-core";
import { SimpleLayout } from "converged-core";
import { createModulesServiceClient } from "./generated";
import { MenuController, LocaleController, translateJson } from "converged-core";

const menuController = MenuController.getInstance();
const localeController = LocaleController.getInstance();
const modulesClient = createModulesServiceClient();

function App() {
	const [dynamicRoutes, setDynamicRoutes] = useState([]);
	const [loadedSidebarComponents, setLoadedSidebarComponents] = useState(new Map());
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	console.log("OK");

	const injectToScopeImportMap = async (link: string, sourceMap: { [key: string]: string }) => {
		const response = await fetch(link);
		const html = await response.text();

		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		const importMapScript = doc.querySelector('script[type="importmap"]');

		if (importMapScript) {
			const existingImportMap = JSON.parse(importMapScript.textContent);
			Object.assign(existingImportMap.imports, sourceMap);
			importMapScript.textContent = JSON.stringify(existingImportMap, null, 2);
		}

		return doc.documentElement.outerHTML;
	};

	const loadSidebarModuleComponent = async (moduleData) => {
		try {
			const module = await import(moduleData.link);
			
			if (!module || !module.default) {
				console.error('Module loading failed for:', moduleData.link);
				return () => <div>Error loading module</div>;
			}

			const { component: Component, css, externals, id, menu } = module.default;

			if (!Component) {
				console.error('Component not found in module:', moduleData.link);
				return () => <div>Component not found</div>;
			}

			console.log("Sidebar Module ID", id);
			console.log("Sidebar Module Menu", menu);

			// Загружаем переводы для sidebar модулей (нужно для меню)
			if (id && menu) {
				let menuToAdd = menu;
				try {
					const locales = localeController.getLocales(id);
					const currentLanguage = 'ru';

					if (locales && locales[currentLanguage]) {
						const response = await fetch(locales[currentLanguage]);
						if (response.ok) {
							const translations = await response.json();
							const t = (key) => {
								const keys = key.split('.');
								let value = translations;
								for (const k of keys) {
									if (value && typeof value === 'object' && k in value) {
										value = value[k];
									} else {
										return key;
									}
								}
								return typeof value === 'string' ? value : key;
							};
							menuToAdd = translateJson(menu, t);
						}
					}
				} catch (error) {
					console.error('Failed to load translations for sidebar module:', error);
				}
				menuController.addMenu(id, menuToAdd);
			}

			// CSS и externals для sidebar модулей
			if (css) {
				const styleId = `route-css-${id}`;
				if (!document.getElementById(styleId)) {
					const style = document.createElement('style');
					style.id = styleId;
					style.textContent = css;
					document.head.appendChild(style);
				}
			}

			if (externals) {
				Object.entries(externals).forEach(([name, url]) => {
					console.log(`External dependency for sidebar module: ${name} -> ${url}`);
				});
				await injectToScopeImportMap(moduleData.link, externals);
			}

			return Component;
		} catch (error) {
			console.error('Failed to load sidebar component:', error);
			return () => <div>Failed to load component: {error.message}</div>;
		}
	};

	useEffect(() => {
		const loadDynamicRoutes = async () => {
			try {
				const data = await modulesClient.list();
				
				// Устанавливаем локали для всех модулей
				for (const module of data) {
					const name = module.name;
					const locales = module.locales;
					localeController.setLocales(name, locales);
				}

				// Фильтруем модули по типу layout
				const sidebarModules = data.filter(item => 
					item && item.layout === "SidebarLayout" && item.path && item.link
				);
				
				const simpleModules = data.filter(item => 
					item && item.layout === "SimpleLayout" && item.path && item.link
				);

				// Загружаем только sidebar модули сразу (eager loading)
				const sidebarComponentsMap = new Map();
				const sidebarLoadPromises = sidebarModules.map(async (moduleData) => {
					const Component = await loadSidebarModuleComponent(moduleData);
					sidebarComponentsMap.set(moduleData.path, Component);
					return moduleData;
				});

				await Promise.all(sidebarLoadPromises);
				setLoadedSidebarComponents(sidebarComponentsMap);
				
				// Объединяем все модули для общего состояния
				setDynamicRoutes([...sidebarModules, ...simpleModules]);
			} catch (err) {
				console.error("Ошибка загрузки динамических роутов:", err);
				setError(err.message);
				setDynamicRoutes([]);
			} finally {
				setIsLoading(false);
			}
		};

		loadDynamicRoutes();
	}, []);

	// Sidebar routes - используют eager loading
	const sidebarRoutes = dynamicRoutes
		.filter(item => item && item.layout === "SidebarLayout" && item.path && item.link)
		.map(item => ({
			...item,
			component: loadedSidebarComponents.get(item.path), // Уже загруженные компоненты
			protected: true,
		}));

	// Simple routes - используют lazy loading
	const simpleRoutes = dynamicRoutes
		.filter(item => item && item.layout === "SimpleLayout" && item.path && item.link)
		.map(item => ({
			...item,
			component: () => import(item.link), // Lazy loading для простых маршрутов
			protected: true,
			link: item.link,
		}));

	const createSidebarRouteElement = ({ component, element, protected: isProtected }) => {
		if (element) return element;

		if (component) {
			const Component = component; // Уже загруженный компонент
			return isProtected ? (
				<ProtectedRoute>
					<Component />
				</ProtectedRoute>
			) : (
				<Component />
			);
		}
		
		return <div>No component or element provided</div>;
	};

	const createSimpleRouteElement = ({ component, element, protected: isProtected, link }) => {
		if (element) return element;

		if (component) {
			const LazyComponent = lazy(() =>
				component().then(async module => {
					// Проверяем, что модуль загружен корректно
					if (!module || !module.default) {
						console.error('Module loading failed for:', link);
						return { default: () => <div>Error loading module</div> };
					}

					const { component: Component, css, externals, id, menu } = module.default;

					// Проверяем, что компонент существует
					if (!Component) {
						console.error('Component not found in module:', link);
						return { default: () => <div>Component not found</div> };
					}

					console.log("Simple Module ID", id);
					console.log("Simple Module Menu", menu);

					// Для простых маршрутов не загружаем меню заранее (они не в админке)
					// Но можем загрузить CSS и externals
					if (css) {
						const styleId = `route-css-${id}`;
						if (!document.getElementById(styleId)) {
							const style = document.createElement('style');
							style.id = styleId;
							style.textContent = css;
							document.head.appendChild(style);
						}
					}

					if (externals) {
						Object.entries(externals).forEach(([name, url]) => {
							console.log(`External dependency for simple module: ${name} -> ${url}`);
						});
						injectToScopeImportMap(link, externals);
					}

					return { default: Component };
				}).catch(error => {
					console.error('Failed to load component:', error);
					return { default: () => <div>Failed to load component: {error.message}</div> };
				})
			);

			return isProtected ? (
				<ProtectedRoute>
					<LazyComponent />
				</ProtectedRoute>
			) : (
				<LazyComponent />
			);
		}
		
		return <div>No component or element provided</div>;
	};

	// Показываем загрузку пока получаем динамические роуты
	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				Загрузка конфигурации...
			</div>
		);
	}

	// Показываем ошибку если что-то пошло не так
	if (error) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<p className="text-red-500 mb-2">Ошибка загрузки: {error}</p>
					<button
						onClick={() => window.location.reload()}
						className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
					>
						Попробовать снова
					</button>
				</div>
			</div>
		);
	}

	return (
		<BrowserRouter>
			<AuthProvider>
				<ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
					<Suspense fallback={<div className="flex items-center justify-center min-h-screen">Загрузка...</div>}>
						<Routes>
							{/* Роуты с сайдбаром - EAGER LOADING */}
							<Route element={<SidebarLayout />}>
								{sidebarRoutes.map((route) => {
									if (!route || !route.path) {
										console.warn('Invalid sidebar route:', route);
										return null;
									}
									return (
										<Route
											key={route.path}
											path={`${route.path}/*`}
											element={createSidebarRouteElement(route)}
										/>
									);
								})}
							</Route>

							{/* Роуты без сайдбара - LAZY LOADING */}
							<Route element={<SimpleLayout />}>
								{simpleRoutes.map((route) => {
									if (!route || !route.path) {
										console.warn('Invalid simple route:', route);
										return null;
									}
									return (
										<Route
											key={route.path}
											path={`${route.path}/*`}
											element={createSimpleRouteElement(route)}
										/>
									);
								})}
							</Route>

							{/* Fallback */}
							<Route path="*" element={<Navigate to="/login" replace />} />
						</Routes>
					</Suspense>
				</ThemeProvider>
			</AuthProvider>
		</BrowserRouter>
	);
}

export default App;