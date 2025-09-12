import { LoadedModule, Capability, View, Route, RouteMatch, ParsedPath } from './types';

export class RoutingProcessor {
	private routes: Map<string, Route> = new Map();
	private currentRoute: Route | null = null;
	private defaultRoute: string = '/login';

	constructor() {}

	// Инициализация роутинга с загруженными модулями
	initialize(modules: LoadedModule[]): void {
		this.routes.clear();
		
		modules.forEach(module => {
			if (module.capabilities) {
				// Регистрируем capabilities как роуты
				Object.entries(module.capabilities).forEach(([capabilityKey, capability]) => {
					// Генерируем путь на основе ключа capability
					const path = `/${module.name}/${capabilityKey}`;
					
					this.routes.set(path, {
						module,
						capability,
						capabilityKey,
						path
					});
				});
			}
		});

		console.log('Registered routes:', Array.from(this.routes.keys()));
	}

	// Обработка текущего роута
	processRoute(path: string, modules: LoadedModule[]): View {
		console.log('Processing route:', path);
		// Очищаем path от параметров запроса
		const cleanPath = path.split('?')[0];
		console.log('>>> DEBUG: cleanPath:', cleanPath, 'has route:', this.routes.has(cleanPath));
		
		// Проверяем точное совпадение
		if (this.routes.has(cleanPath)) {
			const route = this.routes.get(cleanPath)!;
			this.currentRoute = route;
			return this.createView(route, this.parseParams(path));
		}

		// Проверяем паттерны роутов (для параметров)
		for (const [routePath, route] of this.routes.entries()) {
			const match = this.matchRoute(cleanPath, routePath);
			if (match) {
				this.currentRoute = route;
				return this.createView(route, { ...match.params, ...this.parseParams(path) });
			}
		}

		// Если роут не найден, проверяем базовые пути
		const segments = cleanPath.split('/').filter(Boolean);
		if (segments.length >= 2) {
			const moduleName = segments[0];
			const capabilityKey = segments[1];
			const potentialPath = `/${moduleName}/${capabilityKey}`;
			
			if (this.routes.has(potentialPath)) {
				const route = this.routes.get(potentialPath)!;
				this.currentRoute = route;
				return this.createView(route, this.parseParams(path));
			}
		}

		// Fallback - показываем страницу не найдено или перенаправляем на login
		return this.createNotFoundView(cleanPath);
	}

	// Создание объекта представления
	private createView(route: Route, params: Record<string, any> = {}): View {
		const { module, capability, capabilityKey } = route;
		
		return {
			type: 'capability',
			module,
			capability,
			capabilityKey,
			params,
			layout: this.determineLayout(capability),
			path: route.path
		};
	}

	// Определение типа layout'а на основе capability
	private determineLayout(capability: Capability): 'sidebar' | 'simple' {
		// Если capability имеет menu, то это sidebar layout
		if (capability.menu) {
			return 'sidebar';
		}
		
		// Если capability показывается в центре, то это может быть простой layout
		if (capability.show && capability.show.includes('center')) {
			return 'simple';
		}
		
		// По умолчанию простой layout
		return 'simple';
	}

	// Создание представления для страницы 404
	private createNotFoundView(path: string): View {
		return {
			type: 'not-found',
			path,
			layout: 'simple'
		};
	}

	// Сопоставление роута с паттерном (для параметров в URL)
	private matchRoute(path: string, pattern: string): RouteMatch | null {
		// Простая реализация - можно расширить для поддержки :id и других паттернов
		if (path === pattern) {
			return { params: {} };
		}
		
		// Поддержка параметров вида /module/capability/id
		const pathSegments = path.split('/').filter(Boolean);
		const patternSegments = pattern.split('/').filter(Boolean);
		
		if (pathSegments.length > patternSegments.length && 
			pathSegments.slice(0, patternSegments.length).join('/') === patternSegments.join('/')) {
			
			// Дополнительные сегменты считаем параметрами
			const params: Record<string, any> = {};
			const extraSegments = pathSegments.slice(patternSegments.length);
			
			// Первый дополнительный сегмент - это ID
			if (extraSegments.length > 0) {
				params.id = extraSegments[0];
			}
			
			return { params };
		}
		
		return null;
	}

	// Парсинг параметров запроса
	private parseParams(path: string): Record<string, any> {
		const [, queryString] = path.split('?');
		const params: Record<string, any> = {};
		
		if (queryString) {
			const urlParams = new URLSearchParams(queryString);
			for (const [key, value] of urlParams.entries()) {
				params[key] = value;
			}
		}
		
		return params;
	}

	// Навигация
	navigate(path: string, params: Record<string, any> = {}): void {
		let fullPath = path;
		
		// Добавляем параметры запроса
		const queryParams = new URLSearchParams(params);
		const queryString = queryParams.toString();
		
		if (queryString) {
			fullPath += `?${queryString}`;
		}
		
		// Обновляем URL в браузере
		window.history.pushState(null, '', fullPath);
		
		// Диспатчим событие для обновления приложения
		window.dispatchEvent(new PopStateEvent('popstate'));
	}

	// Получение текущего роута
	getCurrentRoute(): Route | null {
		return this.currentRoute;
	}

	// Получение всех зарегистрированных роутов
	getAllRoutes(): string[] {
		return Array.from(this.routes.keys());
	}

	// Проверка существования роута
	hasRoute(path: string): boolean {
		return this.routes.has(path);
	}

	// Получение модуля по имени
	getModuleCapabilities(moduleName: string): Array<Route & { path: string }> {
		const routes: Array<Route & { path: string }> = [];
		for (const [path, route] of this.routes.entries()) {
			if (route.module.name === moduleName) {
				routes.push({ path, ...route });
			}
		}
		return routes;
	}
}