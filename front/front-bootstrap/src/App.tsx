import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, useState, useEffect } from "react";
import { ThemeProvider } from "converged-core";
import { AuthProvider } from "./AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { staticRoutes } from "./routes.config";
import { SidebarLayout } from "converged-core";
import { SimpleLayout } from "converged-core";
import { createModulesServiceClient } from "./generated";
import { MenuController ,LocaleController,useMicrofrontendTranslation,translateJson} from "converged-core";
const menuController = MenuController.getInstance();
const localeController=LocaleController.getInstance();

const modulesClient=createModulesServiceClient();

function App() {
	const [dynamicRoutes, setDynamicRoutes] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	console.log("OK");

	useEffect(() => {
		const loadDynamicRoutes = async () => {
			try {
		 
				
				const data = await modulesClient.list();
				for (const module of data) {
					const name=module.name;
					const locales=module.locales;
					localeController.setLocales(name, locales);
				}
				setDynamicRoutes(data);
			} catch (err) {
				console.error("Ошибка загрузки динамических роутов:", err);
				setError(err.message);
				setDynamicRoutes([]); // Устанавливаем пустой массив в случае ошибки
			} finally {
				setIsLoading(false);
			}
		};

		loadDynamicRoutes();
	}, []);

	const sidebarRoutes = dynamicRoutes.filter(item => item.layout === "SidebarLayout").map(item => ({
		...item,
		component: () => import(item.link),
		protected: true,
		link: item.link,
	}));

	const simpleRoutes = dynamicRoutes.filter(item => item.layout === "SimpleLayout").map(item => ({
		...item,
		component: () => import(item.link),
		protected: true,
		link: item.link,
	}));

	const injectToScopeImportMap = async (link: string, sourceMap: {[key: string]: string}) => {
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
	

	const createRouteElement = ({ component, element, protected: isProtected, link }) => {
		if (element) return element;
		
		if (component) {
		  const LazyComponent = lazy(() => 
			component().then(async module => {
			  const { component: Component, css, externals, id, menu } = module.default;
			  
			  console.log("ID", id);
			  console.log("Menu", menu);
	  
			  // Загружаем переводы синхронно
			  if (id && menu) {
				try {
				  const localeController = LocaleController.getInstance();
				  const locales = localeController.getLocales(id);
				  const currentLanguage = 'ru'; // или откуда-то получай текущий язык
				  
				  if (locales[currentLanguage]) {
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
					  
					  const menuTranslated = translateJson(menu, t);
					  menuController.addMenu(id, menuTranslated);
					}
				  }
				} catch (error) {
				  console.error('Failed to load translations:', error);
				  // Добавляем меню без перевода
				  menuController.addMenu(id, menu);
				}
			  }
			  
			  // CSS и externals
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
				  console.log(`External dependency: ${name} -> ${url}`);
				});
				injectToScopeImportMap(link, externals);
			  }
			  
			  return { default: Component };
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
		return null;
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
							{/* Роуты с сайдбаром */}
							<Route element={<SidebarLayout />}>
								{sidebarRoutes.map((route) => (
									console.log(route),
									<Route 
										key={route.path} 
										path={route.path}
										element={createRouteElement(route)} 
									/>
								))}
							</Route>

							{/* Роуты без сайдбара */}
							<Route element={<SimpleLayout />}>
								{simpleRoutes.map((route) => (
									console.log(route),
									<Route 
										key={route.path} 
										path={route.path}
										element={createRouteElement(route)} 
									/>
								))}
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