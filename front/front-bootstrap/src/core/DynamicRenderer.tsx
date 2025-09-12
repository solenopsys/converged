import React, { ReactNode } from 'react';
import { SidebarLayout, SimpleLayout } from "../../../front-modules/packages/layouts-mf/src"
import { ProtectedRoute } from "../ProtectedRoute";
import { CapabilityRenderer } from './CapabilityRenderer';
import { View, RenderContext, LayoutType, LoadedModule } from './types';
import { RoutingProcessor } from './RoutingProcessor';
import { ModuleLoader } from './ModuleLoader';

export class DynamicRenderer {
	private routingProcessor: RoutingProcessor;
	private moduleLoader: ModuleLoader;

	constructor(routingProcessor: RoutingProcessor, moduleLoader: ModuleLoader) {
		this.routingProcessor = routingProcessor;
		this.moduleLoader = moduleLoader;
	}

	// Рендеринг capability с отладкой
	renderCapability(view: View, context: RenderContext): ReactNode {
		console.log('>>> DEBUG: renderCapability view:', view);
		console.log('🔧 DynamicRenderer.renderCapability called with:', {
			view,
			context,
			CapabilityRenderer: CapabilityRenderer
		});

		const { module, capability, capabilityKey, params, layout } = view;
		
		console.log('🔧 Destructured values:', { module, capability, capabilityKey, params, layout });
		 
		if (!module || !capability || !capabilityKey) {
			console.error('❌ Invalid capability view:', { module, capability, capabilityKey });
			return this.renderError(new Error('Invalid capability view'), context);
		}

		// Создаем контекст для capability
		const capabilityContext = {
			...context,
			module,
			params: params || {},
			capabilityKey,
			navigate: context.navigate || (() => {})
		};

		console.log('🔧 Created capabilityContext:', capabilityContext);

		// Проверяем, что CapabilityRenderer существует
		if (!CapabilityRenderer) {
			console.error('❌ CapabilityRenderer is undefined!');
			return this.renderError(new Error('CapabilityRenderer not found'), context);
		}

		console.log('✅ About to render CapabilityRenderer with:', {
			capability,
			context: capabilityContext
		});

		// Рендерим capability компонент
		const capabilityElement = (
			<CapabilityRenderer
				key={`${module.name}-${capabilityKey}`}
				capability={capability}
				context={capabilityContext}
			/>
		);

		console.log('✅ CapabilityRenderer element created:', capabilityElement);

		// Оборачиваем в защищенный роут при необходимости
		const protectedElement = module.isProtected ? (
			<ProtectedRoute>{capabilityElement}</ProtectedRoute>
		) : capabilityElement;

		console.log('✅ Protected element created:', protectedElement);

		// Выбираем layout
		const result = this.renderWithLayout(protectedElement, layout, view, context);
		console.log('✅ Final result from renderWithLayout:', result);
		
		return result;
	}

	// Остальные методы без изменений...
	renderWithLayout(element: ReactNode, layoutType: LayoutType, view: View, context: RenderContext): ReactNode {
		console.log('🔧 renderWithLayout called with layoutType:', layoutType);
		
		switch (layoutType) {
			case 'sidebar':
				return (
					<SidebarLayout>
						{element}
					</SidebarLayout>
				);
			
			case 'simple':
				return (
					<SimpleLayout>
						{element}
					</SimpleLayout>
				);
			
			default:
				return (
					<SimpleLayout>
						{element}
					</SimpleLayout>
				);
		}
	}

	renderError(error: Error, context: RenderContext = {}): ReactNode {
		console.error('🔧 renderError called:', error);
		
		const errorElement = (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center max-w-md">
					<h1 className="text-2xl font-bold text-red-600 dark:text-red-400">
						Application Error
					</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-4">
						{error.message || 'An unexpected error occurred'}
					</p>
					
					{process.env.NODE_ENV === 'development' && (
						<div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded text-left">
							<pre className="text-xs text-red-800 dark:text-red-300 whitespace-pre-wrap">
								{error.stack}
							</pre>
						</div>
					)}
					
					<div className="mt-6">
						<button
							onClick={() => window.location.reload()}
							className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
						>
							Reload Application
						</button>
					</div>
				</div>
			</div>
		);

		return (
			<SimpleLayout>
				{errorElement}
			</SimpleLayout>
		);
	}

	renderNotFound(path: string = ''): ReactNode {
		return (
			<SimpleLayout>
				<div className="flex items-center justify-center min-h-screen">
					<div className="text-center">
						<h1 className="text-4xl font-bold">404 - Not Found</h1>
						<p className="mt-4">Path: {path}</p>
					</div>
				</div>
			</SimpleLayout>
		);
	}

	renderLoading(message: string = 'Loading...'): ReactNode {
		return (
			<SimpleLayout>
				<div className="flex items-center justify-center min-h-screen">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
						<p className="mt-4">{message}</p>
					</div>
				</div>
			</SimpleLayout>
		);
	}

	render(currentView: View | null, context: RenderContext = {}): ReactNode {
		console.log('🔧 DynamicRenderer.render called with:', { currentView, context });
		
		if (!currentView) {
			console.log('🔧 No currentView, rendering not found');
			return this.renderNotFound();
		}

		switch (currentView.type) {
			case 'capability':
				console.log('🔧 Rendering capability view');
				return this.renderCapability(currentView, context);
			case 'not-found':
				console.log('🔧 Rendering not-found view');
				return this.renderNotFound(currentView.path);
			case 'error':
				console.log('🔧 Rendering error view');
				return this.renderError(currentView.error || new Error('Unknown error'), context);
			case 'loading':
				console.log('🔧 Rendering loading view');
				return this.renderLoading(currentView.message);
			default:
				console.log('🔧 Unknown view type, rendering not found');
				return this.renderNotFound();
		}
	}
}